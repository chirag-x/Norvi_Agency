export type AgentAiSortMode = 'latency' | 'price';

export type AgentAiTaskModel = {
  task_key: string;
  label: string;
  model: string;
  sort: AgentAiSortMode;
  max_output_tokens: number;
  allow_vision: boolean;
};

export type AgentAiPolicyStats = {
  requests24h: number;
  requests7d: number;
  requests30d: number;
  cost30dUsd: number;
};

export type AgentAiPolicyInput = {
  aiEnabled: boolean;
  defaultModel: string;
  taskModels: AgentAiTaskModel[];
  dailyLimit: number;
  weeklyLimit: number;
  monthlyLimit: number;
  trialDailyLimit: number;
  maxInputChars: number;
  maxOutputTokens: number;
  enforceZdr: boolean;
};

export type AgentAiPolicy = AgentAiPolicyInput & {
  productId: string;
  slug: string;
  name: string;
  updatedAt?: string | null;
  stats: AgentAiPolicyStats;
};

export const OPENROUTER_MODEL_PRESETS = [
  { id: 'google/gemma-4-26b-a4b-it', label: 'Gemma 4 26B A4B MoE (Fast, Low Cost, Vision)' },
  { id: 'google/gemma-4-31b-it', label: 'Gemma 4 31B Dense (High Precision Coding/Vision)' },
  { id: 'qwen/qwen3.5-flash-02-23', label: 'Qwen3.5 Flash (1M Context, Very Low Cost, Vision)' },
  { id: 'openai/gpt-5-nano', label: 'GPT-5 Nano (Ultra-Fast JSON/Routing, Vision)' },
  { id: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite (1M Context, Multimodal)' },
] as const;

export const DEFAULT_AGENT_TASKS_BY_SLUG: Record<string, AgentAiTaskModel[]> = {
  voro: [
    {
      task_key: 'voice_text',
      label: 'Voro Voice / Interview Q&A Text',
      model: 'google/gemma-4-26b-a4b-it',
      sort: 'latency',
      max_output_tokens: 1800,
      allow_vision: false,
    },
    {
      task_key: 'coding',
      label: 'Voro Live Coding / Algorithms',
      model: 'google/gemma-4-31b-it',
      sort: 'latency',
      max_output_tokens: 2200,
      allow_vision: false,
    },
    {
      task_key: 'vision',
      label: 'Voro Screen Vision / Screenshot OCR',
      model: 'google/gemma-4-31b-it',
      sort: 'latency',
      max_output_tokens: 2200,
      allow_vision: true,
    },
  ],
  nexus: [
    {
      task_key: 'clip_analysis',
      label: 'Nexus Long Transcript Clip Analysis',
      model: 'google/gemma-4-26b-a4b-it',
      sort: 'price',
      max_output_tokens: 4096,
      allow_vision: false,
    },
    {
      task_key: 'social_copy',
      label: 'Nexus Titles, Captions & Hashtags',
      model: 'google/gemma-4-26b-a4b-it',
      sort: 'price',
      max_output_tokens: 1024,
      allow_vision: false,
    },
  ],
  rolvio: [
    {
      task_key: 'job_match',
      label: 'Rolvio ATS Job Match Scoring',
      model: 'google/gemma-4-26b-a4b-it',
      sort: 'price',
      max_output_tokens: 1024,
      allow_vision: false,
    },
    {
      task_key: 'form_answer',
      label: 'Rolvio Screening Form Answers',
      model: 'google/gemma-4-26b-a4b-it',
      sort: 'price',
      max_output_tokens: 1024,
      allow_vision: false,
    },
    {
      task_key: 'email_classify',
      label: 'Rolvio Recruiter Email Classifier',
      model: 'google/gemma-4-26b-a4b-it',
      sort: 'price',
      max_output_tokens: 256,
      allow_vision: false,
    },
    {
      task_key: 'resume_parse',
      label: 'Rolvio Resume Parser',
      model: 'google/gemma-4-26b-a4b-it',
      sort: 'price',
      max_output_tokens: 2048,
      allow_vision: false,
    },
  ],
};

export function createDefaultAgentAiPolicy(product: { id: string; slug: string; name: string }): AgentAiPolicy {
  const slug = (product.slug || '').toLowerCase();
  const starterTasks = DEFAULT_AGENT_TASKS_BY_SLUG[slug] || [];
  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    aiEnabled: true,
    defaultModel: 'google/gemma-4-26b-a4b-it',
    taskModels: starterTasks.map(t => ({ ...t })),
    dailyLimit: 0,
    weeklyLimit: 0,
    monthlyLimit: 0,
    trialDailyLimit: 0,
    maxInputChars: slug === 'nexus' ? 180000 : slug === 'rolvio' ? 80000 : 60000,
    maxOutputTokens: slug === 'nexus' ? 4096 : 2048,
    enforceZdr: true,
    updatedAt: null,
    stats: { requests24h: 0, requests7d: 0, requests30d: 0, cost30dUsd: 0 },
  };
}

function parseNonNegInt(value: unknown, label: string, max: number): { ok: true; value: number } | { ok: false; error: string } {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0 || num > max) {
    return { ok: false, error: `${label} must be a whole number between 0 and ${max.toLocaleString()}.` };
  }
  return { ok: true, value: num };
}

export function normalizeAgentAiPolicyPayload(
  raw: unknown
): { ok: true; data: AgentAiPolicyInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'AI policy payload must be an object.' };
  }
  const obj = raw as Record<string, unknown>;

  const defaultModel = typeof obj.defaultModel === 'string' ? obj.defaultModel.trim() : '';
  if (!defaultModel || defaultModel.length > 160 || /\s/.test(defaultModel)) {
    return { ok: false, error: 'Default OpenRouter model ID must be a non-empty model slug without spaces (e.g. google/gemma-4-26b-a4b-it).' };
  }

  const daily = parseNonNegInt(obj.dailyLimit ?? 0, '1-Day limit', 1_000_000);
  if (!daily.ok) return daily;
  const weekly = parseNonNegInt(obj.weeklyLimit ?? 0, '1-Week limit', 10_000_000);
  if (!weekly.ok) return weekly;
  const monthly = parseNonNegInt(obj.monthlyLimit ?? 0, '1-Month limit', 100_000_000);
  if (!monthly.ok) return monthly;
  const trialDaily = parseNonNegInt(obj.trialDailyLimit ?? 0, 'Trial 1-Day limit', 1_000_000);
  if (!trialDaily.ok) return trialDaily;

  const maxInputChars = Number(obj.maxInputChars ?? 60000);
  if (!Number.isInteger(maxInputChars) || maxInputChars < 1000 || maxInputChars > 2_000_000) {
    return { ok: false, error: 'Max input characters must be an integer between 1,000 and 2,000,000.' };
  }

  const maxOutputTokens = Number(obj.maxOutputTokens ?? 2048);
  if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 64 || maxOutputTokens > 32768) {
    return { ok: false, error: 'Max output tokens must be an integer between 64 and 32,768.' };
  }

  const rawTasks = obj.taskModels ?? [];
  if (!Array.isArray(rawTasks) || rawTasks.length > 30) {
    return { ok: false, error: 'Task models must be a list of up to 30 entries.' };
  }

  const seenKeys = new Set<string>();
  const taskModels: AgentAiTaskModel[] = [];

  for (let i = 0; i < rawTasks.length; i++) {
    const item = rawTasks[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, error: `Task row #${i + 1} is invalid.` };
    }
    const row = item as Record<string, unknown>;
    const taskKeyRaw = typeof row.task_key === 'string' ? row.task_key : typeof row.taskKey === 'string' ? row.taskKey : '';
    const taskKey = taskKeyRaw.trim().toLowerCase();
    if (!taskKey || !/^[a-z0-9_.-]{1,64}$/.test(taskKey)) {
      return { ok: false, error: `Task row #${i + 1} key must be 1–64 characters using letters, numbers, _, ., or -.` };
    }
    if (seenKeys.has(taskKey)) {
      return { ok: false, error: `Duplicate task key "${taskKey}". Each task key must be unique per agent.` };
    }
    seenKeys.add(taskKey);

    const model = typeof row.model === 'string' ? row.model.trim() : '';
    if (!model || model.length > 160 || /\s/.test(model)) {
      return { ok: false, error: `Task "${taskKey}" requires a valid OpenRouter model ID without spaces.` };
    }

    const label = (typeof row.label === 'string' ? row.label.trim() : '') || taskKey;
    if (label.length > 120) {
      return { ok: false, error: `Task "${taskKey}" label must be 120 characters or fewer.` };
    }

    const sortRaw = typeof row.sort === 'string' ? row.sort.trim().toLowerCase() : 'latency';
    const sort: AgentAiSortMode = sortRaw === 'price' ? 'price' : 'latency';

    const rowMaxOut = Number(row.max_output_tokens ?? row.maxOutputTokens ?? maxOutputTokens);
    if (!Number.isInteger(rowMaxOut) || rowMaxOut < 64 || rowMaxOut > 32768) {
      return { ok: false, error: `Task "${taskKey}" max output tokens must be between 64 and 32,768.` };
    }

    const allowVision = Boolean(row.allow_vision ?? row.allowVision ?? false);

    taskModels.push({
      task_key: taskKey,
      label,
      model,
      sort,
      max_output_tokens: rowMaxOut,
      allow_vision: allowVision,
    });
  }

  return {
    ok: true,
    data: {
      aiEnabled: obj.aiEnabled !== false,
      defaultModel,
      taskModels,
      dailyLimit: daily.value,
      weeklyLimit: weekly.value,
      monthlyLimit: monthly.value,
      trialDailyLimit: trialDaily.value,
      maxInputChars,
      maxOutputTokens,
      enforceZdr: obj.enforceZdr !== false,
    },
  };
}
