"use client";

import {useVaultState} from "@/lib/hooks";
import {useApiTransactions, txToAction} from "@/lib/hooks";
import {formatUsdc} from "@/lib/format";
import {CONTRACTS} from "@/lib/contracts";

function StatCard({label, value, sub, accent, delay = 0}: {label: string; value: string | number; sub?: string; accent?: boolean; delay?: number}) {
  return (
    <div className="kpi-card p-5" data-aos="fade-up" data-aos-delay={delay}>
      <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary mb-2">{label}</div>
      <div className={`text-[20px] font-semibold tracking-tight ${accent ? "text-accent" : "text-text-primary"}`}>
        {value}
      </div>
      {sub && <div className="text-[12px] text-text-muted mt-1">{sub}</div>}
    </div>
  );
}

function RecentSettlement({transactions}: {transactions: ReturnType<typeof useApiTransactions>["transactions"]}) {
  const confirmed = transactions.filter((t) => t.execution_status === "CONFIRMED").slice(0, 5);

  if (confirmed.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="text-[13px] text-text-secondary">No settlements yet</div>
        <div className="text-[12px] text-text-muted mt-1">Approved payments will appear here once settled.</div>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {confirmed.map((tx) => (
        <div key={tx.id} className="flex items-center justify-between py-3">
          <div>
            <div className="text-[13px] font-medium text-text-primary">{formatUsdc(BigInt(tx.amount))} USDC</div>
            <div className="text-[12px] text-text-muted mt-0.5">Settled on Arc Testnet</div>
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
  const {transactions, loading} = useApiTransactions();
  const vault = "0xf23147Df55089eA6bA87BF24bb4eEE6f7Cea182b" as const;

  const confirmedCount = transactions.filter((t) => t.execution_status === "CONFIRMED").length;
  const blockedCount = transactions.filter((t) => t.execution_status === "BLOCKED").length;
  const failedCount = transactions.filter((t) => t.execution_status === "FAILED").length;

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <div className="mb-6" data-aos="fade-up">
        <h1 className="text-[20px] font-semibold text-text-primary tracking-tight">Payments / Settlement</h1>
        <p className="text-[13px] text-text-muted mt-1">Payment infrastructure and settlement status</p>
      </div>

      <div className="kpi-card p-5 mb-6" data-aos="fade-up">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-state-approved" />
          <div>
            <div className="text-[13px] font-medium text-text-primary">Settlement Network</div>
            <div className="text-[12px] text-text-muted">Arc Testnet (5042002)</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Settled" value={confirmedCount} sub="payments" accent />
        <StatCard label="Pending" value={transactions.length - confirmedCount - blockedCount - failedCount} sub="payments" delay={60} />
        <StatCard label="Failed" value={failedCount + blockedCount} sub="blocked" delay={120} />
        <StatCard label="Vault" value="Arc Testnet" sub={`Vault: ${vault.slice(0, 10)}...`} delay={180} />
      </div>

      <div className="kpi-card" data-aos="fade-up" data-aos-delay="120">
        <div className="px-5 pt-5 pb-3">
          <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">Recent Settlements</div>
        </div>
        <div className="px-5 pb-5">
          <RecentSettlement transactions={transactions} />
        </div>
      </div>
    </div>
  );
}
