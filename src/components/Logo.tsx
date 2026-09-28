export function LogoIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" aria-hidden="true">
      <defs>
        <linearGradient id="mm-gradient" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="var(--brand-gradient-start)" />
          <stop offset="1" stopColor="var(--brand-gradient-end)" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="30" fill="var(--navy)" />
      <path
        d="M26 100 L50 66 L64 76 L96 34"
        stroke="url(#mm-gradient)"
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M96 34 l-18 2 M96 34 l2 18" stroke="var(--flow-500)" strokeWidth="10" strokeLinecap="round" fill="none" />
      <path d="M44 104 h26" stroke="#fff" strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ size = 30, showText = true }: { size?: number; showText?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoIcon size={size} />
      {showText && (
        <span className="text-lg font-bold leading-none tracking-tight">
          <span className="gradient-text">Momentum</span>
        </span>
      )}
    </div>
  );
}