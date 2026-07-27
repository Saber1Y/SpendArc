"use client";

import {useAccount} from "wagmi";
import {DEMO, CONTRACTS} from "@/lib/contracts";
import {useVaultState} from "@/lib/hooks";
import {isSameAddress, formatMusd, formatBot, truncateAddress} from "@/lib/format";
import {explorerAddress} from "@/lib/chain";

function AgentCard({state, loading, agent}: {state: NonNullable<ReturnType<typeof useVaultState>["data"]> | undefined; loading: boolean; agent: string}) {
  return (
    <div className="kpi-card p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-[13px] font-semibold text-text-primary">Agent Wallet</div>
          <div className="text-[12px] text-text-muted mt-0.5">ERC-4337 SimpleAccount</div>
        </div>
        {loading && !state ? (
          <div className="h-5 w-16 rounded-full bg-surface-hover animate-pulse" />
        ) : state?.policy.active ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-state-approved-light text-[12px] font-medium text-state-approved">
            <span className="h-1.5 w-1.5 rounded-full bg-state-approved" /> Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-state-blocked-light text-[12px] font-medium text-state-blocked">
            <span className="h-1.5 w-1.5 rounded-full bg-state-blocked" /> Revoked
          </span>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between py-2 border-b border-border">
          <span className="text-[12px] text-text-muted">Agent address</span>
          <a href={explorerAddress(agent)} target="_blank" rel="noopener noreferrer" className="text-[12px] font-mono text-accent hover:underline">
            {truncateAddress(agent)}
          </a>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-border">
          <span className="text-[12px] text-text-muted">Owner address</span>
          <a href={explorerAddress(DEMO.agentOwnerEOA)} target="_blank" rel="noopener noreferrer" className="text-[12px] font-mono text-accent hover:underline">
            {truncateAddress(DEMO.agentOwnerEOA)}
          </a>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-border">
          <span className="text-[12px] text-text-muted">Network</span>
          <span className="text-[12px] text-text-primary">BOT Chain 968</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-border">
          <span className="text-[12px] text-text-muted">Deployment status</span>
          {loading && !state ? (
            <span className="text-[12px] text-text-muted">-</span>
          ) : state?.agentDeployed ? (
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-state-approved">
              <span className="h-1.5 w-1.5 rounded-full bg-state-approved" /> Deployed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-state-pending">
              <span className="h-1.5 w-1.5 rounded-full bg-state-pending" /> Not deployed
            </span>
          )}
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

function FundsComparison({state, loading}: {state: NonNullable<ReturnType<typeof useVaultState>["data"]> | undefined; loading: boolean}) {
  return (
    <div className="kpi-card p-6">
      <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary mb-4">Fund Distribution</div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Agent funds */}
        <div className="p-4 rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2 w-2 rounded-full bg-state-pending" />
            <span className="text-[12px] font-medium text-text-primary">Agent Funds</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-text-muted">Native balance</span>
              <span className="text-[13px] font-medium text-text-primary tabular-nums">
                {loading && !state ? "-" : <>{formatBot(state?.agentNative ?? 0n)} <span className="text-text-muted">BOT</span></>}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-text-muted">Paymaster deposit</span>
              <span className="text-[13px] font-medium text-text-primary tabular-nums">
                {loading && !state ? "-" : <>{formatBot(state?.agentDeposit ?? 0n)} <span className="text-text-muted">BOT</span></>}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border">
            <div className="text-[11px] text-text-muted">
              The agent holds minimal funds for gasless operations only.
            </div>
          </div>
        </div>

        {/* User-controlled funds */}
        <div className="p-4 rounded-lg border border-accent/20 bg-accent-light/30">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="text-[12px] font-medium text-text-primary">User-Controlled Funds</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-text-muted">Vault balance</span>
              <span className="text-[13px] font-medium text-accent tabular-nums">
                {loading && !state ? "-" : <>{formatMusd(state?.vaultBalance ?? 0n)} <span className="text-text-muted">mUSD</span></>}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-text-muted">Owner balance</span>
              <span className="text-[13px] font-medium text-text-primary tabular-nums">
                {loading && !state ? "-" : <>{formatBot(state?.ownerNative ?? 0n)} <span className="text-text-muted">BOT</span></>}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-accent/20">
            <div className="text-[11px] text-text-muted">
              The agent can request spending. It does not have unrestricted access to the user&apos;s funds.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SponsorInfo({state, loading}: {state: NonNullable<ReturnType<typeof useVaultState>["data"]> | undefined; loading: boolean}) {
  return (
    <div className="kpi-card p-6">
      <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary mb-4">Payment Infrastructure</div>
      <div className="space-y-3">
        <div className="flex items-center justify-between py-2 border-b border-border">
          <span className="text-[12px] text-text-muted">Paymaster deposit</span>
          <span className="text-[13px] font-medium text-text-primary tabular-nums">
            {loading && !state ? "-" : <>{formatBot(state?.paymasterDeposit ?? 0n)} <span className="text-text-muted">BOT</span></>}
          </span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-border">
          <span className="text-[12px] text-text-muted">Gas sponsorship</span>
          {loading && !state ? (
            <span className="text-[12px] text-text-muted">-</span>
          ) : state && state.paymasterDeposit > 0n ? (
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-state-approved">
              <span className="h-1.5 w-1.5 rounded-full bg-state-approved" /> Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-state-pending">
              <span className="h-1.5 w-1.5 rounded-full bg-state-pending" /> Unfunded
            </span>
          )}
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-[12px] text-text-muted">Settlement network</span>
          <span className="text-[12px] text-text-primary">Arc Testnet</span>
        </div>
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const agent = DEMO.agent;
  const {data: state, loading, error, refetch} = useVaultState(agent);

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <div className="mb-6">
        <h1 className="text-[20px] font-semibold text-text-primary tracking-tight">Agents</h1>
        <p className="text-[13px] text-text-muted mt-1">Agent wallet management and authorization status</p>
      </div>

      <div className="space-y-6">
        <AgentCard state={state} loading={loading} agent={agent} />
        <FundsComparison state={state} loading={loading} />
        <SponsorInfo state={state} loading={loading} />
      </div>
    </div>
  );
}
