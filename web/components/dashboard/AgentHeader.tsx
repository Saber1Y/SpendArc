import type {Address} from "viem";
import {CopyChip, TxChip} from "@/components/ui/Chip";
import {GaslessStatusBadge} from "./GaslessStatusBadge";
import {explorerAddress} from "@/lib/chain";
import {truncateAddress} from "@/lib/format";
import type {VaultState} from "@/lib/reads";

export function AgentHeader({
  agent,
  state,
  loading,
  onRefresh,
}: {
  agent: Address;
  state: VaultState | undefined;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">Agent vault - BOT Chain 968</span>
        <h1 className="text-[24px] font-semibold text-text-primary tracking-tight">
          Spend control
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <CopyChip value={agent} label={truncateAddress(agent)} tone="lavender" />
          <TxChip href={explorerAddress(agent)} label="on explorer" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <GaslessStatusBadge
          paymasterDeposit={state?.paymasterDeposit}
          agentNative={state?.agentNative}
          agentDeposit={state?.agentDeposit}
          loading={loading && !state}
        />
        <button
          onClick={onRefresh}
          disabled={loading}
          className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-text-secondary hover:bg-surface-hover disabled:opacity-50 transition-colors"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
    </div>
  );
}
