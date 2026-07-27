/** SpendArc logo - text-based lockup with accent color. */
export function Logo({height = 28, className = ""}: {height?: number; className?: string}) {
  return (
    <span
      className={`font-sans select-none text-text-primary ${className}`}
      style={{fontSize: height * 0.6, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1}}
    >
      Spend<span className="text-accent">Arc</span>
    </span>
  );
}
