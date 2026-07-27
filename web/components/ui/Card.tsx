import type {ReactNode} from "react";

type Tone = "paper" | "bone" | "elevated" | "dark";
type Pad = "sm" | "md" | "lg";

const toneClass: Record<Tone, string> = {
  paper: "bg-white border-border text-text-primary",
  bone: "bg-surface-muted border-border text-text-primary",
  elevated: "bg-white border-border text-text-primary shadow-elevated",
  dark: "bg-surface-dark border-white/10 text-white",
};

const padClass: Record<Pad, string> = {
  sm: "p-4",
  md: "p-5",
  lg: "p-8",
};

/** The Card Surface - clean, elevated, consistent. */
export function Card({
  tone = "paper",
  pad = "md",
  className = "",
  children,
}: {
  tone?: Tone;
  pad?: Pad;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-lg border ${toneClass[tone]} ${padClass[pad]} ${className}`}>
      {children}
    </div>
  );
}
