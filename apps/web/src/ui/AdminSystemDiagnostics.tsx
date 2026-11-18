import React from 'react';
import { useData } from './common';
import { Check, X, AlertCircle, RefreshCw, ArrowUpRight, Activity } from 'lucide-react';

export interface HealthCheckItem {
  id: string;
  name: string;
  category: string;
  status: 'ok' | 'warning' | 'error';
  latencyMs?: number;
  message: string;
  details?: string;
  actionUrl?: string;
}

export interface SystemHealthResponse {
  ok: boolean;
  allOk: boolean;
  hasErrors: boolean;
  summary: string;
  timestamp: string;
  checks: HealthCheckItem[];
}

export function AdminSystemDiagnostics({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const { data, loading, reload } = useData('/admin/system/health');

  const health = data as SystemHealthResponse | null;
  const checks: HealthCheckItem[] = health?.checks || [
    { id: 'database', name: 'Supabase Database & Auth', category: 'core', status: 'ok', message: 'Connecting to database...' },
    { id: 'openrouter', name: 'OpenRouter AI Provider', category: 'ai', status: 'ok', message: 'Checking active API key...' },
    { id: 'payments', name: 'Razorpay Payments Gateway', category: 'commerce', status: 'ok', message: 'Checking merchant gateway...' },
    { id: 'email', name: 'License Email Delivery (Resend)', category: 'notifications', status: 'ok', message: 'Checking email sender...' },
    { id: 'groq_stt', name: 'Groq STT Voice Engine', category: 'ai', status: 'ok', message: 'Checking whisper STT fallback...' },
    { id: 'catalog', name: 'Commercial Agent Catalog', category: 'agents', status: 'ok', message: 'Verifying catalog readiness...' },
  ];

  const hasErrors = health ? health.hasErrors : false;
  const isAllOk = health ? health.allOk : false;
  const statusColor = isAllOk ? 'var(--lime, #98e038)' : hasErrors ? 'var(--red, #ef4444)' : '#f59e0b';

  return (
    <div className="workspace-welcome" style={{ marginBottom: '22px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: statusColor,
              boxShadow: `0 0 10px ${statusColor}`,
            }}
          />
          <span className="eyebrow" style={{ margin: 0, color: statusColor, letterSpacing: '0.05em' }}>
            LIVE INFRASTRUCTURE TELEMETRY
          </span>
        </div>

        <h2 style={{ margin: '0 0 10px 0', fontSize: '2rem', lineHeight: 1.15 }}>
          {isAllOk ? (
            <>
              All systems<br />
              <span className="serif" style={{ color: 'var(--lime, #98e038)' }}>operational.</span>
            </>
          ) : hasErrors ? (
            <>
              Service alert<br />
              <span className="serif" style={{ color: 'var(--red, #ef4444)' }}>action required.</span>
            </>
          ) : (
            <>
              Agency core<br />
              <span className="serif" style={{ color: 'var(--lime, #98e038)' }}>connected.</span>
            </>
          )}
        </h2>

        <p style={{ margin: '0 0 18px 0', fontSize: '0.9rem', color: 'var(--text-light, #99a890)', lineHeight: 1.6 }}>
          {health?.summary || 'Real-time telemetry across Supabase Database, OpenRouter AI, Razorpay Checkout, and Email Delivery.'}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="button primary small"
            onClick={reload}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : undefined }} />
            {loading ? 'Pinging Services...' : 'Run Diagnostics'}
          </button>

          <a
            className="button secondary small"
            href="/admin/releases"
            onClick={e => {
              if (onNavigate) {
                e.preventDefault();
                onNavigate('/releases');
              }
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            Manage Agents &amp; AI <ArrowUpRight size={14} />
          </a>
        </div>
      </div>

      <div className="setup-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {checks.map(check => {
          const isOk = check.status === 'ok';
          const isError = check.status === 'error';
          const isWarning = check.status === 'warning';

          return (
            <div
              key={check.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '6px 8px',
                borderRadius: '8px',
                transition: 'background 0.2s',
              }}
            >
              <span
                className={`check-circle ${isOk ? 'done' : ''}`}
                style={{
                  background: isOk ? undefined : isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  borderColor: isOk ? undefined : isError ? 'var(--red, #ef4444)' : '#f59e0b',
                  color: isOk ? undefined : isError ? 'var(--red, #ef4444)' : '#f59e0b',
                  marginTop: '2px',
                  flexShrink: 0,
                }}
              >
                {loading && !health ? (
                  <Activity size={12} style={{ opacity: 0.6 }} />
                ) : isOk ? (
                  <Check size={14} />
                ) : isError ? (
                  <X size={14} />
                ) : (
                  <AlertCircle size={14} />
                )}
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <b style={{ fontSize: '0.9rem', color: isError ? 'var(--red, #ef4444)' : undefined }}>
                    {check.name}
                  </b>
                  {check.latencyMs !== undefined && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted, #687760)', fontFamily: 'monospace' }}>
                      {check.latencyMs}ms
                    </span>
                  )}
                  {check.actionUrl && (
                    <a
                      href={check.actionUrl}
                      onClick={e => {
                        if (check.actionUrl?.startsWith('http')) {
                          return;
                        }
                        if (onNavigate) {
                          const route = check.actionUrl!.replace('/admin', '') || '/';
                          e.preventDefault();
                          onNavigate(route);
                        }
                      }}
                      target={check.actionUrl?.startsWith('http') ? '_blank' : undefined}
                      rel={check.actionUrl?.startsWith('http') ? 'noreferrer noopener' : undefined}
                      style={{
                        fontSize: '0.75rem',
                        color: isOk ? 'var(--lime, #98e038)' : isError ? 'var(--red, #ef4444)' : '#f59e0b',
                        textDecoration: 'none',
                        marginLeft: 'auto',
                      }}
                    >
                      {isError ? 'Fix' : isWarning ? 'Setup' : 'View'} ↗
                    </a>
                  )}
                </div>
                <small
                  style={{
                    display: 'block',
                    marginTop: '2px',
                    fontSize: '0.8rem',
                    color: isError ? 'var(--red, #ef4444)' : isWarning ? '#f59e0b' : 'var(--text-light, #99a890)',
                    lineHeight: 1.4,
                  }}
                >
                  {check.message}
                  {check.details ? ` — ${check.details}` : ''}
                </small>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
