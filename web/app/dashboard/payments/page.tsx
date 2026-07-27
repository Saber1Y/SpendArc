"use client";

import {useVaultState, useActionHistory} from "@/lib/hooks";
import {DEMO} from "@/lib/contracts";
import {formatMusd, formatBot} from "@/lib/format";

function StatCard({label, value, sub, accent}: {label: string; value: string | number; sub?: string; accent?: boolean}) {
  return (
    <div className="kpi-card p-5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary mb-2">{label}</div>
      <div className={`text-[20px] font-semibold tracking-tight ${accent ? "text-accent" : "text-text-primary"}`}>
        {value}
      </div>
      {sub && <div className="text-[12px] text-text-muted mt-1">{sub}</div>}
    </div>
  );
}

function RecentSettlement({actions}: {actions: ReturnType<typeof useActionHistory>["actions"]}) {
  const approved = actions.filter((a) => a.kind === "approved").slice(0, 5);

  if (approved.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="text-[13px] text-text-secondary">No settlements yet</div>
        <div className="text-[12px] text-text-muted mt-1">Approved payments will appear here once settled.</div>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {approved.map((action) => (
        <div key={`${action.txHash}:${action.logIndex}`} className="flex items-center justify-between py-3">
          <div>
            <div className="text-[13px] font-medium text-text-primary">{formatMusd(action.amount)} mUSD</div>
            <div className="text-[12px] text-text-muted mt-0.5">Settled on BOT Chain 968</div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-state-approved-light text-[11px] font-medium text-state-approved">
            Settled
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PaymentsPage() {
  const agent = DEMO.agent;
  const {data: state, loading} = useVaultState(agent);
  const history = useActionHistory(agent);

  const approvedCount = history.actions.filter((a) => a.kind === "approved").length;
  const blockedCount = history.actions.filter((a) => a.kind === "blocked").length;

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <div className="mb-6">
        <h1 className="text-[20px] font-semibold text-text-primary tracking-tight">Payments / Settlement</h1>
        <p className="text-[13px] text-text-muted mt-1">Payment infrastructure and settlement status</p>
      </div>

      {/* Network info */}
      <div className="kpi-card p-5 mb-6">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-state-approved" />
          <div>
            <div className="text-[13px] font-medium text-text-primary">Settlement Network</div>
            <div className="text-[12px] text-text-muted">Arc Testnet (via BOT Chain 968)</div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Settled" value={approvedCount} sub="payments" accent />
        <StatCard label="Pending" value={0} sub="payments" />
        <StatCard label="Failed" value={blockedCount} sub="blocked" />
        <StatCard label="USDC Contract" value="mUSD" sub={state ? `Balance: ${formatMusd(state.vaultBalance)} mUSD` : ""} />
      </div>

      {/* Recent settlements */}
      <div className="kpi-card">
        <div className="px-5 pt-5 pb-3">
          <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">Recent Settlements</div>
        </div>
        <div className="px-5 pb-5">
          <RecentSettlement actions={history.actions} />
        </div>
      </div>

      {/* Arc integration placeholder */}
      <div className="mt-6 rounded-lg border border-dashed border-border p-8 text-center">
        <div className="text-[13px] font-medium text-text-secondary mb-1">Arc USDC Integration</div>
        <div className="text-[12px] text-text-muted max-w-md mx-auto">
          Full Arc settlement rail integration coming soon. Currently using BOT Chain 968 with mUSD for demonstration.
        </div>
      </div>
    </div>
  );
}
