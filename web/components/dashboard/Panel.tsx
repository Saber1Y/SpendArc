import type {ReactNode} from "react";

/** Standard dashboard panel - elevated card with title row + optional action. */
export function Panel({
  title,
  subtitle,
  action,
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`kpi-card p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-[13px] font-semibold text-text-primary">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-[12px] text-text-muted">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}

/** Small empty/failure inline note. */
export function PanelNote({tone = "muted", children}: {tone?: "muted" | "error"; children: ReactNode}) {
  return (
    <div
      className={`rounded-lg border px-4 py-6 text-center text-[12px] ${
        tone === "error"
          ? "border-state-blocked/30 bg-state-blocked-light text-state-blocked"
          : "border-border bg-surface-muted text-text-muted"
      }`}
    >
      {children}
    </div>
  );
}
