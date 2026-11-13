import type { AgentAiClient } from './agentAiProxy';
import { verifyNorviLeaseJwt } from './agentAiProxy';

export type AgentSttHandlerDeps = {
  getEnv: (key: string) => string | undefined;
  createServiceClient: (supabaseUrl: string, serviceRoleKey: string) => AgentAiClient;
  fetchImpl?: typeof fetch;
  waitUntil?: (promise: Promise<unknown>) => void;
  awaitFinalize?: boolean;
  maxBodyBytes?: number;
  nowSeconds?: () => number;
};

export const DEFAULT_MAX_STT_BODY_BYTES = 5.5 * 1024 * 1024; // 5.5 MB (safely under Netlify 6 MB limit)
const GROQ_TRANSCRIPTIONS_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-norvi-device, x-norvi-product, apikey',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  });
}

function isHealthPath(pathname: string): boolean {
  return pathname === '/api/agent-stt/health' || pathname === '/agent-stt/health';
}

function isConfigPath(pathname: string): boolean {
  return pathname.endsWith('/agent-stt/config') || pathname === '/api/agent-stt/config' || pathname === '/agent-stt/config';
}

function isTranscriptionsPath(pathname: string): boolean {
  return (
    pathname.endsWith('/v1/audio/transcriptions') ||
    pathname.endsWith('/audio/transcriptions') ||
    pathname.endsWith('/transcriptions')
  );
}

export function createAgentSttHandler(deps: AgentSttHandlerDeps) {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const nowSeconds = deps.nowSeconds ?? (() => Math.floor(Date.now() / 1000));
  const maxBodyBytes = deps.maxBodyBytes ?? DEFAULT_MAX_STT_BODY_BYTES;
  const shouldAwaitFinalize = deps.awaitFinalize ?? false;

  function runInBackground(promise: Promise<unknown>): void {
    if (deps.waitUntil) {
      deps.waitUntil(promise);
    } else {
      promise.catch((err) => console.error('[agent-stt] Background task failed:', err));
    }
  }

  async function finalizeSttUsageSafe(
    db: AgentAiClient,
    usageLogId: number | undefined,
    status: 'completed' | 'failed',
    audioSeconds = 0
  ) {
    if (!usageLogId) return;
    try {
      await db.rpc('finalize_agent_stt_usage', {
        p_usage_log_id: usageLogId,
        p_status: status,
        p_audio_seconds: Math.max(0, audioSeconds),
      });
    } catch (err) {
      console.error('[agent-stt] Failed to finalize STT usage log:', err);
    }
  }

  async function persistSttUsageFinalize(
    db: AgentAiClient,
    usageLogId: number | undefined,
    status: 'completed' | 'failed',
    audioSeconds = 0
  ) {
    const p = finalizeSttUsageSafe(db, usageLogId, status, audioSeconds);
    if (shouldAwaitFinalize) {
      await p;
    } else {
      runInBackground(p);
    }
  }

  const productCache = new Map<string, { id: string; slug: string; expiresAt: number }>();

  return async function handleRequest(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(req.url);
    const supabaseUrl = (deps.getEnv('SUPABASE_URL') || '').trim();
    const rawServiceKey = (deps.getEnv('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
    const serviceRoleKey = rawServiceKey.includes('YOUR_') ? '' : rawServiceKey;
    const groqKey = (deps.getEnv('GROQ_API_KEY') || '').trim();
    const leaseSecret = (deps.getEnv('LICENSE_ENCRYPTION_KEY') || deps.getEnv('CRON_SECRET') || '').trim();

    if (req.method === 'GET' && isHealthPath(url.pathname)) {
      return jsonResponse({
        ok: true,
        service: 'norvi-agent-stt',
        runtime: 'netlify',
        configured: Boolean(supabaseUrl && serviceRoleKey && groqKey && leaseSecret),
      });
    }

    const isConfig = req.method === 'GET' && isConfigPath(url.pathname);
    const isTranscribe = req.method === 'POST' && isTranscriptionsPath(url.pathname);

    if (!isConfig && !isTranscribe) {
      return jsonResponse({ error: 'Not found.' }, 404);
    }

    if (!supabaseUrl || !serviceRoleKey || !leaseSecret) {
      return jsonResponse({ error: 'Speech service is not configured.' }, 503);
    }

    // 1. Verify NORVI Lease JWT
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing or invalid authorization token.' }, 401);
    }
    const token = authHeader.slice(7).trim();
    if (!token) {
      return jsonResponse({ error: 'Missing authorization token.' }, 401);
    }

    const verified = await verifyNorviLeaseJwt(token, leaseSecret, nowSeconds());
    if (!verified.ok) {
      return jsonResponse(
        { error: verified.error, ...(verified.expired ? { expired: true } : {}) },
        verified.status
      );
    }

    const lease = verified.payload;

    // 2. Enforce Hardware Device & Product Integrity
    const headerDevice = (req.headers.get('x-norvi-device') || '').trim();
    if (!headerDevice) {
      return jsonResponse({ error: 'Missing device identifier header (X-Norvi-Device).' }, 400);
    }
    const leaseDeviceId = (lease.device_id || lease.sub || '').trim();
    if (leaseDeviceId && leaseDeviceId !== headerDevice) {
      return jsonResponse({ error: 'Device mismatch for active license lease.' }, 403);
    }

    const headerProduct = (req.headers.get('x-norvi-product') || '').trim().toLowerCase();
    if (headerProduct && lease.product && headerProduct !== lease.product.toLowerCase()) {
      return jsonResponse({ error: 'Product mismatch for active license lease.' }, 403);
    }

    // 3. Resolve Product ID
    const db = deps.createServiceClient(supabaseUrl, serviceRoleKey);
    const productLookupCol = lease.product ? 'slug' : 'id';
    const productLookupVal = lease.product ? lease.product : String(lease.product_id);
    const cacheKey = `${productLookupCol}:${productLookupVal}`;
    const nowMs = nowSeconds() * 1000;
    let product = productCache.get(cacheKey);
    if (!product || product.expiresAt <= nowMs) {
      const { data: fetchedProduct, error: prodErr } = await db
        .from('products')
        .select('id, slug')
        .eq(productLookupCol, productLookupVal)
        .single();

      if (prodErr || !fetchedProduct?.id) {
        return jsonResponse({ error: 'Agent product is unavailable.' }, 403);
      }
      product = {
        id: fetchedProduct.id,
        slug: fetchedProduct.slug,
        expiresAt: nowMs + 5 * 60 * 1000,
      };
      productCache.set(cacheKey, product);
    }
    if (headerProduct && product.slug && headerProduct !== String(product.slug).toLowerCase()) {
      return jsonResponse({ error: 'Product mismatch for active license lease.' }, 403);
    }

    // 4. Handle GET /api/agent-stt/config
    if (isConfig) {
      const { data: policyRaw, error: policyErr } = await db.rpc('get_agent_stt_policy', {
        p_license_id: lease.license_id,
        p_product_id: product.id,
        p_device_id: headerDevice,
      });

      if (policyErr || !policyRaw) {
        return jsonResponse({ error: 'Could not verify speech policy.' }, 503);
      }

      if (!policyRaw.allowed) {
        return jsonResponse({ error: policyRaw.error || 'Access denied.' }, policyRaw.status_code || 403);
      }

      return jsonResponse({
        ok: true,
        stt_model: policyRaw.stt_model || 'whisper-large-v3-turbo',
        fallback_enabled: Boolean(policyRaw.fallback_enabled),
      });
    }

    // 5. Handle POST /api/agent-stt/v1/audio/transcriptions
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return jsonResponse({ error: 'Request content-type must be multipart/form-data.' }, 400);
    }

    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > maxBodyBytes) {
      return jsonResponse({ error: 'Audio payload must be smaller than 5.5 MB.' }, 413);
    }

    if (!groqKey) {
      return jsonResponse({ error: 'Cloud speech fallback is temporarily unavailable.' }, 503);
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return jsonResponse({ error: 'Failed to parse multipart audio form data.' }, 400);
    }

    const file = formData.get('file');
    if (!file || typeof file === 'string' || !(file instanceof Blob) || file.size === 0) {
      return jsonResponse({ error: 'An audio file upload is required.' }, 400);
    }

    if (file.size > maxBodyBytes) {
      return jsonResponse({ error: 'Audio payload must be smaller than 5.5 MB.' }, 413);
    }

    // 6. Check STT Quota & Resolve Admin-Configured Model
    const { data: quotaRaw, error: quotaErr } = await db.rpc('consume_agent_stt_quota', {
      p_license_id: lease.license_id,
      p_product_id: product.id,
      p_device_id: headerDevice,
      p_audio_bytes: file.size,
    });

    if (quotaErr || !quotaRaw) {
      return jsonResponse({ error: 'Could not verify speech usage policy.' }, 503);
    }

    if (!quotaRaw.allowed) {
      return jsonResponse(
        { error: quotaRaw.error || 'Access denied.' },
        quotaRaw.status_code || 403
      );
    }

    const usageLogId = quotaRaw.usage_log_id;
    const activeModel = quotaRaw.stt_model || 'whisper-large-v3-turbo';

    // 7. Construct Outbound FormData to Groq (Strictly locking model to activeModel)
    const outboundForm = new FormData();
    outboundForm.append('file', file, (file as File).name || 'audio.wav');
    outboundForm.append('model', activeModel);

    const allowedFormats = ['json', 'verbose_json', 'text'];
    const clientFormat = formData.get('response_format');
    if (typeof clientFormat === 'string' && allowedFormats.includes(clientFormat.trim())) {
      outboundForm.append('response_format', clientFormat.trim());
    } else {
      outboundForm.append('response_format', 'verbose_json');
    }

    const clientLang = formData.get('language');
    if (typeof clientLang === 'string' && clientLang.trim() && /^[a-z]{2,5}$/i.test(clientLang.trim())) {
      outboundForm.append('language', clientLang.trim().toLowerCase());
    }

    const clientTemp = formData.get('temperature');
    if (typeof clientTemp === 'string' && clientTemp.trim()) {
      const tempNum = parseFloat(clientTemp);
      if (!Number.isNaN(tempNum) && tempNum >= 0 && tempNum <= 1) {
        outboundForm.append('temperature', String(tempNum));
      }
    }

    const clientPrompt = formData.get('prompt');
    if (typeof clientPrompt === 'string' && clientPrompt.trim()) {
      outboundForm.append('prompt', clientPrompt.trim().slice(0, 500));
    }

    // 8. Forward to Groq Cloud API
    let groqResp: Response;
    try {
      groqResp = await fetchImpl(GROQ_TRANSCRIPTIONS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
        },
        body: outboundForm,
      });
    } catch (err: any) {
      await persistSttUsageFinalize(db, usageLogId, 'failed', 0);
      return jsonResponse({ error: 'Failed to reach cloud speech transcription provider.' }, 502);
    }

    if (!groqResp.ok) {
      await persistSttUsageFinalize(db, usageLogId, 'failed', 0);
      const errText = await groqResp.text().catch(() => '');
      return jsonResponse(
        { error: 'Speech transcription failed from provider: ' + (errText.slice(0, 200) || groqResp.statusText) },
        groqResp.status >= 500 ? 502 : groqResp.status
      );
    }

    const respText = await groqResp.text();
    let audioSecs = 0;
    try {
      const parsed = JSON.parse(respText);
      if (typeof parsed?.duration === 'number' && parsed.duration > 0) {
        audioSecs = parsed.duration;
      }
    } catch {
      // If response was plain text format or duration was absent, default audioSecs to 0
    }

    await persistSttUsageFinalize(db, usageLogId, 'completed', audioSecs);

    return new Response(respText, {
      status: groqResp.status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': groqResp.headers.get('content-type') || 'application/json',
      },
    });
  };
}
