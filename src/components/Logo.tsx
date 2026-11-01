interface LogoProps {
  size?: number;
  variant?: 'icon' | 'full';
  dark?: boolean;
  className?: string;
}

export function Logo({ size = 32, variant = 'full', dark = false, className }: LogoProps) {
  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 9,
        flexShrink: 0,
        textDecoration: 'none',
        lineHeight: 1,
      }}
    >
      <img
        src={`${import.meta.env.BASE_URL}collect-ag-mark.svg`}
        alt="COLLECT-AG"
        width={size}
        height={size}
        style={{
          objectFit: 'contain',
          borderRadius: Math.round(size * 0.2),
          flexShrink: 0,
          display: 'block',
          verticalAlign: 'middle',
        }}
      />
      {variant === 'full' && (
        <span
          style={{
            fontWeight: 700,
            fontSize: Math.round(size * 0.56),
            letterSpacing: 0,
            color: dark ? 'var(--color-white)' : 'var(--color-ink)',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            display: 'block',
          }}
        >
          COLLECT-AG
        </span>
      )}
    </div>
  );
}
