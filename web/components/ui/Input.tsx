"use client";

import type {InputHTMLAttributes, ReactNode} from "react";

export function Field({label, hint, children}: {label: string; hint?: string; children: ReactNode}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">{label}</span>
      {children}
      {hint ? <span className="text-[11px] text-text-muted">{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`rounded-lg border border-border bg-white px-3 py-2 text-[13px] text-text-primary tabular-nums outline-none transition placeholder:text-text-muted/50 focus:border-accent ${props.className ?? ""}`}
    />
  );
}

/** Pill toggle for a boolean (e.g. policy active). */
export function Toggle({checked, onChange, label}: {checked: boolean; onChange: (v: boolean) => void; label?: string}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2.5 rounded-full px-1 py-1 transition ${checked ? "bg-state-approved/20" : "bg-surface-hover"}`}
    >
      <span
        className={`h-5 w-5 rounded-full transition ${checked ? "translate-x-5 bg-state-approved" : "translate-x-0 bg-text-muted"}`}
      />
      {label ? <span className="pr-3 text-[12px] text-text-primary">{label}</span> : null}
    </button>
  );
}
