"use client";

import {useState} from "react";
import {useApiTransactions, type ApiTransaction} from "@/lib/hooks";
import {formatUsdc, truncateAddress, truncateHash} from "@/lib/format";
import {explorerTx} from "@/lib/chain";
import {StateBadge} from "@/components/ui/StateBadge";
import {TxChip} from "@/components/ui/Chip";

type Filter = "all" | "confirmed" | "blocked" | "failed";

function StatusBadge({status}: {status: string}) {
  if (status === "CONFIRMED") return <StateBadge kind="approved" />;
  if (status === "BLOCKED") return <StateBadge kind="blocked" />;
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-state-pending-light text-[11px] font-medium text-state-pending">
      <span className="h-1 w-1 rounded-full bg-state-pending" /> {status}
    </span>
  );
}

/** Transaction history table with filter pills. Data comes from the parent (so it can refetch after an action). */
export function TransactionTable({transactions, loading}: {transactions: ApiTransaction[]; loading: boolean}) {
  const [filter, setFilter] = useState<Filter>("all");

  const filters: {value: Filter; label: string; count: number}[] = [
    {value: "all", label: "All", count: transactions.length},
    {value: "confirmed", label: "Confirmed", count: transactions.filter((t) => t.execution_status === "CONFIRMED").length},
    {value: "blocked", label: "Blocked", count: transactions.filter((t) => t.execution_status === "BLOCKED").length},
    {value: "failed", label: "Failed", count: transactions.filter((t) => t.execution_status === "FAILED").length},
  ];

  const filtered = filter === "all"
    ? transactions
    : transactions.filter((t) => {
        if (filter === "confirmed") return t.execution_status === "CONFIRMED";
        if (filter === "blocked") return t.execution_status === "BLOCKED";
        if (filter === "failed") return t.execution_status === "FAILED";
        return true;
      });

  return (
    <div className="kpi-card">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">Transaction History</div>
        <div className="flex items-center gap-1">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition motion-safe:active:scale-[0.98] ${
                filter === f.value ? "bg-accent/10 text-accent" : "text-text-muted hover:bg-surface-hover"
              }`}
            >
              {f.label}
              <span className="ml-1 text-[11px]">({f.count})</span>
            </button>
          ))}
        </div>
      </div>

      {loading && filtered.length === 0 ? (
        <div className="space-y-2 px-5 pb-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
              <div className="h-5 w-16 rounded-full bg-surface-hover" />
              <div className="h-4 flex-1 bg-surface-hover rounded" />
              <div className="h-4 w-20 bg-surface-hover rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-5 pb-12 text-center">
          <div className="text-[13px] text-text-secondary">No transactions found</div>
          <div className="text-[12px] text-text-muted mt-1">
            {filter === "all"
              ? "Give the handoff prompt to your AI agent and it will appear here once a payment is requested."
              : `No ${filter} transactions.`}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-[11px] font-medium text-text-muted uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-4 text-[11px] font-medium text-text-muted uppercase tracking-wider">Amount</th>
                <th className="text-left py-3 px-4 text-[11px] font-medium text-text-muted uppercase tracking-wider">Recipient</th>
                <th className="text-left py-3 px-4 text-[11px] font-medium text-text-muted uppercase tracking-wider">Purpose</th>
                <th className="text-left py-3 px-4 text-[11px] font-medium text-text-muted uppercase tracking-wider">Decision</th>
                <th className="text-left py-3 px-4 text-[11px] font-medium text-text-muted uppercase tracking-wider">Tx Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((tx) => (
                <tr key={tx.id} className="hover:bg-surface-hover/50 transition-colors">
                  <td className="py-3 px-4">{StatusBadge({status: tx.execution_status})}</td>
                  <td className="py-3 px-4 font-medium text-text-primary tabular-nums">{formatUsdc(BigInt(tx.amount))} USDC</td>
                  <td className="py-3 px-4 text-text-muted font-mono">{truncateAddress(tx.recipient as `0x${string}`)}</td>
                  <td className="py-3 px-4 text-text-muted max-w-[220px] truncate">{tx.purpose || "-"}</td>
                  <td className="py-3 px-4 text-text-muted">{tx.decision_code !== "APPROVED" ? tx.decision_code : "Approved"}</td>
                  <td className="py-3 px-4">
                    {tx.tx_hash ? (
                      <TxChip href={explorerTx(tx.tx_hash as `0x${string}`)} label={truncateHash(tx.tx_hash as `0x${string}`)} />
                    ) : (
                      <span className="text-text-muted">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Self-contained transaction history card for one agent (owns its own fetch). */
export function TransactionHistoryCard({agentId}: {agentId: string}) {
  const {transactions, loading} = useApiTransactions(agentId);
  return <TransactionTable transactions={transactions} loading={loading} />;
}
