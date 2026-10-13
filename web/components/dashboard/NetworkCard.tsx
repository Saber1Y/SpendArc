"use client";

import {useActiveNetwork} from "@/lib/useNetwork";
import {NETWORKS, type NetworkKey} from "@/lib/networks";

/**
 * Network display + mainnet/testnet switch for Settings. Switching persists a cookie and reloads so
 * the whole app (chain config, contract addresses, wallet, and the network each new agent is bound
 * to) follows the choice. Agents already registered stay on the network they were created on.
 */
export function NetworkCard() {
  const {networkKey, network, switchNetwork} = useActiveNetwork();

  return (
    <div className="space-y-4 text-[13px]">
      <div className="inline-flex rounded-lg border border-border bg-surface-muted p-0.5">
        {(Object.keys(NETWORKS) as NetworkKey[]).map((k) => (
          <button
            key={k}
            onClick={() => switchNetwork(k)}
            className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
              networkKey === k ? "bg-white text-text-primary shadow-sm" : "text-text-muted hover:text-text-primary"
            }`}
          >
            {NETWORKS[k].label}
          </button>
        ))}
      </div>

      {network.testnet && (
        <div className="rounded-lg border border-state-pending/30 bg-state-pending-light px-3 py-2 text-[12px] text-text-muted">
          Testnet mode - safe for trying the product first. Funds here have no value. Agents you register now are bound to testnet.
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-text-muted">Chain</span>
          <span className="text-text-primary font-medium">{network.label} ({network.chainId})</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-text-muted">RPC</span>
          <span className="text-text-primary font-mono text-[12px] truncate max-w-[350px]">{network.rpcUrl}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-text-muted">Explorer</span>
          <a href={network.explorerUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline text-[12px] truncate max-w-[350px]">
            {network.explorerUrl}
          </a>
        </div>
      </div>
    </div>
  );
}
