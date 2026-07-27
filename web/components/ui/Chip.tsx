"use client";

import {useState, type ReactNode} from "react";
import {Copy, Check, ArrowUpRight} from "./Icons";

type ChipTone = "neutral" | "accent" | "mint" | "blush" | "outline";

const toneClass: Record<ChipTone, string> = {
  neutral: "bg-surface-muted text-text-secondary",
  accent: "bg-accent/10 text-accent",
  mint: "bg-state-approved-light text-state-approved",
  blush: "bg-state-blocked-light text-state-blocked border border-state-blocked/20",
  outline: "bg-transparent text-text-secondary border border-border",
};

export function Chip({
  tone = "neutral",
  className = "",
  children,
}: {
  tone?: ChipTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none ${toneClass[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Copyable value chip - mono-ish truncated text, click to copy the full value. */
export function CopyChip({value, label, tone = "outline"}: {value: string; label?: string; tone?: ChipTone}) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard blocked - no-op */
    }
  };
  return (
    <button
      onClick={onCopy}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none transition hover:brightness-95 ${toneClass[tone]}`}
      title="Copy"
    >
      <span className="tabular-nums tracking-tight">{label ?? value}</span>
      {copied ? <Check width={12} height={12} className="text-state-approved" /> : <Copy width={12} height={12} className="text-text-muted" />}
    </button>
  );
}

/** Explorer link chip. */
export function TxChip({href, label, tone = "outline"}: {href: string; label: string; tone?: ChipTone}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none transition hover:brightness-95 ${toneClass[tone]}`}
    >
      <span className="tabular-nums tracking-tight">{label}</span>
      <ArrowUpRight width={12} height={12} className="text-text-muted" />
    </a>
  );
}
