/** SpendArc logo - arc mark + wordmark lockup. */

export function LogoMark({size = 26, className = ""}: {size?: number; className?: string}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="saLogoGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3B63FF" />
          <stop offset="1" stopColor="#1E34BE" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#saLogoGrad)" />
      <path d="M18.87 23.90 A8.4 8.4 0 1 1 23.89 18.87" fill="none" stroke="#ffffff" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="21.9" cy="21.9" r="2.5" fill="#ffffff" />
    </svg>
  );
}

export function Logo({
  height = 28,
  showMark = true,
  className = "",
}: {
  height?: number;
  showMark?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex select-none items-center gap-2 ${className}`}>
      {showMark && <LogoMark size={Math.round(height * 0.92)} />}
      <span
        className="font-sans text-text-primary"
        style={{fontSize: height * 0.6, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1}}
      >
        Spend<span className="text-accent">Arc</span>
      </span>
    </span>
  );
}
