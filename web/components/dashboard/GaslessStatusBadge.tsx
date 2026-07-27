/** Gas/sponsor status indicator for the SpendArc dashboard. */
export function GaslessStatusBadge({
  paymasterDeposit,
  agentNative,
  agentDeposit,
  loading,
}: {
  paymasterDeposit?: bigint;
  agentNative?: bigint;
  agentDeposit?: bigint;
  loading: boolean;
}) {
  if (loading || paymasterDeposit === undefined) {
    return <span className="text-[11px] text-text-muted">Checking sponsor...</span>;
  }
  const funded = paymasterDeposit > 0n;
  const holdsNothing = (agentNative ?? 0n) === 0n && (agentDeposit ?? 0n) === 0n;
  const active = funded && holdsNothing;

  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
      active ? "text-state-approved" : funded ? "text-state-pending" : "text-state-blocked"
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${
        active ? "bg-state-approved" : funded ? "bg-state-pending" : "bg-state-blocked"
      }`} />
      {active ? "Gasless active" : funded ? "Agent not empty" : "Sponsor unfunded"}
    </span>
  );
}
