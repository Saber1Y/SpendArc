import {formatMusd} from "@/lib/format";

/** Daily-cap progress bar for the SpendArc dashboard. */
export function DailyCapMeter({spent, cap, remaining}: {spent: bigint; cap: bigint; remaining: bigint}) {
  const pct = cap > 0n ? Math.min(100, Number((spent * 10000n) / cap) / 100) : 0;
  const nearCap = pct >= 90;

  return (
    <div>
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="text-text-muted">Spent today</span>
        <span className="text-text-primary font-medium tabular-nums">
          {formatMusd(spent)} / {formatMusd(cap)} mUSD
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-hover">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${nearCap ? "bg-state-pending" : "bg-accent"}`}
          style={{width: `${Math.max(pct, spent > 0n ? 4 : 0)}%`}}
        />
      </div>
      <div className="mt-1.5 text-[11px] text-text-muted tabular-nums">{formatMusd(remaining)} mUSD remaining today</div>
    </div>
  );
}
