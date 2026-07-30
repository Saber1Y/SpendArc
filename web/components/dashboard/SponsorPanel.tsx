import {Panel, PanelNote} from "./Panel";
import {StatTile} from "@/components/ui/StatTile";
import {Skeleton} from "@/components/ui/Row";
import {formatUsdc} from "@/lib/format";
import {truncateAddress} from "@/lib/format";
import type {VaultState} from "@/lib/reads";

export function SponsorPanel({
  state,
  loading,
  error,
  onRetry,
  className = "",
}: {
  state: VaultState | undefined;
  loading: boolean;
  error: Error | undefined;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <Panel title="Sponsor" subtitle="who pays the gas" className={className}>
      {!state && loading ? (
        <div className="space-y-4">
          <Skeleton className="h-9 w-32" />
        </div>
      ) : !state && error ? (
        <PanelNote tone="error">
          Couldn&rsquo;t load sponsor status.{" "}
          <button onClick={onRetry} className="underline">
            Retry
          </button>
        </PanelNote>
      ) : state ? (
        <div className="flex flex-col gap-5">
          <StatTile
            label="Vault balance"
            value={
              <>
                {formatUsdc(state.vaultBalance)} <span className="text-body text-fog">USDC</span>
              </>
            }
            sub={state.vaultBalance === 0n ? "fund the vault to enable spends" : undefined}
          />
        </div>
      ) : null}
    </Panel>
  );
}
