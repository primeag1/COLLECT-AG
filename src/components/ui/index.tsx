import React, { useEffect, useId, useRef } from 'react';

// ── Modal ─────────────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}

export function Modal({ open, onClose, title, children, footer, width = 520 }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const dialog = ref.current;
    const focusableElements = () => Array.from(
      dialog?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter(element => element.getAttribute('aria-hidden') !== 'true');
    const firstFocusable = focusableElements()[0];
    (firstFocusable ?? dialog)?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = focusableElements();
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        e.preventDefault();
        dialog?.focus();
      } else if (e.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      previousFocus?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      open
      className="modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={ref}
        tabIndex={-1}
        className="modal-dialog"
        style={{ maxWidth: width }}
      >
        {/* Header */}
        <div className="modal-header">
          <h2 id={titleId} className="modal-title">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="modal-close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </dialog>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function Toggle({ checked, onChange, label, disabled, size = 'md' }: ToggleProps) {
  const w = size === 'sm' ? 32 : 40;
  const h = size === 'sm' ? 18 : 22;
  const d = size === 'sm' ? 12 : 16;

  return (
    <label style={{
      display: 'inline-flex', alignItems: 'center', gap: 10,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
    }}>
      <div
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => !disabled && onChange(!checked)}
        onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!disabled) onChange(!checked); } }}
        style={{
          width: w, height: h, borderRadius: h,
          backgroundColor: checked ? 'var(--color-ink)' : 'var(--color-dust)',
          position: 'relative', transition: 'background-color 0.2s ease',
          flexShrink: 0, cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <div style={{
          position: 'absolute',
          top: (h - d) / 2, left: checked ? w - d - (h - d) / 2 : (h - d) / 2,
          width: d, height: d, borderRadius: '50%',
          backgroundColor: 'white',
          transition: 'left 0.2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </div>
      {label && (
        <span style={{ fontSize: 14, color: 'var(--color-ink)', fontWeight: 400 }}>
          {label}
        </span>
      )}
    </label>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  const colors: Record<NonNullable<BadgeProps['variant']>, { bg: string; color: string }> = {
    default: { bg: 'var(--color-bone)',           color: 'var(--color-slate)' },
    success: { bg: 'rgba(34,197,94,0.12)',        color: '#15803d' },
    warning: { bg: 'rgba(243,115,56,0.12)',       color: 'var(--color-signal)' },
    error:   { bg: 'rgba(239,68,68,0.12)',        color: '#b91c1c' },
    info:    { bg: 'rgba(56,96,190,0.1)',         color: 'var(--color-link)' },
  };
  const c = colors[variant];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 999,
      fontSize: 12, fontWeight: 600,
      backgroundColor: c.bg, color: c.color,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  emoji?: string;
  title: string;
  body?: string;
  action?: React.ReactNode;
}

export function EmptyState({ emoji = '📭', title, body, action }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 12,
      padding: '48px 24px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 40, lineHeight: 1 }}>{emoji}</div>
      <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-ink)' }}>{title}</p>
      {body && <p style={{ fontSize: 14, color: 'var(--color-slate)', maxWidth: 320, lineHeight: 1.6 }}>{body}</p>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

// ── FormRow ───────────────────────────────────────────────────────────────────

interface FormRowProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

export function FormRow({ label, required, hint, error, children }: FormRowProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{
        fontSize: 13, fontWeight: 600,
        color: error ? '#b91c1c' : 'var(--color-ink)',
      }}>
        {label}
        {required && <span style={{ color: 'var(--color-signal)', marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {hint && !error && (
        <p style={{ fontSize: 12, color: 'var(--color-slate)' }}>{hint}</p>
      )}
      {error && (
        <p style={{ fontSize: 12, color: '#b91c1c' }}>{error}</p>
      )}
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────

export function Spinner({ size = 24 }: { size?: number }) {
  return (
    <>
      <div style={{
        width: size, height: size,
        border: `2px solid var(--color-dust)`,
        borderTopColor: 'var(--color-ink)',
        borderRadius: '50%',
        animation: 'fl-spin 0.7s linear infinite',
        flexShrink: 0,
      }} />
      <style>{`@keyframes fl-spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

// ── PageHeader ────────────────────────────────────────────────────────────────

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, action }: PageHeaderProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start',
      justifyContent: 'space-between', gap: 16,
      marginBottom: 32, flexWrap: 'wrap',
    }}>
      <div>
        {eyebrow && <p className="eyebrow" style={{ marginBottom: 8 }}>{eyebrow}</p>}
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-ink)' }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 14, color: 'var(--color-slate)', marginTop: 4 }}>{subtitle}</p>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}

// ── SectionCard ───────────────────────────────────────────────────────────────

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export function SectionCard({ title, subtitle, children, action }: SectionCardProps) {
  return (
    <div style={{
      background: 'var(--color-white)',
      border: '1px solid var(--color-dust)',
      borderRadius: 20,
      overflow: 'hidden',
    }}>
      {(title || action) && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-dust)',
        }}>
          <div>
            {title && <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink)' }}>{title}</p>}
            {subtitle && <p style={{ fontSize: 12, color: 'var(--color-slate)', marginTop: 2 }}>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div style={{ padding: 20 }}>
        {children}
      </div>
    </div>
  );
}
