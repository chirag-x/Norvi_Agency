import React, { useState, useEffect } from 'react';
import { KeyRound, Plus, ShieldCheck, Check, Trash2, RefreshCw, AlertCircle, X, ChevronDown, ChevronUp } from 'lucide-react';

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
  const [showAddModal, setShowAddModal] = useState(false);
  const [showList, setShowList] = useState(false);

  // New key form
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

  const activeKey = keys.find(k => k.is_active);

  const handleActivate = async (id: string) => {
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
      setFeedback('Active AI key switched successfully (takes effect in 0ms).');
      setTimeout(() => setFeedback(null), 4000);
      await fetchKeys();
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

    try {
      setSavingKey(true);
      setError(null);
      const res = await fetch('/api/admin/ai/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          provider: 'openrouter',
          label: newLabel.trim(),
          key: newKey.trim(),
          make_active: makeActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save key.');
      }

      setFeedback(`Key "${newLabel.trim()}" encrypted and saved successfully!`);
      setTimeout(() => setFeedback(null), 4000);
      setNewLabel('');
      setNewKey('');
      setShowAddModal(false);
      await fetchKeys();
      onKeyChange?.();
    } catch (err: any) {
      setError(err.message || 'Failed to save key.');
    } finally {
      setSavingKey(false);
    }
  };

  return (
    <div
      style={{
        padding: '1.25rem',
        borderRadius: '10px',
        border: '1px solid var(--line, #2a3824)',
        background: 'var(--surface, #141a12)',
        marginBottom: '1rem',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(152, 224, 56, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--lime, #98e038)',
            }}
          >
            <KeyRound size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>
              AI Model Provider Keys (OpenRouter)
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-light, #99a890)' }}>
              100% Database-encrypted keys. Switch active keys in real-time with zero Netlify redeployments.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="button primary small"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            onClick={() => {
              setError(null);
              setShowAddModal(true);
            }}
          >
            <Plus size={14} /> Add New Key
          </button>
          {keys.length > 0 && (
            <button
              type="button"
              className="button secondary small"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              onClick={() => setShowList(!showList)}
            >
              {showList ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showList ? 'Hide List' : `Manage Keys (${keys.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div
          style={{
            padding: '8px 12px',
            marginBottom: '1rem',
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
            marginBottom: '1rem',
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
          <span style={{ fontSize: '0.9rem', color: 'var(--text-light, #99a890)', whiteSpace: 'nowrap' }}>
            Active Key Slot:
          </span>
          {loading ? (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-light, #99a890)' }}>Loading keys...</span>
          ) : keys.length === 0 ? (
            <span style={{ fontSize: '0.85rem', color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={14} /> Using fallback Netlify env key (No database keys added)
            </span>
          ) : (
            <select
              aria-label="Active OpenRouter Key Slot"
              value={activeKey?.id || ''}
              disabled={switching}
              onChange={e => {
                if (e.target.value) handleActivate(e.target.value);
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                background: 'var(--surface, #1e261a)',
                color: 'var(--text, #f0f3ee)',
                border: '1px solid var(--line, #2a3824)',
                fontSize: '0.9rem',
                minWidth: '260px',
                cursor: 'pointer',
              }}
            >
              {keys.map(k => (
                <option key={k.id} value={k.id}>
                  {k.label} ({k.key_suffix}) {k.is_active ? '— [Active Now]' : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {activeKey && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              background: 'rgba(152, 224, 56, 0.15)',
              border: '1px solid var(--lime, #98e038)',
              color: 'var(--lime, #98e038)',
              fontSize: '0.82rem',
              fontWeight: 600,
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--lime, #98e038)' }} />
            Active: {activeKey.label} ({activeKey.key_suffix})
          </div>
        )}
      </div>

      {/* Expandable Key List */}
      {showList && keys.length > 0 && (
        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--line, #2a3824)', paddingTop: '1rem' }}>
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: 'var(--text-light, #99a890)' }}>
            All Configured OpenRouter Keys ({keys.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {keys.map(k => (
              <div
                key={k.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: k.is_active ? 'rgba(152, 224, 56, 0.08)' : 'rgba(0, 0, 0, 0.15)',
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
                          fontSize: '0.72rem',
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
                    Added on {new Date(k.created_at).toLocaleDateString()} · AES-256-GCM Encrypted
                  </small>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {!k.is_active && (
                    <button
                      type="button"
                      className="button secondary small"
                      style={{ fontSize: '0.78rem', padding: '3px 8px' }}
                      disabled={switching}
                      onClick={() => handleActivate(k.id)}
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
        </div>
      )}

      {/* Security Note */}
      <div
        style={{
          marginTop: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.78rem',
          color: 'var(--muted, #73846b)',
        }}
      >
        <ShieldCheck size={14} style={{ color: 'var(--lime, #98e038)' }} />
        <span>
          Keys are encrypted at rest with AES-256-GCM before saving to Supabase. Decryption happens solely in serverless memory during live agent calls. Zero keys are visible in client code or network payloads.
        </span>
      </div>

      {/* Add Key Modal */}
      {showAddModal && (
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
          onClick={() => setShowAddModal(false)}
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
                <KeyRound size={18} style={{ color: 'var(--lime, #98e038)' }} /> Add OpenRouter API Key
              </h3>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer' }}
                onClick={() => setShowAddModal(false)}
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
                  placeholder="e.g. Primary High-Speed or Backup Account 2"
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
                  OpenRouter API Key
                </label>
                <input
                  type="password"
                  placeholder="sk-..."
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
                  The key will be encrypted immediately upon saving. You will only see the last 4 characters afterwards.
                </small>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem' }}>
                  <input
                    type="checkbox"
                    checked={makeActive}
                    onChange={e => setMakeActive(e.target.checked)}
                  />
                  <span>Set as active key immediately for Voro &amp; all agents</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setShowAddModal(false)}
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
