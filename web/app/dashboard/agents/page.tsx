"use client";

import {useAccount} from "wagmi";
import {useApiAgents, useVaultState} from "@/lib/hooks";
import {isSameAddress, formatUsdc, truncateAddress} from "@/lib/format";
import {explorerAddress, explorerTx} from "@/lib/chain";

function AgentCard({agent, state, loading}: {agent: {id: string; name: string; address: string}; state: ReturnType<typeof useVaultState>["data"]; loading: boolean}) {
  return (
    <div className="kpi-card p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-[13px] font-semibold text-text-primary">{agent.name}</div>
          <div className="text-[12px] text-text-muted mt-0.5">ID: {agent.id}</div>
        </div>
        {loading && !state ? (
          <div className="h-5 w-16 rounded-full bg-surface-hover animate-pulse" />
        ) : state?.policy.active ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-state-approved-light text-[12px] font-medium text-state-approved">
            <span className="h-1.5 w-1.5 rounded-full bg-state-approved" /> Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-state-blocked-light text-[12px] font-medium text-state-blocked">
            <span className="h-1.5 w-1.5 rounded-full bg-state-blocked" /> No Policy
          </span>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between py-2 border-b border-border">
          <span className="text-[12px] text-text-muted">Agent address</span>
          <a href={explorerAddress(agent.address as `0x${string}`)} target="_blank" rel="noopener noreferrer" className="text-[12px] font-mono text-accent hover:underline">
            {truncateAddress(agent.address as `0x${string}`)}
          </a>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-border">
          <span className="text-[12px] text-text-muted">Network</span>
          <span className="text-[12px] text-text-primary">Arc Testnet</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-border">
          <span className="text-[12px] text-text-muted">Vault balance</span>
          <span className="text-[13px] font-medium text-text-primary tabular-nums">
            {loading && !state ? "-" : <>{formatUsdc(state?.vaultBalance ?? 0n)} USDC</>}
          </span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-[12px] text-text-muted">Policy authorization</span>
          {loading && !state ? (
            <span className="text-[12px] text-text-muted">-</span>
          ) : state?.policy.active ? (
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-state-approved">
              <span className="h-1.5 w-1.5 rounded-full bg-state-approved" /> Authorized
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-state-blocked">
              <span className="h-1.5 w-1.5 rounded-full bg-state-blocked" /> Not authorized
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function VaultSummary({state, loading}: {state: ReturnType<typeof useVaultState>["data"]; loading: boolean}) {
  return (
    <div className="kpi-card p-6">
      <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary mb-4">Vault Summary</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-lg border border-accent/20 bg-accent-light/30">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="text-[12px] font-medium text-text-primary">Vault Funds</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-text-muted">USDC balance</span>
              <span className="text-[13px] font-medium text-accent tabular-nums">
                {loading && !state ? "-" : <>{formatUsdc(state?.vaultBalance ?? 0n)} USDC</>}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-text-muted">Remaining daily cap</span>
              <span className="text-[13px] font-medium text-text-primary tabular-nums">
                {loading && !state ? "-" : <>{formatUsdc(state?.remainingDailyCap ?? 0n)} USDC</>}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-accent/20">
            <div className="text-[11px] text-text-muted">
              The agent can request spending. The vault enforces policy on-chain.
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2 w-2 rounded-full bg-state-pending" />
            <span className="text-[12px] font-medium text-text-primary">Settlement</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-text-muted">Network</span>
              <span className="text-[12px] text-text-primary">Arc Testnet</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-text-muted">Token</span>
              <span className="text-[12px] text-text-primary">USDC</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const {agents, loading: agentsLoading} = useApiAgents();
  const firstAgent = agents[0];
  const {data: state, loading: vaultLoading} = useVaultState(
    (firstAgent?.address ?? "0x3F5b96A494061F7338Da529e3047809Ac6a7FB84") as `0x${string}`
  );
  const loading = agentsLoading || vaultLoading;

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <div className="mb-6">
        <h1 className="text-[20px] font-semibold text-text-primary tracking-tight">Agents</h1>
        <p className="text-[13px] text-text-muted mt-1">Agent wallet management and authorization status</p>
      </div>

      <div className="space-y-6">
        {agents.length === 0 && !agentsLoading ? (
          <div className="kpi-card p-8 text-center">
            <div className="text-[13px] text-text-secondary">No agents configured</div>
            <div className="text-[12px] text-text-muted mt-1">
              Create an agent via POST /api/agents to get started.
            </div>
          </div>
        ) : (
          agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} state={state} loading={loading} />
          ))
        )}
        {firstAgent && <VaultSummary state={state} loading={loading} />}
      </div>
    </div>
  );
}
