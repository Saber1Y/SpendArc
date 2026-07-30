"use client";

import {useAccount} from "wagmi";
import {useVaultState, useActionHistory} from "@/lib/hooks";
import {isSameAddress, formatUsdc, truncateAddress, truncateHash} from "@/lib/format";
import {explorerTx, explorerAddress} from "@/lib/chain";
import {TxChip} from "@/components/ui/Chip";
import {StateBadge} from "@/components/ui/StateBadge";
import {DailyCapMeter} from "@/components/dashboard/DailyCapMeter";

function KPICard({label, value, sub, accent}: {label: string; value: string | number; sub?: string; accent?: boolean}) {
  return (
    <div className="kpi-card p-5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary mb-2">{label}</div>
      <div className={`text-2xl font-semibold tracking-tight ${accent ? "text-accent" : "text-text-primary"}`}>
        {value}
      </div>
      {sub && <div className="text-[12px] text-text-muted mt-1">{sub}</div>}
    </div>
  );
}

function EmptyState({title, description}: {title: string; description: string}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-[13px] font-medium text-text-secondary mb-1">{title}</div>
      <div className="text-[12px] text-text-muted max-w-[280px]">{description}</div>
    </div>
  );
}

function PolicyHealthCard({state}: {state: ReturnType<typeof useVaultState>["data"]}) {
  if (!state) return null;
  const {policy, remainingDailyCap} = state;
  const expiryDate = policy.expiry === 0n ? null : new Date(Number(policy.expiry) * 1000);
  const isExpired = expiryDate ? expiryDate < new Date() : false;

  return (
    <div className="kpi-card p-5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary mb-4">Policy Health</div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-muted">Per-transaction limit</span>
          <span className="text-[13px] font-medium text-text-primary tabular-nums">{formatUsdc(policy.maxPerTx)} mUSD</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-muted">Daily spending limit</span>
          <span className="text-[13px] font-medium text-text-primary tabular-nums">{formatUsdc(policy.dailyCap)} mUSD</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-muted">Remaining daily allowance</span>
          <span className="text-[13px] font-medium text-text-primary tabular-nums">{formatUsdc(remainingDailyCap)} mUSD</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-muted">Policy expiry</span>
          <span className={`text-[13px] font-medium ${isExpired ? "text-state-blocked" : "text-text-primary"}`}>
            {expiryDate ? expiryDate.toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric"}) : "Never"}
          </span>
        </div>
        <div className="border-t border-border my-2" />
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-muted">Allowlisted recipients</span>
          <span className="text-[13px] font-medium text-text-primary">{"1"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-muted">Allowlisted tokens</span>
          <span className="text-[13px] font-medium text-text-primary">{state.tokenAllowed ? "1" : "0"}</span>
        </div>
      </div>
      <div className="mt-4">
        <DailyCapMeter spent={policy.spentToday} cap={policy.dailyCap} remaining={remainingDailyCap} />
      </div>
    </div>
  );
}

function AgentHealthCard({state, loading, agent}: {state: ReturnType<typeof useVaultState>["data"]; loading: boolean; agent: string}) {
  return (
    <div className="kpi-card p-5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary mb-4">Agent Health</div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-muted">Agent wallet</span>
          <span className="text-[12px] font-medium text-text-primary font-mono">{truncateAddress(agent)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-muted">Authorization</span>
          {loading ? (
            <span className="text-[12px] text-text-muted">Loading...</span>
          ) : state?.policy.active ? (
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-state-approved">
              <span className="h-1.5 w-1.5 rounded-full bg-state-approved" /> Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-state-blocked">
              <span className="h-1.5 w-1.5 rounded-full bg-state-blocked" /> Revoked
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-muted">Vault balance</span>
          <span className="text-[13px] font-medium text-text-primary tabular-nums">
            {state ? <>{formatUsdc(state.vaultBalance)} <span className="text-text-muted">mUSD</span></> : "-"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-muted">Current allowance</span>
          <span className="text-[13px] font-medium text-text-primary tabular-nums">
            {state ? <>{formatUsdc(state.remainingDailyCap)} <span className="text-text-muted">mUSD</span></> : "-"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-muted">Gas status</span>
          {loading ? (
            <span className="text-[12px] text-text-muted">-</span>
          ) : state && false ? (
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-state-approved">
              <span className="h-1.5 w-1.5 rounded-full bg-state-approved" /> Funded
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-state-pending">
              <span className="h-1.5 w-1.5 rounded-full bg-state-pending" /> Unfunded
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function RecentActivity({actions, loading}: {actions: ReturnType<typeof useActionHistory>["actions"]; loading: boolean}) {
  const recent = actions.slice(0, 5);

  if (loading && recent.length === 0) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
            <div className="h-5 w-16 rounded-full bg-surface-hover" />
            <div className="h-4 flex-1 bg-surface-hover rounded" />
            <div className="h-4 w-20 bg-surface-hover rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (recent.length === 0) {
    return <EmptyState title="No activity yet" description="Spending decisions will appear here as agents make requests." />;
  }

  return (
    <div className="divide-y divide-border">
      {recent.map((action) => (
        <div key={`${action.txHash}:${action.logIndex}`} className="flex items-center gap-4 py-3">
          <StateBadge kind={action.kind} />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-text-primary">
              {formatUsdc(action.amount)} mUSD
              <span className="text-text-muted ml-1.5">to {truncateAddress(action.target)}</span>
            </div>
            <div className="text-[12px] text-text-muted mt-0.5">
              {action.kind === "blocked" ? action.reason ?? "Policy violation" : "Approved"}
            </div>
          </div>
          <TxChip href={explorerTx(action.txHash)} label={truncateHash(action.txHash)} />
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const agent = "0xCc19a6CD4c18Ea52a0E49DAb62c5C0F22800fa2B" as const;
  const {data: state, loading, error, refetch} = useVaultState(agent);
  const history = useActionHistory(agent);
  const {address, isConnected} = useAccount();

  const isOwner = isConnected && !!state && isSameAddress(address, state.vaultOwner);
  const approvedCount = history.actions.filter((a) => a.kind === "approved").length;
  const blockedCount = history.actions.filter((a) => a.kind === "blocked").length;
  const spentToday = state?.policy.spentToday ?? 0n;

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[24px] font-semibold text-text-primary tracking-tight">SpendArc</h1>
        <p className="text-[13px] text-text-muted mt-1">
          Control what autonomous agents can spend, where they can spend it, and how much they can spend.
        </p>
        <div className="flex items-center gap-4 mt-3">
          <span className="inline-flex items-center gap-1.5 text-[12px] text-text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-state-approved" />
            Arc Testnet
          </span>
          {isConnected && address && (
            <span className="text-[12px] text-text-muted">{truncateAddress(address)}</span>
          )}
          <span className="text-[12px] text-text-muted">
            Settlement: {state ? "Active" : "Pending"}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <KPICard label="Total USDC Controlled" value={state ? `$${formatUsdc(state.vaultBalance)}` : "$0"} sub="mUSD in vault" accent />
        <KPICard label="Spent Today" value={state ? `$${formatUsdc(spentToday)}` : "$0"} sub="mUSD" />
        <KPICard label="Remaining Daily" value={state ? `$${formatUsdc(state.remainingDailyCap)}` : "$0"} sub="mUSD" />
        <KPICard label="Approved" value={approvedCount} sub="transactions" />
        <KPICard label="Blocked" value={blockedCount} sub="transactions" />
        <KPICard
          label="Agent Status"
          value={loading ? "..." : state?.policy.active ? "Active" : "Revoked"}
          sub={state?.policy.active ? "Policy enforced" : "Needs attention"}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Spending Analytics */}
          <div className="kpi-card p-5">
            <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary mb-4">Spending Analytics</div>
            {history.actions.length === 0 ? (
              <EmptyState title="No spending data yet" description="Once the agent makes spending requests, analytics will appear here." />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-state-approved" />
                    <span className="text-[12px] text-text-muted">{approvedCount} approved</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-state-blocked" />
                    <span className="text-[12px] text-text-muted">{blockedCount} blocked</span>
                  </div>
                </div>
                <div className="h-32 flex items-end gap-1">
                  {/* Simple bar visualization */}
                  {history.actions.slice(0, 20).reverse().map((action, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-t ${action.kind === "approved" ? "bg-state-approved/30" : "bg-state-blocked/30"}`}
                      style={{height: `${Math.max(10, Number(action.amount) / 100000)}%`}}
                    />
                  ))}
                </div>
                <div className="text-[11px] text-text-muted text-center">Recent spending decisions (newest right)</div>
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="kpi-card">
            <div className="px-5 pt-5 pb-3">
              <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">Recent Activity</div>
            </div>
            <div className="px-5 pb-5">
              <RecentActivity actions={history.actions} loading={history.loading} />
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <PolicyHealthCard state={state} />
          <AgentHealthCard state={state} loading={loading} agent={agent} />
        </div>
      </div>
    </div>
  );
}
