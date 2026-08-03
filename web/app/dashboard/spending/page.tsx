"use client";

import {useState} from "react";
import {useApiTransactions, useApiAgents} from "@/lib/hooks";
import {formatUsdc, truncateAddress, truncateHash} from "@/lib/format";
import {explorerTx} from "@/lib/chain";
import {StateBadge} from "@/components/ui/StateBadge";
import {TxChip} from "@/components/ui/Chip";

type Phase = "idle" | "submitting" | "polling" | "resolved" | "error";
interface RunState {
  phase: Phase;
  amount?: string;
  txHash?: string;
  error?: string;
  status?: string;
}

type Filter = "all" | "confirmed" | "blocked" | "failed";

function RunAgentSection({agentId, refetch}: {agentId: string; refetch: () => void}) {
  const [run, setRun] = useState<RunState>({phase: "idle"});
  const [recipient, setRecipient] = useState("0x3F5b96A494061F7338Da529e3047809Ac6a7FB84");
  const [amount, setAmount] = useState("1.5");
  const [purpose, setPurpose] = useState("");

  const busy = run.phase === "submitting" || run.phase === "polling";

  const doRun = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return;

    setRun({phase: "submitting", amount});

    try {
      const res = await fetch("/api/payments/request", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({agentId, recipient, amount, token: "usdc", purpose}),
      });

      const data = await res.json();

      if (data.status === "APPROVED") {
        setRun({phase: "resolved", amount, txHash: data.txHash, status: "CONFIRMED"});
        refetch();
      } else if (data.status === "BLOCKED" || data.status === "FAILED") {
        setRun({phase: "resolved", amount, error: data.reason ?? data.message, status: data.status});
        refetch();
      } else {
        setRun({phase: "error", amount, error: data.message ?? "Unknown response"});
      }
    } catch (e) {
      setRun({phase: "error", amount, error: (e as Error)?.message ?? "Network error"});
    }
  };

  return (
    <div className="kpi-card p-6">
      <div className="mb-1 text-[13px] font-semibold text-text-primary">Run Agent</div>
      <div className="mb-5 text-[12px] text-text-muted">
        The agent does not directly control user funds. SpendArc evaluates this request against the configured spending policy.
      </div>

      {/* Lifecycle indicator */}
      <div className="flex items-center gap-2 mb-6 text-[11px] font-medium text-text-muted">
        <span className={`px-2 py-1 rounded ${run.phase === "idle" ? "bg-surface-muted text-text-secondary" : "bg-accent/10 text-accent"}`}>
          REQUESTED
        </span>
        <span className="text-text-muted">-</span>
        <span className={`px-2 py-1 rounded ${run.phase === "submitting" || run.phase === "polling" ? "bg-accent/10 text-accent" : "bg-surface-muted text-text-secondary"}`}>
          POLICY CHECK
        </span>
        <span className="text-text-muted">-</span>
        <span className={`px-2 py-1 rounded ${
          run.phase === "resolved" ? (run.status === "CONFIRMED" ? "bg-state-approved-light text-state-approved" : "bg-state-blocked-light text-state-blocked") : "bg-surface-muted text-text-secondary"
        }`}>
          {run.phase === "resolved" ? (run.status === "CONFIRMED" ? "APPROVED" : "BLOCKED") : "APPROVED / BLOCKED"}
        </span>
        <span className="text-text-muted">-</span>
        <span className={`px-2 py-1 rounded ${run.phase === "resolved" && run.status === "CONFIRMED" ? "bg-state-approved-light text-state-approved" : "bg-surface-muted text-text-secondary"}`}>
          EXECUTED
        </span>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-medium text-text-muted mb-1.5 uppercase tracking-wider">Recipient</label>
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-[13px] text-text-primary font-mono outline-none focus:border-accent"
              spellCheck={false}
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-text-muted mb-1.5 uppercase tracking-wider">Amount (USDC)</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-[13px] text-text-primary tabular-nums outline-none focus:border-accent"
            />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-text-muted mb-1.5 uppercase tracking-wider">Purpose (optional)</label>
          <input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="e.g. API payment, vendor invoice"
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent placeholder:text-text-muted/50"
          />
        </div>
        <button
          onClick={doRun}
          disabled={busy}
          className="rounded-lg bg-accent px-5 py-2.5 text-[13px] font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? "Processing..." : "Submit Spending Request"}
        </button>
      </div>

      {/* Result */}
      {run.phase === "error" && (
        <div className="mt-4 rounded-lg border border-state-blocked/30 bg-state-blocked-light p-4">
          <div className="text-[13px] font-medium text-state-blocked">Error</div>
          <div className="text-[12px] text-text-muted mt-1">{run.error}</div>
        </div>
      )}
      {run.phase === "resolved" && (
        <div className={`mt-4 rounded-lg border p-4 ${
          run.status === "CONFIRMED"
            ? "border-state-approved/30 bg-state-approved-light"
            : "border-state-blocked/30 bg-state-blocked-light"
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <StateBadge kind={run.status === "CONFIRMED" ? "approved" : "blocked"} />
          </div>
          <div className="text-[13px] text-text-primary">
            Requested: ${run.amount} USDC
          </div>
          {run.status !== "CONFIRMED" && (
            <div className="text-[12px] text-text-muted mt-1">
              Reason: {run.error ?? "Policy violation"}
            </div>
          )}
          {run.txHash && (
            <div className="mt-2">
              <TxChip href={explorerTx(run.txHash as `0x${string}`)} label={truncateHash(run.txHash as `0x${string}`)} />
            </div>
          )}
        </div>
      )}
      {busy ? (
        <div className="mt-4 flex items-center gap-2 text-[12px] text-text-muted">
          <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
          Submitting payment request...
        </div>
      ) : null}
    </div>
  );
}

function TransactionTable({transactions, loading, filter}: {transactions: ReturnType<typeof useApiTransactions>["transactions"]; loading: boolean; filter: Filter}) {
  const filtered = filter === "all"
    ? transactions
    : transactions.filter((t) => {
        if (filter === "confirmed") return t.execution_status === "CONFIRMED";
        if (filter === "blocked") return t.execution_status === "BLOCKED";
        if (filter === "failed") return t.execution_status === "FAILED";
        return true;
      });

  if (loading && filtered.length === 0) {
    return (
      <div className="space-y-2">
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

  if (filtered.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="text-[13px] text-text-secondary">No transactions found</div>
        <div className="text-[12px] text-text-muted mt-1">
          {filter === "all" ? "Submit a spending request to see transactions here." : `No ${filter} transactions.`}
        </div>
      </div>
    );
  }

  const statusBadge = (status: string) => {
    if (status === "CONFIRMED") return <StateBadge kind="approved" />;
    if (status === "BLOCKED") return <StateBadge kind="blocked" />;
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-state-pending-light text-[11px] font-medium text-state-pending">
        <span className="h-1 w-1 rounded-full bg-state-pending" /> {status}
      </span>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-4 text-[11px] font-medium text-text-muted uppercase tracking-wider">Status</th>
            <th className="text-left py-3 px-4 text-[11px] font-medium text-text-muted uppercase tracking-wider">Amount</th>
            <th className="text-left py-3 px-4 text-[11px] font-medium text-text-muted uppercase tracking-wider">Token</th>
            <th className="text-left py-3 px-4 text-[11px] font-medium text-text-muted uppercase tracking-wider">Recipient</th>
            <th className="text-left py-3 px-4 text-[11px] font-medium text-text-muted uppercase tracking-wider">Decision</th>
            <th className="text-left py-3 px-4 text-[11px] font-medium text-text-muted uppercase tracking-wider">Tx Hash</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {filtered.map((tx) => (
            <tr key={tx.id} className="hover:bg-surface-hover/50 transition-colors">
              <td className="py-3 px-4">{statusBadge(tx.execution_status)}</td>
              <td className="py-3 px-4 font-medium text-text-primary tabular-nums">{formatUsdc(BigInt(tx.amount))} USDC</td>
              <td className="py-3 px-4 text-text-muted">USDC</td>
              <td className="py-3 px-4 text-text-muted font-mono">{truncateAddress(tx.recipient as `0x${string}`)}</td>
              <td className="py-3 px-4 text-text-muted">
                {tx.decision_code !== "APPROVED" ? tx.decision_code : "Approved"}
              </td>
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
  );
}

export default function SpendingPage() {
  const {agents} = useApiAgents();
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const agentId = selectedAgentId || agents[0]?.id || "";
  const {transactions, loading, refetch} = useApiTransactions(agentId);
  const [filter, setFilter] = useState<Filter>("all");

  const filters: {value: Filter; label: string; count: number}[] = [
    {value: "all", label: "All", count: transactions.length},
    {value: "confirmed", label: "Confirmed", count: transactions.filter((t) => t.execution_status === "CONFIRMED").length},
    {value: "blocked", label: "Blocked", count: transactions.filter((t) => t.execution_status === "BLOCKED").length},
    {value: "failed", label: "Failed", count: transactions.filter((t) => t.execution_status === "FAILED").length},
  ];

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <div className="mb-6" data-aos="fade-up">
        <h1 className="text-[20px] font-semibold text-text-primary tracking-tight">Spending</h1>
        <p className="text-[13px] text-text-muted mt-1">Agent spending operations and transaction history</p>
      </div>

      <div className="space-y-6">
        {agents.length > 0 && (
          <div className="kpi-card p-4 flex items-center gap-4" data-aos="fade-up">
            <span className="text-[12px] text-text-muted">Agent:</span>
            <select
              value={agentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="rounded-lg border border-border bg-white px-3 py-1.5 text-[13px] text-text-primary outline-none focus:border-accent"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.id.slice(0, 12)}...)</option>
              ))}
            </select>
          </div>
        )}
        {agentId ? (
          <div data-aos="fade-up">
            <RunAgentSection agentId={agentId} refetch={refetch} />
          </div>
        ) : (
          <div className="kpi-card p-8 text-center" data-aos="fade-up">
            <div className="text-[13px] text-text-secondary">No agent configured</div>
            <div className="text-[12px] text-text-muted mt-1">Create an agent on the Agents page first.</div>
          </div>
        )}

        <div className="kpi-card" data-aos="fade-up" data-aos-delay="100">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">Transaction History</div>
            <div className="flex items-center gap-1">
              {filters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition motion-safe:active:scale-[0.98] ${
                    filter === f.value
                      ? "bg-accent/10 text-accent"
                      : "text-text-muted hover:bg-surface-hover"
                  }`}
                >
                  {f.label}
                  <span className="ml-1 text-[11px]">({f.count})</span>
                </button>
              ))}
            </div>
          </div>
          <TransactionTable transactions={transactions} loading={loading} filter={filter} />
        </div>
      </div>
    </div>
  );
}
