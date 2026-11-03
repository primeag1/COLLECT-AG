import { useState } from 'react';
import { useSync, type SyncState } from '../services/SyncContext';

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const STATE_CONFIG: Record<SyncState, {
  dot: string;
  label: string;
  action?: boolean;
  pulse?: boolean;
}> = {
  idle:     { dot: 'var(--color-dust)',         label: 'Drive connected' },
  syncing:  { dot: 'var(--color-signal-light)',  label: 'Syncing…',          pulse: true },
  synced:   { dot: '#22c55e',                   label: 'Synced' },
  error:    { dot: '#ef4444',                   label: 'Sync error',         action: true },
  offline:  { dot: 'var(--color-slate)',         label: 'Offline' },
  no_drive: { dot: 'var(--color-dust)',          label: 'Connect Drive',      action: true },
};

interface SyncStatusBarProps {
  sidebar?: boolean;
}

export function SyncStatusBar({ sidebar = false }: SyncStatusBarProps) {
  const { syncState, lastSyncedAt, errorMessage, pendingCount, syncNow, connectDrive } = useSync();
  const [connecting, setConnecting] = useState(false);
  const config = STATE_CONFIG[syncState];

  const pendingLabel = pendingCount > 0 && syncState !== 'synced'
    ? `${pendingCount} pending`
    : null;

  // In 'no_drive' state, always go through the explicit interactive connect
  // flow (guaranteed visible consent dialog). For 'error', a plain retry
  // via syncNow is enough since Drive access already exists.
  const handleAction = async () => {
    if (connecting) return;
    if (syncState === 'no_drive') {
      setConnecting(true);
      try { await connectDrive(); } finally { setConnecting(false); }
    } else {
      syncNow();
    }
  };

  const actionLabel = connecting
    ? 'Connecting…'
    : syncState === 'no_drive'
    ? 'Connect Drive'
    : syncState === 'syncing'
    ? 'Syncing…'
    : 'Sync now';

  if (sidebar) {
    return (
      <div
        className={`sync-status-bar sync-status-sidebar${connecting ? ' is-connecting' : ''}`}
        data-state={syncState}
        role="status"
        aria-live={syncState === 'error' ? 'assertive' : 'polite'}
        aria-atomic="true"
        title={errorMessage ?? (lastSyncedAt ? `Last synced: ${formatRelativeTime(lastSyncedAt)}` : 'Not synced yet')}
      >
        <div className="sync-status-dot" />
        <span className="sync-status-label">
          {connecting ? 'Connecting…' : config.label}
          {syncState === 'synced' && lastSyncedAt ? ` · ${formatRelativeTime(lastSyncedAt)}` : ''}
          {pendingLabel ? ` · ${pendingLabel}` : ''}
        </span>
        {config.action && !connecting && (
          <button
            type="button"
            onClick={handleAction}
            aria-label={actionLabel}
            className="sync-status-action"
          >
            ↺
          </button>
        )}
      </div>
    );
  }

  // Full banner variant (for Settings → Sync & Data)
  return (
    <div
      className={`sync-status-bar sync-status-banner${connecting ? ' is-connecting' : ''}`}
      data-state={syncState}
      role="status"
      aria-live={syncState === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <div className="sync-status-dot" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>
          {connecting ? 'Connecting to Google Drive…' : config.label}
          {pendingLabel && (
            <span style={{ fontWeight: 400, color: 'var(--color-slate)', marginLeft: 6 }}>
              · {pendingLabel}
            </span>
          )}
        </p>
        {errorMessage && !connecting && (
          <p style={{ fontSize: 12, color: '#b91c1c', margin: '2px 0 0' }}>{errorMessage}</p>
        )}
        {!errorMessage && !connecting && lastSyncedAt && (
          <p style={{ fontSize: 12, color: 'var(--color-slate)', margin: '2px 0 0' }}>
            Last synced {formatRelativeTime(lastSyncedAt)}
          </p>
        )}
        {syncState === 'offline' && (
          <p style={{ fontSize: 12, color: 'var(--color-slate)', margin: '2px 0 0' }}>
            Changes will sync when you're back online.
          </p>
        )}
        {syncState === 'no_drive' && !connecting && (
          <p style={{ fontSize: 12, color: 'var(--color-slate)', margin: '2px 0 0' }}>
            Your data is only on this device until you connect Google Drive.
          </p>
        )}
      </div>
      {(config.action || syncState === 'idle' || syncState === 'synced') && (
        <button
          onClick={handleAction}
          disabled={syncState === 'syncing' || connecting}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: 'var(--color-link)',
            fontFamily: 'var(--font-sans)', fontWeight: 600,
            flexShrink: 0, padding: '4px 8px',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
