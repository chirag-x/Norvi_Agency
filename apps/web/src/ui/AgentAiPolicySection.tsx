import { useState } from 'react';
import { Bot, Check, KeyRound, Mic, Plus, ShieldCheck, Sparkles, Trash2, Eye, FileText } from 'lucide-react';
import {
  GROQ_STT_MODEL_PRESETS,
  OPENROUTER_MODEL_PRESETS,
  type AgentAiPolicy,
  type AgentAiSortMode,
  type AgentAiTaskModel,
} from '../../../../packages/shared/agentAi';
import { Field, Notice } from './common';

export function AgentAiPolicySection({
  productId,
  productName,
  policy,
  onChange,
  onSavePolicy,
  saving,
  feedback,
  availableKeys,
  variant = 'all',
}: {
  productId: string;
  productName: string;
  policy: AgentAiPolicy;
  onChange: (next: AgentAiPolicy) => void;
  onSavePolicy: () => Promise<void>;
  saving: boolean;
  feedback?: string;
  availableKeys?: Array<{ id: string; provider?: string; label: string; key_suffix: string; is_active: boolean }>;
  variant?: 'all' | 'openrouter' | 'groq';
}) {
  const [activeTier, setActiveTier] = useState<'paid' | 'trial'>('paid');
  const [sttActiveTier, setSttActiveTier] = useState<'paid' | 'trial'>('paid');

  const openRouterKeys = (availableKeys || []).filter(k => (k as any).provider !== 'groq');
  const groqKeys = (availableKeys || []).filter(k => (k as any).provider === 'groq');

  const usesFreeModel =
    policy.defaultModel.trim().endsWith(':free') ||
    policy.defaultModel.trim() === 'openrouter/free' ||
    policy.taskModels.some(t => t.model.trim().endsWith(':free') || t.model.trim() === 'openrouter/free');

  const trialModel = (policy.trialDefaultModel || '').toLowerCase();
  const trialUsesFreeModel = trialModel.includes(':free') || trialModel.startsWith('openrouter/free');
  const trialHasVision =
    trialModel.includes('vision') ||
    trialModel.includes('omni') ||
    trialModel.includes('gemma-4') ||
    trialModel.includes('gemini') ||
    trialModel.includes('gpt-4') ||
    trialModel.includes('qwen');

  const datalistId = `openrouter-presets-${productId}`;
  const sttDatalistId = `groq-stt-presets-${productId}`;

  const updateTask = (index: number, patch: Partial<AgentAiTaskModel>) => {
    const nextTasks = policy.taskModels.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange({ ...policy, taskModels: nextTasks });
  };

  const addTask = () => {
    const nextIndex = policy.taskModels.length + 1;
    const existingKeys = new Set(policy.taskModels.map(t => t.task_key.toLowerCase()));
    let candidate = `task_${nextIndex}`;
    let counter = nextIndex;
    while (existingKeys.has(candidate)) {
      counter += 1;
      candidate = `task_${counter}`;
    }
    const newRow: AgentAiTaskModel = {
      task_key: candidate,
      label: `${productName} Task ${counter}`,
      model: policy.defaultModel || 'google/gemma-4-26b-a4b-it',
      sort: 'latency',
      max_output_tokens: policy.maxOutputTokens || 2048,
      allow_vision: false,
    };
    onChange({ ...policy, taskModels: [...policy.taskModels, newRow] });
  };

  const removeTask = (index: number) => {
    const nextTasks = policy.taskModels.filter((_, i) => i !== index);
    onChange({ ...policy, taskModels: nextTasks });
  };

  const applyDefaultToAllTasks = () => {
    const def = policy.defaultModel.trim();
    if (!def) return;
    const nextTasks = policy.taskModels.map(t => ({ ...t, model: def }));
    onChange({ ...policy, taskModels: nextTasks });
  };

  return (
    <div
      style={{
        marginTop: variant === 'all' ? '1.25rem' : 0,
        padding: variant === 'all' ? '1.25rem' : 0,
        borderRadius: '10px',
        border: variant === 'all' ? '1px solid var(--line)' : 'none',
        background: variant === 'all' ? '#161c13' : 'transparent',
      }}
    >
      <datalist id={datalistId}>
        {OPENROUTER_MODEL_PRESETS.map(p => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </datalist>

      <datalist id={sttDatalistId}>
        {GROQ_STT_MODEL_PRESETS.map(p => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </datalist>

      {variant !== 'groq' && (
        <>
          {/* Header with Title and Dual-Tier Analytics Pills */}
          <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Bot size={18} className="accent" />
            <h4 style={{ margin: 0, fontSize: '1rem' }}>OpenRouter Cloud AI Models &amp; Hidden Limits</h4>
            <span className="badge good">
              <ShieldCheck size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Hidden from Users
            </span>
          </div>
          <p className="small-note" style={{ marginTop: '6px' }}>
            Configure exact OpenRouter model slugs per task (current &amp; future agents) and server-only per-license caps. Never exposed on public pages or desktop apps.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span className="badge" title="Admin-only usage metrics across paid licenses">
            👑 Paid 24h: {policy.stats.requests24hPaid ?? policy.stats.requests24h} reqs (~${Number((policy.stats.cost30dUsdPaid ?? policy.stats.cost30dUsd) || 0).toFixed(4)})
          </span>
          <span className="badge" style={{ background: '#1c2419', borderColor: '#2f4228' }} title="Admin-only usage metrics across free trial licenses">
            🎁 Trial 24h: {policy.stats.requests24hTrial ?? 0} reqs (~${Number(policy.stats.cost30dUsdTrial || 0).toFixed(4)})
          </span>
          <span className="badge" title="Admin-only STT fallback usage metrics across all licenses">
            STT 24h: {policy.stats.sttRequests24h ?? 0} reqs (~{Number(policy.stats.sttMinutes30d ?? 0).toFixed(1)}m)
          </span>
          <button
            type="button"
            className="button primary small"
            disabled={saving}
            onClick={onSavePolicy}
          >
            {saving ? 'Saving AI...' : 'Save AI Models & Limits'}
            <Check size={14} />
          </button>
        </div>
      </div>

      {feedback && (
        <div style={{ marginBottom: '1rem' }}>
          <Notice kind={feedback.startsWith('Error') ? 'error' : 'success'}>
            {feedback}
          </Notice>
        </div>
      )}

      {/* Tier Switcher Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '1.25rem',
          borderBottom: '1px solid var(--line)',
          paddingBottom: '0.75rem',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTier('paid')}
          style={{
            padding: '7px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            border: activeTier === 'paid' ? '1px solid var(--lime, #98e038)' : '1px solid var(--line)',
            background: activeTier === 'paid' ? 'rgba(152, 224, 56, 0.12)' : 'transparent',
            color: activeTier === 'paid' ? 'var(--lime, #98e038)' : 'var(--muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          👑 Paid Customer Tier
        </button>
        <button
          type="button"
          onClick={() => setActiveTier('trial')}
          style={{
            padding: '7px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            border: activeTier === 'trial' ? '1px solid #60a5fa' : '1px solid var(--line)',
            background: activeTier === 'trial' ? 'rgba(96, 165, 250, 0.12)' : 'transparent',
            color: activeTier === 'trial' ? '#60a5fa' : 'var(--muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          🎁 Free Trial Tier
        </button>
      </div>

      {/* 👑 PAID CUSTOMER TIER VIEW */}
      {activeTier === 'paid' && (
        <>
          <div className="form-grid">
            <Field label="Cloud AI Kill Switch" hint="Pause or allow OpenRouter cloud calls for this agent">
              <select
                value={policy.aiEnabled ? 'enabled' : 'paused'}
                onChange={e => onChange({ ...policy, aiEnabled: e.target.value === 'enabled' })}
              >
                <option value="enabled">Enabled (Active for valid licenses)</option>
                <option value="paused">Paused (Temporarily disable cloud AI)</option>
              </select>
            </Field>

            <Field
              label="Default Fallback OpenRouter Model"
              hint="Used if a task slot is missing or for future generic calls"
            >
              <input
                list={datalistId}
                value={policy.defaultModel}
                onChange={e => onChange({ ...policy, defaultModel: e.target.value })}
                placeholder="e.g. google/gemma-4-26b-a4b-it"
              />
            </Field>

            <Field
              label="Upstream OpenRouter API Key (Paid)"
              hint="Dedicated key for paying customers or inherit the global active key"
            >
              <select
                value={policy.aiKeyId || ''}
                onChange={e => onChange({ ...policy, aiKeyId: e.target.value || null })}
                style={{
                  borderColor: policy.aiKeyId ? 'var(--lime, #98e038)' : undefined,
                }}
              >
                <option value="">🌐 Default (Inherit Global Active Key)</option>
                {openRouterKeys.map(k => (
                  <option key={k.id} value={k.id}>
                    🔑 {k.label} ({k.key_suffix}) {k.is_active ? '— [Active Global Default]' : ''}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <h5 style={{ margin: '1rem 0 0.25rem 0', fontSize: '0.9rem' }}>
            Hidden Per-License Usage Limits (0 = Unlimited)
          </h5>
          <p className="small-note" style={{ marginBottom: '0.5rem' }}>
            Enforced silently by your backend proxy per license key. Customers never see these numbers.
          </p>

          <div className="form-grid">
            <Field label="1-Day Limit (24h)" hint="Max uses per license every 24 hours (0 = unlimited)">
              <input
                type="number"
                min={0}
                value={policy.dailyLimit}
                onChange={e => onChange({ ...policy, dailyLimit: Math.max(0, parseInt(e.target.value || '0', 10) || 0) })}
              />
            </Field>

            <Field label="1-Week Limit (7 Days)" hint="Max uses per license in rolling 7 days (0 = unlimited)">
              <input
                type="number"
                min={0}
                value={policy.weeklyLimit}
                onChange={e => onChange({ ...policy, weeklyLimit: Math.max(0, parseInt(e.target.value || '0', 10) || 0) })}
              />
            </Field>

            <Field label="1-Month Limit (30 Days)" hint="Max uses per license in rolling 30 days (0 = unlimited)">
              <input
                type="number"
                min={0}
                value={policy.monthlyLimit}
                onChange={e => onChange({ ...policy, monthlyLimit: Math.max(0, parseInt(e.target.value || '0', 10) || 0) })}
              />
            </Field>
          </div>

          <div className="form-grid">
            <Field label="Max Input Characters / Request" hint="Protects against oversized paste abuse">
              <input
                type="number"
                min={1000}
                value={policy.maxInputChars}
                onChange={e =>
                  onChange({ ...policy, maxInputChars: Math.max(1000, parseInt(e.target.value || '60000', 10) || 60000) })
                }
              />
            </Field>

            <Field
              label="Default Max Output Tokens"
              hint="Cap on a single AI response (64 – 32,768). 1 token ≈ 4 chars / 0.75 words. Keeps voice reply latency snappy."
            >
              <input
                type="number"
                min={64}
                max={32768}
                value={policy.maxOutputTokens}
                onChange={e =>
                  onChange({
                    ...policy,
                    maxOutputTokens: Math.max(64, Math.min(32768, parseInt(e.target.value || '2048', 10) || 2048)),
                  })
                }
              />
            </Field>
          </div>

          <label className="checkbox-row" style={{ margin: '0.5rem 0 0.5rem 0' }}>
            <input
              type="checkbox"
              checked={policy.enforceZdr}
              onChange={e => onChange({ ...policy, enforceZdr: e.target.checked })}
            />
            <span>
              Enforce OpenRouter Zero Data Retention (<code>data_collection: &quot;deny&quot;</code>) so user prompts are never retained for provider training.
            </span>
          </label>

          {usesFreeModel && policy.enforceZdr && (
            <Notice kind="error">
              Notice: One or more models use a <code>:free</code> or <code>openrouter/free</code> endpoint while Zero Data Retention is still checked. OpenRouter free endpoints do not support Zero Data Retention. Uncheck Zero Data Retention above when testing free models, or switch back to paid model slugs.
            </Notice>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.75rem',
              marginTop: '1.25rem',
              marginBottom: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h5 style={{ margin: 0, fontSize: '0.9rem' }}>Per-Task OpenRouter Models (Paid Only)</h5>
              <span className="small-note">
                Assign specialized models per agent task (e.g. voice_text, coding, vision). Exclusive to paying customers.
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="button secondary small"
                onClick={applyDefaultToAllTasks}
                disabled={!policy.defaultModel.trim() || policy.taskModels.length === 0}
                title="Copy Default Fallback OpenRouter Model into every task slot below"
              >
                Apply Default Model to All Tasks
              </button>
              <button type="button" className="button secondary small" onClick={addTask}>
                <Plus size={14} /> Add Task Slot
              </button>
            </div>
          </div>

          {policy.taskModels.length === 0 ? (
            <div
              style={{
                padding: '0.85rem',
                borderRadius: '8px',
                border: '1px dashed var(--line)',
                fontSize: '12px',
                color: 'var(--muted)',
              }}
            >
              No task-specific overrides yet. All requests for {productName} will use the Default Fallback OpenRouter Model above, or click <b>+ Add Task Slot</b> to configure task-specific models.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {policy.taskModels.map((task, idx) => (
                <div
                  key={`${productId}-task-${idx}`}
                  style={{
                    padding: '0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: '#131910',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(130px, 1fr) minmax(160px, 1.3fr) minmax(200px, 1.8fr) auto',
                      gap: '10px',
                      alignItems: 'end',
                    }}
                  >
                    <label className="field" style={{ margin: 0 }}>
                      <span>Task Key</span>
                      <span className="small-note" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        Machine name in agent code
                      </span>
                      <input
                        value={task.task_key}
                        onChange={e => updateTask(idx, { task_key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                        placeholder="e.g. voice_text"
                      />
                    </label>

                    <label className="field" style={{ margin: 0 }}>
                      <span>Task Label</span>
                      <span className="small-note" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        Display title in admin
                      </span>
                      <input
                        value={task.label}
                        onChange={e => updateTask(idx, { label: e.target.value })}
                        placeholder="e.g. Voro Voice Assistant"
                      />
                    </label>

                    <label className="field" style={{ margin: 0 }}>
                      <span>OpenRouter Model ID</span>
                      <span className="small-note" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        Upstream model slug
                      </span>
                      <input
                        list={datalistId}
                        value={task.model}
                        onChange={e => updateTask(idx, { model: e.target.value })}
                        placeholder="google/gemma-4-31b-it"
                      />
                    </label>

                    <button
                      type="button"
                      className="button secondary small"
                      title="Remove task slot"
                      onClick={() => removeTask(idx)}
                      style={{ padding: '10px', color: '#ff8a80', borderColor: '#5c3330' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '16px',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      marginTop: '10px',
                    }}
                  >
                    <label className="field" style={{ margin: 0, minWidth: 200 }}>
                      <span>Routing Priority</span>
                      <span className="small-note" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        Latency = fastest answer; Price = cheapest
                      </span>
                      <select
                        value={task.sort}
                        onChange={e => updateTask(idx, { sort: e.target.value as AgentAiSortMode })}
                      >
                        <option value="latency">Lowest Latency (Fastest Provider)</option>
                        <option value="price">Lowest Price (Cheapest Provider)</option>
                      </select>
                    </label>

                    <label className="field" style={{ margin: 0, minWidth: 180 }}>
                      <span>Max Output Tokens</span>
                      <span className="small-note" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        Max tokens per single AI reply
                      </span>
                      <input
                        type="number"
                        min={64}
                        max={32768}
                        value={task.max_output_tokens}
                        onChange={e =>
                          updateTask(idx, {
                            max_output_tokens: Math.max(64, Math.min(32768, parseInt(e.target.value || '2048', 10) || 2048)),
                          })
                        }
                      />
                    </label>

                    <label className="checkbox-row" style={{ margin: '22px 0 0 0' }}>
                      <input
                        type="checkbox"
                        checked={task.allow_vision}
                        onChange={e => updateTask(idx, { allow_vision: e.target.checked })}
                      />
                      <span>Vision / Image Capable (Screen OCR)</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 🎁 FREE TRIAL TIER VIEW */}
      {activeTier === 'trial' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              background: 'rgba(96, 165, 250, 0.08)',
              border: '1px solid rgba(96, 165, 250, 0.25)',
              fontSize: '12.5px',
              lineHeight: '1.5',
              color: '#93c5fd',
            }}
          >
            <b>Free Trial Tier Architecture:</b> All trial users (1-Day Free Trials, Gifted Trials, and Promo Coupons) route through this single trial model. Task-specific model assignment is reserved exclusively for Paid Customers.
          </div>

          <div className="form-grid">
            <Field
              label="Upstream OpenRouter API Key (Trial)"
              hint="Dedicated key for free trials (e.g. Free Tier account) or inherit global active key"
            >
              <select
                value={policy.trialAiKeyId || ''}
                onChange={e => onChange({ ...policy, trialAiKeyId: e.target.value || null })}
                style={{
                  borderColor: policy.trialAiKeyId ? '#60a5fa' : undefined,
                }}
              >
                <option value="">🌐 Default (Inherit Global Active Key)</option>
                {openRouterKeys.map(k => (
                  <option key={k.id} value={k.id}>
                    🔑 {k.label} ({k.key_suffix}) {k.is_active ? '— [Active Global Default]' : ''}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Default Trial OpenRouter Model"
              hint="Single OpenRouter model slug used for all trial tasks (e.g. nvidia/...:free)"
            >
              <div>
                <input
                  list={datalistId}
                  value={policy.trialDefaultModel || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'}
                  onChange={e => onChange({ ...policy, trialDefaultModel: e.target.value })}
                  placeholder="e.g. nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"
                />
                <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {trialHasVision ? (
                    <span className="badge good" style={{ fontSize: '11px' }}>
                      <Eye size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                      Multimodal / Vision Capable (Supports Screenshot OCR)
                    </span>
                  ) : (
                    <span className="badge" style={{ fontSize: '11px', color: '#fbbf24', borderColor: '#78350f' }}>
                      <FileText size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                      Text-Only Model (Screenshot OCR not supported)
                    </span>
                  )}
                </div>
              </div>
            </Field>

            <Field
              label="Daily Trial Request Limit (24h)"
              hint="Max requests per trial license every 24 hours (e.g. 50 requests/day). Editable anytime."
            >
              <input
                type="number"
                min={1}
                value={policy.trialDailyLimit ?? 50}
                onChange={e =>
                  onChange({ ...policy, trialDailyLimit: Math.max(1, parseInt(e.target.value || '50', 10) || 50) })
                }
              />
            </Field>
          </div>

          <label className="checkbox-row" style={{ margin: '0.5rem 0 0.25rem 0' }}>
            <input
              type="checkbox"
              checked={policy.trialEnforceZdr || false}
              onChange={e => onChange({ ...policy, trialEnforceZdr: e.target.checked })}
            />
            <span>
              Enforce OpenRouter Zero Data Retention (<code>data_collection: &quot;deny&quot;</code>) for Free Trial tier.
            </span>
          </label>
          <span className="small-note" style={{ display: 'block', marginTop: '-0.25rem', marginBottom: '0.75rem' }}>
            Disabled by default for free trials (prompts allow standard OpenRouter routing). Check this box only if you wish to strictly block prompt data collection for trial users too.
          </span>

          {trialUsesFreeModel && policy.trialEnforceZdr && (
            <Notice kind="error">
              Notice: The trial model uses a <code>:free</code> endpoint while Zero Data Retention is checked. OpenRouter free endpoints do not support Zero Data Retention. Uncheck this box when using free endpoints, or switch to paid model slugs.
            </Notice>
          )}
        </div>
      )}
    </>
  )}

  {/* Global Groq Speech-to-Text (STT) Settings */}
  {variant !== 'openrouter' && (
    <div
      style={{
        marginTop: variant === 'all' ? '1.5rem' : 0,
        paddingTop: variant === 'all' ? '1.25rem' : 0,
        borderTop: variant === 'all' ? '1px solid var(--line)' : 'none',
      }}
    >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
          <Mic size={17} className="accent" />
          <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Groq Speech-to-Text (STT) Voice Engine</h4>
          <span className="badge good">
            <ShieldCheck size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Admin Controlled
          </span>
        </div>
        <p className="small-note" style={{ marginBottom: '1rem' }}>
          Centralized Groq Whisper speech-to-text configuration. Manage commercial paid tier voice models and isolated free trial voice access independently.
        </p>

        {/* Tier switcher buttons for Groq STT */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem' }}>
          <button
            type="button"
            className={`button small ${sttActiveTier === 'paid' ? 'primary' : 'secondary'}`}
            onClick={() => setSttActiveTier('paid')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            👑 Paid Customer Tier
          </button>
          <button
            type="button"
            className={`button small ${sttActiveTier === 'trial' ? 'primary' : 'secondary'}`}
            onClick={() => setSttActiveTier('trial')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            🎁 Free Trial Tier
          </button>
        </div>

        {/* 👑 PAID CUSTOMER VOICE TIER */}
        {sttActiveTier === 'paid' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                background: 'rgba(152, 224, 56, 0.08)',
                border: '1px solid rgba(152, 224, 56, 0.25)',
                fontSize: '12.5px',
                lineHeight: '1.5',
                color: 'var(--text)',
              }}
            >
              <b>👑 Paid Customer Voice Architecture:</b> Commercial customers get prioritized, low-latency Whisper STT. When server fallback is enabled, NORVI&apos;s encrypted Groq key seamlessly transcribes audio if their desktop client key is omitted or fails.
            </div>

            <div className="form-grid">
              <Field label="Paid STT Model ID" hint="Default Whisper model for commercial customers">
                <input
                  list={sttDatalistId}
                  value={policy.sttModel || 'whisper-large-v3-turbo'}
                  onChange={e => onChange({ ...policy, sttModel: e.target.value })}
                  placeholder="whisper-large-v3-turbo"
                />
              </Field>

              <Field label="Paid License Groq Key" hint="Encrypted Groq key used for commercial customers">
                <select
                  value={policy.sttKeyId || ''}
                  onChange={e => onChange({ ...policy, sttKeyId: e.target.value || null })}
                >
                  <option value="">🌐 Default (Inherit Global Active Groq Key)</option>
                  {groqKeys.map(k => (
                    <option key={k.id} value={k.id}>
                      🎙️ {k.label} ({k.key_suffix}) {k.is_active ? '— [Active Now]' : ''}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Paid Users Server Fallback" hint="Allow using agency's Groq key if client key fails">
                <select
                  value={policy.groqFallbackEnabled ? 'enabled' : 'disabled'}
                  onChange={e => onChange({ ...policy, groqFallbackEnabled: e.target.value === 'enabled' })}
                >
                  <option value="disabled">Disabled (User must supply their own Groq key)</option>
                  <option value="enabled">Enabled (Transparent fallback to agency server key)</option>
                </select>
              </Field>
            </div>

            <h5 style={{ margin: '0.75rem 0 0.25rem 0', fontSize: '0.9rem' }}>
              Paid Fallback STT Quota Limits (0 = Unlimited)
            </h5>
            <p className="small-note" style={{ marginBottom: '0.5rem' }}>
              Enforced silently per license. Only counts fallback calls using NORVI&apos;s server key. Users entering their own Groq key in the desktop app bypass these limits completely.
            </p>
            <div className="form-grid">
              <Field label="STT 1-Day Limit" hint="Max voice transcriptions / 24h (0 = unlimited)">
                <input
                  type="number"
                  min={0}
                  value={policy.sttDailyLimit || 0}
                  onChange={e => onChange({ ...policy, sttDailyLimit: Math.max(0, parseInt(e.target.value || '0', 10) || 0) })}
                />
              </Field>

              <Field label="STT 1-Week Limit" hint="Max voice transcriptions / 7 days (0 = unlimited)">
                <input
                  type="number"
                  min={0}
                  value={policy.sttWeeklyLimit || 0}
                  onChange={e => onChange({ ...policy, sttWeeklyLimit: Math.max(0, parseInt(e.target.value || '0', 10) || 0) })}
                />
              </Field>

              <Field label="STT 1-Month Limit" hint="Max voice transcriptions / 30 days (0 = unlimited)">
                <input
                  type="number"
                  min={0}
                  value={policy.sttMonthlyLimit || 0}
                  onChange={e => onChange({ ...policy, sttMonthlyLimit: Math.max(0, parseInt(e.target.value || '0', 10) || 0) })}
                />
              </Field>
            </div>
          </div>
        )}

        {/* 🎁 FREE TRIAL VOICE TIER */}
        {sttActiveTier === 'trial' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                background: 'rgba(96, 165, 250, 0.08)',
                border: '1px solid rgba(96, 165, 250, 0.25)',
                fontSize: '12.5px',
                lineHeight: '1.5',
                color: '#93c5fd',
              }}
            >
              <b>🎁 Free Trial Voice Architecture:</b> By default, free trial users rely strictly on local hardware/offline Whisper on their desktop PC to protect your Groq API quota. When cloud fallback is enabled, trial users route through the isolated trial Groq key and trial model below, subject to strict daily caps.
            </div>

            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <label className="checkbox-row" style={{ margin: 0 }}>
                <input
                  type="checkbox"
                  checked={policy.trialSttFallbackEnabled || false}
                  onChange={e => onChange({ ...policy, trialSttFallbackEnabled: e.target.checked })}
                />
                <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                  🎙️ Enable Groq Cloud Speech-to-Text (STT) for Free Trial Users
                </span>
              </label>
              <span className="small-note" style={{ display: 'block', marginTop: '4px', color: 'var(--text-light)' }}>
                {policy.trialSttFallbackEnabled
                  ? '✅ Active: Trial users without local Whisper hardware can access cloud speech transcription via the trial model and daily limit below.'
                  : '🔒 Disabled (Safe default): Trial users must use offline local Whisper. If their PC cannot run local Whisper, cloud speech fallback is withheld until upgraded to a paid license.'}
              </span>
            </div>

            <div className="form-grid">
              <Field
                label="Trial STT Model ID"
                hint="Whisper model for free trials (whisper-large-v3-turbo recommended for speed & low cost)"
              >
                <input
                  list={sttDatalistId}
                  value={policy.trialSttModel || 'whisper-large-v3-turbo'}
                  onChange={e => onChange({ ...policy, trialSttModel: e.target.value })}
                  placeholder="whisper-large-v3-turbo"
                />
              </Field>

              <Field
                label="Free Trial Groq Key"
                hint="Encrypted Groq key used for trial users (or inherit global active Groq key)"
              >
                <select
                  value={policy.trialSttKeyId || ''}
                  onChange={e => onChange({ ...policy, trialSttKeyId: e.target.value || null })}
                >
                  <option value="">🌐 Default (Inherit Global Active Groq Key)</option>
                  {groqKeys.map(k => (
                    <option key={k.id} value={k.id}>
                      🎙️ {k.label} ({k.key_suffix}) {k.is_active ? '— [Active Now]' : ''}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Trial STT 1-Day Limit (24h)"
                hint="Max voice transcriptions per trial license in a rolling 24-hour window (0 = unlimited)"
              >
                <input
                  type="number"
                  min={0}
                  value={policy.sttTrialDailyLimit || 0}
                  onChange={e => onChange({ ...policy, sttTrialDailyLimit: Math.max(0, parseInt(e.target.value || '0', 10) || 0) })}
                  placeholder="e.g. 20"
                />
              </Field>
            </div>

            <span className="small-note" style={{ color: 'var(--text-light)', marginTop: '-4px' }}>
              💡 <b>Rolling 24-Hour Reset:</b> For multi-day trials (like 7-Day or 1-Month trial keys), the 1-Day limit resets every rolling 24 hours so users get a fresh daily quota each day until expiration.
            </span>
          </div>
        )}
      </div>
    )}
  </div>
);
}
