import type {ReactNode} from "react";

/** A labelled stat - caption label + light-weight value + optional sub/units. */
export function StatTile({
  label,
  value,
  sub,
  valueClassName = "",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">{label}</span>
      <span className={`text-[18px] font-semibold text-text-primary ${valueClassName}`}>
        {value}
      </span>
      {sub ? <span className="text-[12px] text-text-muted">{sub}</span> : null}
    </div>
  );
}
