import React, { useState, useEffect } from 'react';
import { KeyRound, Plus, ShieldCheck, Check, Trash2, RefreshCw, AlertCircle, X, ChevronDown, ChevronUp, Mic, Globe } from 'lucide-react';

export interface AdminAiKey {
  id: string;
  provider: string;
  label: string;
  key_suffix: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function AdminAiKeyManager({ onKeyChange }: { onKeyChange?: () => void }) {
  const [keys, setKeys] = useState<AdminAiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Accordion Expand/Collapse States
  const [openRouterExpanded, setOpenRouterExpanded] = useState(false);
  const [groqExpanded, setGroqExpanded] = useState(false);

  // Modals
  const [addModalProvider, setAddModalProvider] = useState<'openrouter' | 'groq' | null>(null);
  const [manageModalProvider, setManageModalProvider] = useState<'openrouter' | 'groq' | null>(null);

  // Test states
  const [testingMap, setTestingMap] = useState<Record<string, { testing: boolean; result?: any; error?: string }>>({});
  const [openRouterTestModel, setOpenRouterTestModel] = useState<string>(() => {
    try {
      return localStorage.getItem('norvi_ai_test_model') || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';
    } catch {
      return 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';
    }
  });
  const [groqTestModel, setGroqTestModel] = useState<string>('whisper-large-v3-turbo');

  // Form states
  const [newLabel, setNewLabel] = useState('');
  const [newKey, setNewKey] = useState('');
  const [makeActive, setMakeActive] = useState(true);
  const [savingKey, setSavingKey] = useState(false);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/ai/keys', { credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load AI keys.');
      }
      const data = await res.json();
      setKeys(data.keys || []);
    } catch (err: any) {
      setError(err.message || 'Error loading AI keys.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const openRouterKeys = keys.filter(k => k.provider !== 'groq');
  const groqKeys = keys.filter(k => k.provider === 'groq');

  const activeOpenRouterKey = openRouterKeys.find(k => k.is_active);
  const activeGroqKey = groqKeys.find(k => k.is_active);

  const testKey = async (id: string, provider: 'openrouter' | 'groq', modelOverride?: string) => {
    setTestingMap(prev => ({ ...prev, [id]: { testing: true } }));
    const modelToUse = modelOverride !== undefined
      ? modelOverride.trim()
      : provider === 'groq'
      ? groqTestModel.trim()
      : openRouterTestModel.trim();

    try {
      const res = await fetch(`/api/admin/ai/keys/${id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelToUse, provider }),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setTestingMap(prev => ({
          ...prev,
          [id]: { testing: false, result: data },
        }));
      } else {
        setTestingMap(prev => ({
          ...prev,
          [id]: { testing: false, error: data.error || 'Test failed', result: data },
        }));
      }
    } catch (err: any) {
      setTestingMap(prev => ({
        ...prev,
        [id]: { testing: false, error: err.message || 'Network error' },
      }));
    }
  };

  const handleActivate = async (id: string, provider: 'openrouter' | 'groq') => {
    try {
      setSwitching(true);
      setError(null);
      const res = await fetch(`/api/admin/ai/keys/${id}/activate`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to activate key.');
      }
      setFeedback(`Active ${provider.toUpperCase()} key switched successfully (takes effect in 0ms).`);
      setTimeout(() => setFeedback(null), 4000);
      await fetchKeys();
      testKey(id, provider);
      onKeyChange?.();
    } catch (err: any) {
      setError(err.message || 'Failed to activate key.');
    } finally {
      setSwitching(false);
    }
  };

  const handleDelete = async (id: string, label: string) => {
    if (!window.confirm(`Are you sure you want to delete AI key "${label}"?`)) return;
    try {
      setError(null);
      const res = await fetch(`/api/admin/ai/keys/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete key.');
      }
      setFeedback(`Key "${label}" deleted.`);
      setTimeout(() => setFeedback(null), 3000);
      await fetchKeys();
      onKeyChange?.();
    } catch (err: any) {
      setError(err.message || 'Failed to delete key.');
    }
  };

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) {
      setError('Please provide a name/label for this key.');
      return;
    }
    if (!newKey.trim() || newKey.trim().length < 15) {
      setError('Please provide a valid API key (must be at least 15 characters).');
      return;
    }

    const targetProvider = addModalProvider || 'openrouter';

    try {
      setSavingKey(true);
      setError(null);
      const res = await fetch('/api/admin/ai/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          provider: targetProvider,
          label: newLabel.trim(),
          key: newKey.trim(),
          make_active: makeActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save key.');
      }

      setFeedback(`${targetProvider.toUpperCase()} key "${newLabel.trim()}" encrypted and saved successfully!`);
      setTimeout(() => setFeedback(null), 4000);
      setNewLabel('');
      setNewKey('');
      setAddModalProvider(null);
      await fetchKeys();
      onKeyChange?.();
    } catch (err: any) {
      setError(err.message || 'Failed to save key.');
    } finally {
      setSavingKey(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>

      {/* Global Notifications */}
      {error && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid var(--red, #ef4444)',
            color: 'var(--red, #ef4444)',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {feedback && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            background: 'rgba(152, 224, 56, 0.12)',
            border: '1px solid var(--lime, #98e038)',
            color: 'var(--lime, #98e038)',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Check size={16} />
          <span>{feedback}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CARD 1: OPENROUTER AI MODEL PROVIDER KEYS (LLM INFERENCE)                */}
      {/* ========================================================================= */}
      <div
        style={{
          borderRadius: '10px',
          border: '1px solid var(--line, #2a3824)',
          background: 'var(--surface, #141a12)',
          overflow: 'hidden',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Accordion Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            cursor: 'pointer',
            background: openRouterExpanded ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
            borderBottom: openRouterExpanded ? '1px solid var(--line, #2a3824)' : 'none',
          }}
          onClick={() => setOpenRouterExpanded(!openRouterExpanded)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '260px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(152, 224, 56, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--lime, #98e038)',
                flexShrink: 0,
              }}
            >
              <Globe size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                  AI Model Provider Keys (OpenRouter)
                </h3>
                {activeOpenRouterKey ? (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: 'rgba(152, 224, 56, 0.15)',
                      color: 'var(--lime, #98e038)',
                      border: '1px solid rgba(152, 224, 56, 0.3)',
                      fontWeight: 600,
                    }}
                  >
                    Active: {activeOpenRouterKey.label} ({activeOpenRouterKey.key_suffix})
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: 'rgba(245, 158, 11, 0.12)',
                      color: '#f59e0b',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                    }}
                  >
                    Netlify Env Key Fallback
                  </span>
                )}
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-light, #99a890)' }}>
                Encrypted multi-key OpenRouter pool for reasoning, text generation &amp; vision.
              </p>
            </div>
          </div>

          <div
            style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              className="button primary small"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', padding: '4px 10px' }}
              onClick={() => {
                setError(null);
                setAddModalProvider('openrouter');
              }}
            >
              <Plus size={13} /> Add Key
            </button>
            <button
              type="button"
              className="button secondary small"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '4px 10px' }}
              onClick={() => setManageModalProvider('openrouter')}
            >
              Manage Keys ({openRouterKeys.length})
            </button>
            <button
              type="button"
              aria-label={openRouterExpanded ? 'Collapse OpenRouter section' : 'Expand OpenRouter section'}
              style={{
                background: 'transparent',
                border: '1px solid var(--line, #2a3824)',
                borderRadius: '6px',
                color: 'var(--text-light)',
                padding: '4px 8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
              }}
              onClick={() => setOpenRouterExpanded(!openRouterExpanded)}
            >
              {openRouterExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Accordion Content */}
        {openRouterExpanded && (
          <div style={{ padding: '1.25rem', background: 'rgba(0, 0, 0, 0.15)' }}>
            {/* Active Key Selector Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--line, #2a3824)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
                <span style={{ fontSize: '0.88rem', color: 'var(--text-light, #99a890)', whiteSpace: 'nowrap' }}>
                  Active Key Slot:
                </span>
                {loading ? (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-light, #99a890)' }}>Loading keys...</span>
                ) : openRouterKeys.length === 0 ? (
                  <span style={{ fontSize: '0.85rem', color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={14} /> Using fallback Netlify env key (No database keys added)
                  </span>
                ) : (
                  <select
                    aria-label="Active OpenRouter Key Slot"
                    value={activeOpenRouterKey?.id || ''}
                    disabled={switching}
                    onChange={e => {
                      if (e.target.value) handleActivate(e.target.value, 'openrouter');
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: 'var(--surface, #1e261a)',
                      color: 'var(--text, #f0f3ee)',
                      border: '1px solid var(--line, #2a3824)',
                      fontSize: '0.88rem',
                      minWidth: '240px',
                      cursor: 'pointer',
                    }}
                  >
                    {openRouterKeys.map(k => (
                      <option key={k.id} value={k.id}>
                        {k.label} ({k.key_suffix}) {k.is_active ? '— [Active Now]' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {activeOpenRouterKey && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {testingMap[activeOpenRouterKey.id]?.testing ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--line, #2a3824)',
                        color: 'var(--text-light, #99a890)',
                        fontSize: '0.82rem',
                      }}
                    >
                      <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                      Testing OpenRouter...
                    </span>
                  ) : testingMap[activeOpenRouterKey.id]?.result?.working ? (
                    <button
                      type="button"
                      onClick={() => testKey(activeOpenRouterKey.id, 'openrouter')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        background: 'rgba(152, 224, 56, 0.15)',
                        border: '1px solid var(--lime, #98e038)',
                        color: 'var(--lime, #98e038)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          background: 'var(--lime, #98e038)',
                          boxShadow: '0 0 8px var(--lime, #98e038)',
                        }}
                      />
                      ✓ Working ({testingMap[activeOpenRouterKey.id]?.result?.latencyMs}ms): {activeOpenRouterKey.label}
                    </button>
                  ) : testingMap[activeOpenRouterKey.id]?.error ? (
                    <button
                      type="button"
                      onClick={() => testKey(activeOpenRouterKey.id, 'openrouter')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid var(--red, #ef4444)',
                        color: 'var(--red, #ef4444)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <AlertCircle size={13} />
                      ✗ Failed · Retry ↻
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="button secondary small"
                      onClick={() => testKey(activeOpenRouterKey.id, 'openrouter')}
                    >
                      ⚡ Test Active Key
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Model Diagnostic Tester Bar */}
            <div
              style={{
                marginTop: '10px',
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.2)',
                border: '1px dashed var(--line, #2a3824)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text, #f0f3ee)' }}>
                  🧪 Diagnostic Model:
                </span>
                <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(96, 165, 250, 0.12)', border: '1px solid rgba(96, 165, 250, 0.25)', color: '#60a5fa' }}>
                  Diagnostic Only
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px' }}>
                <input
                  type="text"
                  aria-label="Diagnostic Test Model"
                  value={openRouterTestModel}
                  placeholder="Paste OpenRouter model slug (e.g. nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free)"
                  onChange={e => {
                    const val = e.target.value;
                    setOpenRouterTestModel(val);
                    try { localStorage.setItem('norvi_ai_test_model', val); } catch {}
                  }}
                  style={{
                    flex: 1,
                    padding: '5px 10px',
                    borderRadius: '6px',
                    background: 'var(--surface, #1e261a)',
                    border: '1px solid var(--line, #2a3824)',
                    color: 'var(--text, #f0f3ee)',
                    fontSize: '0.82rem',
                    fontFamily: 'monospace',
                  }}
                />
                <button
                  type="button"
                  className="button secondary small"
                  style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (activeOpenRouterKey) testKey(activeOpenRouterKey.id, 'openrouter');
                  }}
                  disabled={!activeOpenRouterKey || testingMap[activeOpenRouterKey?.id]?.testing}
                >
                  {testingMap[activeOpenRouterKey?.id || '']?.testing ? 'Testing...' : 'Test Active Key ⚡'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* CARD 2: GROQ VOICE STT PROVIDER KEYS (SPEECH-TO-TEXT)                    */}
      {/* ========================================================================= */}
      <div
        style={{
          borderRadius: '10px',
          border: '1px solid var(--line, #2a3824)',
          background: 'var(--surface, #141a12)',
          overflow: 'hidden',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Accordion Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            cursor: 'pointer',
            background: groqExpanded ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
            borderBottom: groqExpanded ? '1px solid var(--line, #2a3824)' : 'none',
          }}
          onClick={() => setGroqExpanded(!groqExpanded)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '260px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f59e0b',
                flexShrink: 0,
              }}
            >
              <Mic size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                  Voice STT Provider Keys (Groq)
                </h3>
                {activeGroqKey ? (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: 'rgba(152, 224, 56, 0.15)',
                      color: 'var(--lime, #98e038)',
                      border: '1px solid rgba(152, 224, 56, 0.3)',
                      fontWeight: 600,
                    }}
                  >
                    Active: {activeGroqKey.label} ({activeGroqKey.key_suffix})
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: 'rgba(245, 158, 11, 0.12)',
                      color: '#f59e0b',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                    }}
                  >
                    Netlify GROQ_API_KEY Fallback
                  </span>
                )}
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-light, #99a890)' }}>
                Ultra-low latency Whisper speech-to-text API keys with live transcription verification.
              </p>
            </div>
          </div>

          <div
            style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              className="button primary small"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', padding: '4px 10px' }}
              onClick={() => {
                setError(null);
                setAddModalProvider('groq');
              }}
            >
              <Plus size={13} /> Add Groq Key
            </button>
            <button
              type="button"
              className="button secondary small"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '4px 10px' }}
              onClick={() => setManageModalProvider('groq')}
            >
              Manage Groq Keys ({groqKeys.length})
            </button>
            <button
              type="button"
              aria-label={groqExpanded ? 'Collapse Groq STT section' : 'Expand Groq STT section'}
              style={{
                background: 'transparent',
                border: '1px solid var(--line, #2a3824)',
                borderRadius: '6px',
                color: 'var(--text-light)',
                padding: '4px 8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
              }}
              onClick={() => setGroqExpanded(!groqExpanded)}
            >
              {groqExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Accordion Content */}
        {groqExpanded && (
          <div style={{ padding: '1.25rem', background: 'rgba(0, 0, 0, 0.15)' }}>
            {/* Active Key Selector Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--line, #2a3824)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
                <span style={{ fontSize: '0.88rem', color: 'var(--text-light, #99a890)', whiteSpace: 'nowrap' }}>
                  Active Groq Key Slot:
                </span>
                {loading ? (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-light, #99a890)' }}>Loading keys...</span>
                ) : groqKeys.length === 0 ? (
                  <span style={{ fontSize: '0.85rem', color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={14} /> Using fallback Netlify GROQ_API_KEY (No database keys added)
                  </span>
                ) : (
                  <select
                    aria-label="Active Groq Key Slot"
                    value={activeGroqKey?.id || ''}
                    disabled={switching}
                    onChange={e => {
                      if (e.target.value) handleActivate(e.target.value, 'groq');
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: 'var(--surface, #1e261a)',
                      color: 'var(--text, #f0f3ee)',
                      border: '1px solid var(--line, #2a3824)',
                      fontSize: '0.88rem',
                      minWidth: '240px',
                      cursor: 'pointer',
                    }}
                  >
                    {groqKeys.map(k => (
                      <option key={k.id} value={k.id}>
                        {k.label} ({k.key_suffix}) {k.is_active ? '— [Active Now]' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {activeGroqKey && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {testingMap[activeGroqKey.id]?.testing ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--line, #2a3824)',
                        color: 'var(--text-light, #99a890)',
                        fontSize: '0.82rem',
                      }}
                    >
                      <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                      Testing Groq Whisper...
                    </span>
                  ) : testingMap[activeGroqKey.id]?.result?.working ? (
                    <button
                      type="button"
                      onClick={() => testKey(activeGroqKey.id, 'groq')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        background: 'rgba(152, 224, 56, 0.15)',
                        border: '1px solid var(--lime, #98e038)',
                        color: 'var(--lime, #98e038)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          background: 'var(--lime, #98e038)',
                          boxShadow: '0 0 8px var(--lime, #98e038)',
                        }}
                      />
                      ✓ Working ({testingMap[activeGroqKey.id]?.result?.latencyMs}ms): {activeGroqKey.label}
                    </button>
                  ) : testingMap[activeGroqKey.id]?.error ? (
                    <button
                      type="button"
                      onClick={() => testKey(activeGroqKey.id, 'groq')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid var(--red, #ef4444)',
                        color: 'var(--red, #ef4444)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <AlertCircle size={13} />
                      ✗ Failed · Retry ↻
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="button secondary small"
                      onClick={() => testKey(activeGroqKey.id, 'groq')}
                    >
                      ⚡ Test Active Groq Key
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Whisper Diagnostic Tester Bar */}
            <div
              style={{
                marginTop: '10px',
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.2)',
                border: '1px dashed var(--line, #2a3824)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text, #f0f3ee)' }}>
                  🎙️ Whisper Model Test:
                </span>
                <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.25)', color: '#f59e0b' }}>
                  Speech STT
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px' }}>
                <input
                  type="text"
                  aria-label="Diagnostic Whisper Model"
                  value={groqTestModel}
                  placeholder="e.g. whisper-large-v3-turbo or whisper-large-v3"
                  onChange={e => setGroqTestModel(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '5px 10px',
                    borderRadius: '6px',
                    background: 'var(--surface, #1e261a)',
                    border: '1px solid var(--line, #2a3824)',
                    color: 'var(--text, #f0f3ee)',
                    fontSize: '0.82rem',
                    fontFamily: 'monospace',
                  }}
                />
                <button
                  type="button"
                  className="button secondary small"
                  style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    if (activeGroqKey) testKey(activeGroqKey.id, 'groq');
                  }}
                  disabled={!activeGroqKey || testingMap[activeGroqKey?.id]?.testing}
                >
                  {testingMap[activeGroqKey?.id || '']?.testing ? 'Testing...' : 'Test Active Groq Key ⚡'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Security Note */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.78rem',
          color: 'var(--muted, #73846b)',
        }}
      >
        <ShieldCheck size={14} style={{ color: 'var(--lime, #98e038)' }} />
        <span>
          Keys are encrypted at rest with AES-256-GCM. Decryption happens strictly in serverless memory during live proxy calls.
        </span>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: MANAGE KEYS (OpenRouter or Groq)                                   */}
      {/* ========================================================================= */}
      {manageModalProvider && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          onClick={() => setManageModalProvider(null)}
        >
          <div
            style={{
              background: '#182015',
              border: '1px solid var(--line, #2a3824)',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '650px',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '1.5rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {manageModalProvider === 'groq' ? <Mic size={18} style={{ color: '#f59e0b' }} /> : <KeyRound size={18} style={{ color: 'var(--lime, #98e038)' }} />}
                Manage {manageModalProvider === 'groq' ? 'Groq Voice STT' : 'OpenRouter AI'} Keys
              </h3>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer' }}
                onClick={() => setManageModalProvider(null)}
              >
                <X size={18} />
              </button>
            </div>

            {(() => {
              const list = manageModalProvider === 'groq' ? groqKeys : openRouterKeys;
              if (list.length === 0) {
                return (
                  <p style={{ color: 'var(--text-light)', fontSize: '0.88rem' }}>
                    No {manageModalProvider.toUpperCase()} keys have been added to the database yet. Click "+ Add Key" to add your first encrypted key.
                  </p>
                );
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {list.map(k => (
                    <div
                      key={k.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: k.is_active ? 'rgba(152, 224, 56, 0.08)' : 'rgba(0, 0, 0, 0.2)',
                        border: k.is_active ? '1px solid rgba(152, 224, 56, 0.3)' : '1px solid var(--line, #2a3824)',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <b style={{ fontSize: '0.9rem' }}>{k.label}</b>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-light, #99a890)', fontFamily: 'monospace' }}>
                            ({k.key_suffix})
                          </span>
                          {k.is_active && (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: 'var(--lime, #98e038)',
                                color: '#0d120a',
                                fontWeight: 700,
                              }}
                            >
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <small style={{ color: 'var(--muted, #687760)', fontSize: '0.75rem' }}>
                          Added on {new Date(k.created_at).toLocaleDateString()} · AES-256-GCM
                        </small>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="button secondary small"
                          style={{
                            fontSize: '0.78rem',
                            padding: '3px 8px',
                            borderColor: testingMap[k.id]?.result?.working
                              ? 'var(--lime, #98e038)'
                              : testingMap[k.id]?.error
                              ? 'var(--red, #ef4444)'
                              : undefined,
                            color: testingMap[k.id]?.result?.working
                              ? 'var(--lime, #98e038)'
                              : testingMap[k.id]?.error
                              ? 'var(--red, #ef4444)'
                              : undefined,
                          }}
                          disabled={testingMap[k.id]?.testing}
                          onClick={() => testKey(k.id, manageModalProvider)}
                        >
                          {testingMap[k.id]?.testing ? 'Testing...' : testingMap[k.id]?.result?.working ? `✓ (${testingMap[k.id]?.result?.latencyMs}ms)` : '⚡ Test'}
                        </button>
                        {!k.is_active && (
                          <button
                            type="button"
                            className="button secondary small"
                            style={{ fontSize: '0.78rem', padding: '3px 8px' }}
                            disabled={switching}
                            onClick={() => handleActivate(k.id, manageModalProvider)}
                          >
                            Set Active
                          </button>
                        )}
                        <button
                          type="button"
                          title="Delete key"
                          aria-label={`Delete key ${k.label}`}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--red, #ef4444)',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'inline-flex',
                          }}
                          onClick={() => handleDelete(k.id, k.label)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD KEY (OpenRouter or Groq)                                       */}
      {/* ========================================================================= */}
      {addModalProvider && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          onClick={() => setAddModalProvider(null)}
        >
          <div
            style={{
              background: '#182015',
              border: '1px solid var(--line, #2a3824)',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '480px',
              padding: '1.5rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {addModalProvider === 'groq' ? <Mic size={18} style={{ color: '#f59e0b' }} /> : <KeyRound size={18} style={{ color: 'var(--lime, #98e038)' }} />}
                Add {addModalProvider === 'groq' ? 'Groq Voice STT' : 'OpenRouter'} API Key
              </h3>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer' }}
                onClick={() => setAddModalProvider(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddKey}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: 'var(--text-light)' }}>
                  Key Name / Label
                </label>
                <input
                  type="text"
                  placeholder={addModalProvider === 'groq' ? 'e.g. Primary Groq Whisper Key' : 'e.g. Primary High-Speed Key'}
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: '#10150e',
                    border: '1px solid var(--line, #2a3824)',
                    color: '#fff',
                    fontSize: '0.9rem',
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: 'var(--text-light)' }}>
                  {addModalProvider === 'groq' ? 'Groq API Key (gsk_...)' : 'OpenRouter API Key (sk-or-...)'}
                </label>
                <input
                  type="password"
                  placeholder={addModalProvider === 'groq' ? 'gsk_...' : 'sk-or-...'}
                  value={newKey}
                  onChange={e => setNewKey(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: '#10150e',
                    border: '1px solid var(--line, #2a3824)',
                    color: '#fff',
                    fontSize: '0.9rem',
                    fontFamily: 'monospace',
                  }}
                  required
                />
                <small style={{ color: 'var(--muted, #73846b)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                  The key will be encrypted with AES-256-GCM immediately upon saving.
                </small>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem' }}>
                  <input
                    type="checkbox"
                    checked={makeActive}
                    onChange={e => setMakeActive(e.target.checked)}
                  />
                  <span>Set as active {addModalProvider.toUpperCase()} key immediately</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setAddModalProvider(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button primary"
                  disabled={savingKey}
                >
                  {savingKey ? 'Encrypting & Saving...' : 'Save & Encrypt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
