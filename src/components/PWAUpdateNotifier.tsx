import { useState, useEffect, useRef } from 'react';

export function PWAUpdateNotifier() {
  const [showUpdate, setShowUpdate] = useState(false);
  const showUpdateRef = useRef(showUpdate);
  showUpdateRef.current = showUpdate;

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let active = true;
    let registration: ServiceWorkerRegistration | undefined;
    const handleUpdateFound = () => {
      const newWorker = registration?.installing;
      if (!newWorker) return;
      const handleStateChange = () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          setShowUpdate(true);
        }
      };
      newWorker.addEventListener('statechange', handleStateChange);
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        setShowUpdate(true);
      }
    };
    const handleControllerChange = () => {
      if (showUpdateRef.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    navigator.serviceWorker.ready.then(readyRegistration => {
      if (!active) return;
      registration = readyRegistration;
      registration.addEventListener('updatefound', handleUpdateFound);
    });
    return () => {
      active = false;
      registration?.removeEventListener('updatefound', handleUpdateFound);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  if (!showUpdate) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 80,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 500,
      background: 'var(--color-ink)',
      borderRadius: 14,
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      maxWidth: 'calc(100vw - 32px)',
      animation: 'slideDown 0.3s ease',
    }}>
      <p style={{ color: 'var(--color-canvas)', fontSize: 13, fontWeight: 500 }}>
        A new version of COLLECT-AG is ready.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          background: 'var(--color-canvas)', border: 'none',
          borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
          color: 'var(--color-ink)', fontSize: 13, fontWeight: 700,
          fontFamily: 'var(--font-sans)', flexShrink: 0,
        }}
      >
        Refresh
      </button>
      <button
        onClick={() => setShowUpdate(false)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.4)', fontSize: 18, lineHeight: 1,
          padding: 0, flexShrink: 0,
        }}
        aria-label="Dismiss"
      >
        ✕
      </button>
      <style>{`
        @keyframes slideDown {
          from { transform: translateX(-50%) translateY(-12px); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0);     opacity: 1; }
        }
      `}</style>
    </div>
  );
}
