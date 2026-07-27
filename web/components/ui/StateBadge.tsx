/**
 * The fence-outcome badge. Approved = green solid. Blocked = red solid.
 * A block is the fence working as designed.
 */
export function StateBadge({kind, className = ""}: {kind: "approved" | "blocked"; className?: string}) {
  if (kind === "approved") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full bg-state-approved-light px-2.5 py-1 text-[11px] font-medium text-state-approved ${className}`}
      >
        <span className="h-1 w-1 rounded-full bg-state-approved" />
        Approved
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-state-blocked-light px-2.5 py-1 text-[11px] font-medium text-state-blocked ${className}`}
    >
      <span className="h-1 w-1 rounded-full bg-state-blocked" />
      Blocked
    </span>
  );
}
