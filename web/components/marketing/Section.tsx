import type {ReactNode} from "react";

type Tone = "paper" | "bone" | "dark";

const toneCls: Record<Tone, string> = {
  paper: "bg-white text-text-primary",
  bone: "bg-surface-muted text-text-primary",
  dark: "bg-surface-dark text-white",
};

/** Full-bleed section with the 1200px content cap and the 64px+ section rhythm. */
export function Section({
  tone = "paper",
  id,
  className = "",
  children,
}: {
  tone?: Tone;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`${toneCls[tone]} px-6`}>
      <div className={`mx-auto max-w-[1200px] py-16 sm:py-20 lg:py-24 ${className}`}>{children}</div>
    </section>
  );
}

/** Section eyebrow - a small caption label above headings. */
export function Eyebrow({children, onDark = false}: {children: ReactNode; onDark?: boolean}) {
  return (
    <span className={`text-[11px] font-medium uppercase tracking-wider ${onDark ? "text-accent" : "text-text-muted"}`}>
      {children}
    </span>
  );
}
