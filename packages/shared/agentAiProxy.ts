export type AgentAiClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (col: string, val: unknown) => {
        single: () => Promise<{ data: any; error: any }>;
      };
    };
  };
  rpc: (fn: string, params?: Record<string, unknown>) => Promise<{ data: any; error: any }>;
};

export type AgentAiHandlerDeps = {
  getEnv: (key: string) => string | undefined;
  createServiceClient: (supabaseUrl: string, serviceRoleKey: string) => AgentAiClient;
  fetchImpl?: typeof fetch;
  waitUntil?: (promise: Promise<unknown>) => void;
  awaitFinalize?: boolean;
  maxBodyBytes?: number;
  maxImageBase64Chars?: number;
  nowSeconds?: () => number;
};

type LeasePayload = {
  license_id: string;
  device_id?: string;
  sub?: string;
  exp: number;
  product?: string;
  product_id?: string;
};

type QuotaConsumeResult = {
  allowed: boolean;
  status_code?: number;
  reason?: string;
  error?: string;
  usage_log_id?: number;
  model?: string;
  sort?: 'latency' | 'price';
  max_input_chars?: number;
  max_output_tokens?: number;
  enforce_zdr?: boolean;
  allow_vision?: boolean;
};

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const DEFAULT_MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB (safely inside Netlify's 6 MB limit)
export const DEFAULT_MAX_IMAGE_BASE64_CHARS = 3_500_000; // ~2.6 MB raw image cap across request
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-norvi-device, x-norvi-task, x-norvi-product, apikey',
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

function base64UrlToUint8Array(input: string): Uint8Array {
  let b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  b64 += '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

function decodeBase64UrlJson<T>(segment: string): T {
  const bytes = base64UrlToUint8Array(segment);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text) as T;
}

export async function verifyNorviLeaseJwt(
  token: string,
  secret: string,
  nowSec: number
): Promise<{ ok: true; payload: LeasePayload } | { ok: false; status: number; error: string; expired?: boolean }> {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return { ok: false, status: 401, error: 'Invalid lease token format.' };
  }

  let header: { alg?: string };
  try {
    header = decodeBase64UrlJson<{ alg?: string }>(parts[0]);
  } catch {
    return { ok: false, status: 401, error: 'Invalid lease token header.' };
  }

  if (header.alg !== 'HS256') {
    return { ok: false, status: 401, error: 'Unsupported lease token algorithm.' };
  }

  const encoder = new TextEncoder();
  const signatureData = `${parts[0]}.${parts[1]}`;

  try {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const sigBytes = base64UrlToUint8Array(parts[2]);
    const valid = await crypto.subtle.verify(
      'HMAC',
      cryptoKey,
      sigBytes as unknown as BufferSource,
      encoder.encode(signatureData)
    );
    if (!valid) {
      return { ok: false, status: 401, error: 'Invalid or forged lease token.' };
    }
  } catch {
    return { ok: false, status: 401, error: 'Invalid lease token signature.' };
  }

  let payload: LeasePayload;
  try {
    payload = decodeBase64UrlJson<LeasePayload>(parts[1]);
  } catch {
    return { ok: false, status: 401, error: 'Invalid lease token payload.' };
  }

  if (!payload.license_id || !UUID_RE.test(String(payload.license_id))) {
    return { ok: false, status: 401, error: 'Lease token missing valid license_id.' };
  }

  const hasProductSlug = typeof payload.product === 'string' && payload.product.trim().length > 0;
  const hasProductId = typeof payload.product_id === 'string' && UUID_RE.test(payload.product_id.trim());
  if (!hasProductSlug && !hasProductId) {
    return { ok: false, status: 401, error: 'Lease token missing product.' };
  }

  if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
    return { ok: false, status: 401, error: 'Lease token missing expiration.' };
  }

  if (nowSec >= payload.exp) {
    return {
      ok: false,
      status: 401,
      error: 'License lease has expired. Please authenticate again.',
      expired: true,
    };
  }

  return { ok: true, payload };
}

function inspectAndSanitizeMessages(
  rawMessages: unknown,
  allowVision: boolean
): {
  ok: true;
  messages: any[];
  textChars: number;
  imageChars: number;
} | { ok: false; error: string } {
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return { ok: false, error: 'messages must be a non-empty array.' };
  }

  let textChars = 0;
  let imageChars = 0;
  const sanitized: any[] = [];

  for (const msg of rawMessages) {
    if (!msg || typeof msg !== 'object') {
      return { ok: false, error: 'Each message must be an object.' };
    }
    const role = typeof msg.role === 'string' ? msg.role : '';
    if (!['system', 'user', 'assistant', 'tool'].includes(role)) {
      return { ok: false, error: `Unsupported message role: ${role || 'empty'}` };
    }

    if (typeof msg.content === 'string') {
      textChars += msg.content.length;
      sanitized.push({ role, content: msg.content });
      continue;
    }

    if (Array.isArray(msg.content)) {
      const parts: any[] = [];
      for (const part of msg.content) {
        if (!part || typeof part !== 'object') continue;
        if (part.type === 'text' && typeof part.text === 'string') {
          textChars += part.text.length;
          parts.push({ type: 'text', text: part.text });
        } else if (part.type === 'image_url' && part.image_url && typeof part.image_url.url === 'string') {
          if (allowVision) {
            imageChars += part.image_url.url.length;
            parts.push({
              type: 'image_url',
              image_url: { url: part.image_url.url },
            });
          }
        }
      }
      if (parts.length === 0) {
        parts.push({ type: 'text', text: '' });
      }
      sanitized.push({ role, content: parts });
      continue;
    }

    return { ok: false, error: 'Message content must be a string or content array.' };
  }

  return { ok: true, messages: sanitized, textChars, imageChars };
}

function extractUsageFromObject(data: any): {
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
} {
  const usage = data?.usage;
  if (!usage || typeof usage !== 'object') {
    return { promptTokens: 0, completionTokens: 0, costUsd: 0 };
  }
  const promptTokens = Math.max(0, Math.floor(Number(usage.prompt_tokens) || 0));
  const completionTokens = Math.max(0, Math.floor(Number(usage.completion_tokens) || 0));
  const costUsd = Math.max(0, Number(usage.cost) || 0);
  return { promptTokens, completionTokens, costUsd };
}

function normalizeRouteSuffix(pathname: string): string | null {
  const clean = pathname.replace(/\/+$/, '');
  const prefixes = ['/api/agent-ai', '/functions/v1/agent-ai', '/agent-ai'];
  for (const prefix of prefixes) {
    if (clean === prefix) return '';
    if (clean.startsWith(prefix + '/')) return clean.slice(prefix.length);
  }
  return null;
}

function isHealthPath(pathname: string): boolean {
  const suffix = normalizeRouteSuffix(pathname);
  return suffix === '' || suffix === '/health';
}

function isChatCompletionsPath(pathname: string): boolean {
  const suffix = normalizeRouteSuffix(pathname);
  return suffix === '' || suffix === '/v1/chat/completions' || suffix === '/chat/completions';
}

export function createAgentAiHandler(deps: AgentAiHandlerDeps) {
  const fetchFn = deps.fetchImpl ?? fetch;
  const shouldAwaitFinalize = deps.awaitFinalize ?? !deps.waitUntil;
  const runInBackground = deps.waitUntil ?? (p => { p.catch(() => {}); });
  const nowSeconds = deps.nowSeconds ?? (() => Math.floor(Date.now() / 1000));
  const maxBodyBytes = deps.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const maxImageBase64Chars = deps.maxImageBase64Chars ?? DEFAULT_MAX_IMAGE_BASE64_CHARS;

  async function finalizeUsageSafe(
    db: AgentAiClient,
    usageLogId: number | undefined,
    status: 'completed' | 'failed',
    promptTokens = 0,
    completionTokens = 0,
    costUsd = 0
  ) {
    if (!usageLogId) return;
    try {
      await db.rpc('finalize_agent_ai_usage', {
        p_usage_log_id: usageLogId,
        p_status: status,
        p_prompt_tokens: promptTokens,
        p_completion_tokens: completionTokens,
        p_estimated_cost_usd: costUsd,
      });
    } catch (err) {
      console.error('[agent-ai] Failed to finalize usage log:', err);
    }
  }

  async function persistUsageFinalize(
    db: AgentAiClient,
    usageLogId: number | undefined,
    status: 'completed' | 'failed',
    promptTokens = 0,
    completionTokens = 0,
    costUsd = 0
  ) {
    const p = finalizeUsageSafe(db, usageLogId, status, promptTokens, completionTokens, costUsd);
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
    const openRouterKey = (deps.getEnv('OPENROUTER_API_KEY') || '').trim();
    const leaseSecret = (deps.getEnv('LICENSE_ENCRYPTION_KEY') || deps.getEnv('CRON_SECRET') || '').trim();

    if (req.method === 'GET' && isHealthPath(url.pathname)) {
      return jsonResponse({
        ok: true,
        service: 'norvi-agent-ai',
        runtime: 'netlify',
        configured: Boolean(supabaseUrl && serviceRoleKey && openRouterKey && leaseSecret),
      });
    }

    if (req.method !== 'POST' || !isChatCompletionsPath(url.pathname)) {
      return jsonResponse({ error: 'Not found.' }, 404);
    }

    if (!supabaseUrl || !serviceRoleKey || !openRouterKey || !leaseSecret) {
      return jsonResponse({ error: 'AI proxy service is not configured.' }, 503);
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

    // 3. Enforce Request Body Ceiling & Parse JSON
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > maxBodyBytes) {
      return jsonResponse({ error: 'Request payload is too large.' }, 413);
    }

    let rawText: string;
    try {
      rawText = await req.text();
    } catch {
      return jsonResponse({ error: 'Failed to read request body.' }, 400);
    }

    if (new TextEncoder().encode(rawText).byteLength > maxBodyBytes) {
      return jsonResponse({ error: 'Request payload is too large.' }, 413);
    }

    let body: Record<string, any>;
    try {
      body = JSON.parse(rawText);
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return jsonResponse({ error: 'Request body must be a JSON object.' }, 400);
      }
    } catch {
      return jsonResponse({ error: 'Invalid JSON request body.' }, 400);
    }

    // Preliminary shape check before reserving quota
    const preCheck = inspectAndSanitizeMessages(body.messages, true);
    if (!preCheck.ok) {
      return jsonResponse({ error: preCheck.error }, 400);
    }
    if (preCheck.imageChars > maxImageBase64Chars) {
      return jsonResponse({ error: 'Attached image exceeds maximum allowed size.' }, 413);
    }

    // 4. Resolve Product & Atomic Hidden 1d/1w/1m Quota + Task Model
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

    const taskKey = (req.headers.get('x-norvi-task') || 'default').trim().toLowerCase() || 'default';

    const { data: quotaRaw, error: quotaErr } = await db.rpc('consume_agent_ai_quota', {
      p_license_id: lease.license_id,
      p_product_id: product.id,
      p_device_id: headerDevice,
      p_task_key: taskKey,
    });

    if (quotaErr || !quotaRaw) {
      return jsonResponse({ error: 'Could not verify AI usage policy.' }, 503);
    }

    const quota = quotaRaw as QuotaConsumeResult;
    if (!quota.allowed) {
      return jsonResponse(
        { error: quota.error || 'Access denied.' },
        quota.status_code || 403
      );
    }

    const usageLogId = quota.usage_log_id;

    // 5. Enforce Admin-Configured Input Size & Vision Capability
    const sanitized = inspectAndSanitizeMessages(body.messages, quota.allow_vision !== false);
    if (!sanitized.ok) {
      await persistUsageFinalize(db, usageLogId, 'failed');
      return jsonResponse({ error: sanitized.error }, 400);
    }

    const maxInputChars = quota.max_input_chars ?? 60000;
    if (sanitized.textChars > maxInputChars) {
      await persistUsageFinalize(db, usageLogId, 'failed');
      return jsonResponse({ error: 'Prompt text exceeds allowed length for this agent.' }, 413);
    }

    // 6. Build Locked OpenRouter Payload (Client model string is strictly ignored)
    const maxOutputTokens = quota.max_output_tokens ?? 2048;
    const requestedMaxTokens = Number(body.max_tokens);
    const finalMaxTokens =
      Number.isFinite(requestedMaxTokens) && requestedMaxTokens >= 64
        ? Math.min(Math.floor(requestedMaxTokens), maxOutputTokens)
        : maxOutputTokens;

    const isStream = Boolean(body.stream);
    const openRouterPayload: Record<string, unknown> = {
      model: quota.model || 'google/gemma-4-26b-a4b-it',
      messages: sanitized.messages,
      stream: isStream,
      max_tokens: finalMaxTokens,
      provider: {
        sort: quota.sort === 'price' ? 'price' : 'latency',
        ...(quota.enforce_zdr !== false ? { data_collection: 'deny' } : {}),
      },
    };

    if (typeof body.temperature === 'number' && Number.isFinite(body.temperature)) {
      openRouterPayload.temperature = Math.max(0, Math.min(2, body.temperature));
    }
    if (typeof body.top_p === 'number' && Number.isFinite(body.top_p)) {
      openRouterPayload.top_p = Math.max(0, Math.min(1, body.top_p));
    }
    if (body.response_format && typeof body.response_format === 'object') {
      openRouterPayload.response_format = body.response_format;
    }
    if (typeof body.stop === 'string' || Array.isArray(body.stop)) {
      openRouterPayload.stop = body.stop;
    }
    if (isStream) {
      openRouterPayload.stream_options = { include_usage: true };
    }

    const isRealtimeInterviewTask =
      taskKey === 'voice_text' || taskKey === 'coding' || taskKey === 'vision';
    let autoSuppressedReasoning = false;
    if (body.reasoning && typeof body.reasoning === 'object' && !Array.isArray(body.reasoning)) {
      openRouterPayload.reasoning = body.reasoning;
    } else if (isRealtimeInterviewTask && quota.sort !== 'price') {
      openRouterPayload.reasoning = { enabled: false };
      autoSuppressedReasoning = true;
    }

    // 7. Call OpenRouter
    const sendUpstream = () =>
      fetchFn(OPENROUTER_CHAT_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://nor-vi.in',
          'X-Title': `NORVI-${product.slug || lease.product || 'agent'}`,
        },
        body: JSON.stringify(openRouterPayload),
      });

    let upstreamRes: Response;
    try {
      upstreamRes = await sendUpstream();
    } catch {
      await persistUsageFinalize(db, usageLogId, 'failed');
      return jsonResponse({ error: 'Upstream AI service is temporarily unreachable. Please retry.' }, 502);
    }

    if (!upstreamRes.ok && upstreamRes.status === 400 && autoSuppressedReasoning) {
      let errPeek = '';
      try {
        errPeek = await upstreamRes.text();
      } catch {
        errPeek = '';
      }
      const lowerPeek = errPeek.toLowerCase();
      if (
        lowerPeek.includes('reason') ||
        lowerPeek.includes('unsupported') ||
        lowerPeek.includes('unknown') ||
        lowerPeek.includes('extra_forbidden')
      ) {
        delete openRouterPayload.reasoning;
        try {
          upstreamRes = await sendUpstream();
        } catch {
          await persistUsageFinalize(db, usageLogId, 'failed');
          return jsonResponse({ error: 'Upstream AI service is temporarily unreachable. Please retry.' }, 502);
        }
      } else {
        upstreamRes = new Response(errPeek, { status: 400, headers: upstreamRes.headers });
      }
    }

    if (!upstreamRes.ok) {
      let rawUpstreamErr = '';
      try {
        rawUpstreamErr = (await upstreamRes.text()).replaceAll(openRouterKey, '[REDACTED]');
      } catch {
        rawUpstreamErr = '';
      }
      console.error(
        `[agent-ai] OpenRouter error HTTP ${upstreamRes.status} for model=${openRouterPayload.model}:`,
        rawUpstreamErr.slice(0, 400)
      );
      await persistUsageFinalize(db, usageLogId, 'failed');
      if (upstreamRes.status === 429) {
        return jsonResponse({ error: 'AI service is temporarily busy. Please try again shortly.' }, 429);
      }
      if (upstreamRes.status === 402) {
        return jsonResponse({ error: 'OpenRouter credit check failed for the configured model.' }, 502);
      }
      if (upstreamRes.status === 404) {
        return jsonResponse({ error: 'No OpenRouter endpoints available for the configured model or data policy.' }, 502);
      }
      if (upstreamRes.status === 400) {
        return jsonResponse({ error: 'AI request could not be processed.' }, 400);
      }
      return jsonResponse({ error: 'Upstream AI service error. Please retry.' }, 502);
    }

    // 8a. Non-Streaming JSON Response (Nexus / Rolvio)
    if (!isStream) {
      let respText: string;
      try {
        respText = await upstreamRes.text();
      } catch {
        await persistUsageFinalize(db, usageLogId, 'failed');
        return jsonResponse({ error: 'Failed to read AI response.' }, 502);
      }

      try {
        const parsed = JSON.parse(respText);
        const { promptTokens, completionTokens, costUsd } = extractUsageFromObject(parsed);
        await persistUsageFinalize(db, usageLogId, 'completed', promptTokens, completionTokens, costUsd);
      } catch {
        await persistUsageFinalize(db, usageLogId, 'failed');
        return jsonResponse({ error: 'Invalid response received from AI provider.' }, 502);
      }

      return new Response(respText, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
        },
      });
    }

    // 8b. Streaming SSE Response (Voro) — zero-buffer pass-through with final usage extraction
    if (!upstreamRes.body) {
      await persistUsageFinalize(db, usageLogId, 'failed');
      return jsonResponse({ error: 'Streaming response missing body.' }, 502);
    }

    const decoder = new TextDecoder();
    let sseRemainder = '';
    let promptTokens = 0;
    let completionTokens = 0;
    let costUsd = 0;
    let sawContentOrDone = false;
    let finalized = false;

    const finalizeStreamOnce = () => {
      if (finalized) return Promise.resolve();
      finalized = true;
      return persistUsageFinalize(
        db,
        usageLogId,
        sawContentOrDone ? 'completed' : 'failed',
        promptTokens,
        completionTokens,
        costUsd
      );
    };

    const inspectSseText = (chunkText: string) => {
      sseRemainder += chunkText;
      const lines = sseRemainder.split('\n');
      sseRemainder = lines.pop() ?? '';
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const payloadStr = line.slice(5).trim();
        if (!payloadStr || payloadStr === '[DONE]') {
          if (payloadStr === '[DONE]') sawContentOrDone = true;
          continue;
        }
        try {
          const obj = JSON.parse(payloadStr);
          if (Array.isArray(obj.choices) && obj.choices.length > 0) {
            sawContentOrDone = true;
          }
          if (obj.usage) {
            const u = extractUsageFromObject(obj);
            promptTokens = u.promptTokens;
            completionTokens = u.completionTokens;
            costUsd = u.costUsd;
          }
        } catch {
          // Ignore partial or non-JSON comment frames
        }
      }
    };

    const transform = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        inspectSseText(decoder.decode(chunk, { stream: true }));
        controller.enqueue(chunk);
      },
      async flush() {
        const trailing = decoder.decode();
        if (trailing) inspectSseText(trailing);
        if (sseRemainder.trim()) inspectSseText('\n');
        await finalizeStreamOnce();
      },
      cancel() {
        void finalizeStreamOnce();
      },
    } as Transformer<Uint8Array, Uint8Array> & { cancel?: () => void });

    const pipedStream = upstreamRes.body.pipeThrough(transform);
    return new Response(pipedStream, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  };
}
