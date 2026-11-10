import { Bot, Check, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import {
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
}: {
  productId: string;
  productName: string;
  policy: AgentAiPolicy;
  onChange: (next: AgentAiPolicy) => void;
  onSavePolicy: () => Promise<void>;
  saving: boolean;
  feedback?: string;
}) {
  const usesFreeModel =
    policy.defaultModel.trim().endsWith(':free') ||
    policy.defaultModel.trim() === 'openrouter/free' ||
    policy.taskModels.some(t => t.model.trim().endsWith(':free') || t.model.trim() === 'openrouter/free');
  const datalistId = `openrouter-presets-${productId}`;

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
    onChange({ ...policy, taskModels: policy.taskModels.filter((_, i) => i !== index) });
  };

  return (
    <div
      style={{
        marginTop: '1.5rem',
        padding: '1.25rem',
        borderRadius: '10px',
        border: '1px solid var(--line)',
        background: '#161c13',
      }}
    >
      <datalist id={datalistId}>
        {OPENROUTER_MODEL_PRESETS.map(p => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </datalist>

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
          <span className="badge" title="Admin-only usage metrics across all licenses">
            24h: {policy.stats.requests24h} · 7d: {policy.stats.requests7d} · 30d: {policy.stats.requests30d} reqs (~$
            {Number(policy.stats.cost30dUsd || 0).toFixed(4)})
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

        <Field label="Free Trial 1-Day Limit" hint="Stricter 24h cap for 1-day trials (0 = uses 1-Day Limit)">
          <input
            type="number"
            min={0}
            value={policy.trialDailyLimit}
            onChange={e =>
              onChange({ ...policy, trialDailyLimit: Math.max(0, parseInt(e.target.value || '0', 10) || 0) })
            }
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

        <Field label="Default Max Output Tokens" hint="Fallback output token cap (64 – 32,768)">
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
          Notice: One or more models use a <code>:free</code> or <code>openrouter/free</code> endpoint while Zero Data Retention is still checked. Uncheck Zero Data Retention above while testing free models (and enable free endpoints in OpenRouter privacy settings), or switch back to paid model slugs.
        </Notice>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          marginTop: '1rem',
          marginBottom: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h5 style={{ margin: 0, fontSize: '0.9rem' }}>Per-Task OpenRouter Models</h5>
          <span className="small-note">
            Assign any OpenRouter model ID per agent task (e.g. voice_text, coding, vision) or add slots for future tasks.
          </span>
        </div>
        <button type="button" className="button secondary small" onClick={addTask}>
          <Plus size={14} /> Add Task Slot
        </button>
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
                  <input
                    value={task.task_key}
                    onChange={e => updateTask(idx, { task_key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                    placeholder="e.g. vision"
                  />
                </label>

                <label className="field" style={{ margin: 0 }}>
                  <span>Task Label</span>
                  <input
                    value={task.label}
                    onChange={e => updateTask(idx, { label: e.target.value })}
                    placeholder="e.g. Voro Screen Vision"
                  />
                </label>

                <label className="field" style={{ margin: 0 }}>
                  <span>OpenRouter Model ID</span>
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
                <label className="field" style={{ margin: 0, minWidth: 170 }}>
                  <span>Routing Priority</span>
                  <select
                    value={task.sort}
                    onChange={e => updateTask(idx, { sort: e.target.value as AgentAiSortMode })}
                  >
                    <option value="latency">Lowest Latency (Fastest)</option>
                    <option value="price">Lowest Price (Cheapest)</option>
                  </select>
                </label>

                <label className="field" style={{ margin: 0, width: 150 }}>
                  <span>Max Output Tokens</span>
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

                <label className="checkbox-row" style={{ margin: '18px 0 0 0' }}>
                  <input
                    type="checkbox"
                    checked={task.allow_vision}
                    onChange={e => updateTask(idx, { allow_vision: e.target.checked })}
                  />
                  <span>Vision / Image Capable</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      {feedback && (
        <Notice kind={feedback.startsWith('Error') ? 'error' : 'success'}>
          {feedback}
        </Notice>
      )}
    </div>
  );
}
