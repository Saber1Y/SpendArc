"use client";

import {useEffect, useState} from "react";
import {useAccount} from "wagmi";
import {DEMO} from "@/lib/contracts";
import {useVaultState, useActionHistory} from "@/lib/hooks";
import {formatMusd, truncateAddress, truncateHash} from "@/lib/format";
import {explorerTx} from "@/lib/chain";
import {pollUserOpReceipt, resolveOutcome, type RunOutcome} from "@/lib/bundler";
import {StateBadge} from "@/components/ui/StateBadge";
import {TxChip} from "@/components/ui/Chip";

type Phase = "idle" | "running" | "polling" | "resolved" | "error";
interface RunState {
  phase: Phase;
  amount?: bigint;
  userOpHash?: `0x${string}`;
  outcome?: RunOutcome;
  error?: string;
}

type Filter = "all" | "approved" | "blocked" | "failed" | "pending";

function RunAgentSection({refetch}: {refetch: () => void}) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [run, setRun] = useState<RunState>({phase: "idle"});
  const [recipient, setRecipient] = useState(DEMO.vendor);
  const [amount, setAmount] = useState("4");
  const [purpose, setPurpose] = useState("");

  useEffect(() => {
    fetch("/api/sponsor")
      .then((r) => r.json())
      .then((d) => setConfigured(!!d.configured))
      .catch(() => setConfigured(false));
  }, []);

  const busy = run.phase === "running" || run.phase === "polling";

  const doRun = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return;
    const amountBase = BigInt(Math.round(amt * 1_000_000));

    setRun({phase: "running", amount: amountBase});
    try {
      const res = await fetch("/api/sponsor", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({amountBaseUnits: amountBase.toString()}),
      });
      const data = await res.json();
      if (!res.ok) {
        setRun({phase: "error", amount: amountBase, error: data.message ?? "Submission failed"});
        return;
      }
      const userOpHash = data.userOpHash as `0x${string}`;
      setRun({phase: "polling", amount: amountBase, userOpHash});
      const receipt = await pollUserOpReceipt(userOpHash);
      if (!receipt) {
        setRun({phase: "error", amount: amountBase, userOpHash, error: "Timed out waiting for inclusion."});
        return;
      }
      const outcome = resolveOutcome(receipt);
      setRun({phase: "resolved", amount: amountBase, userOpHash, outcome: outcome ?? undefined});
      refetch();
    } catch (e) {
      setRun({phase: "error", amount: amountBase, error: (e as Error)?.message ?? "Network error"});
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
        <span className={`px-2 py-1 rounded ${run.phase === "running" || run.phase === "polling" ? "bg-accent/10 text-accent" : "bg-surface-muted text-text-secondary"}`}>
          POLICY CHECK
        </span>
        <span className="text-text-muted">-</span>
        <span className={`px-2 py-1 rounded ${
          run.phase === "resolved" ? (run.outcome?.kind === "approved" ? "bg-state-approved-light text-state-approved" : "bg-state-blocked-light text-state-blocked") : "bg-surface-muted text-text-secondary"
        }`}>
          {run.phase === "resolved" ? (run.outcome?.kind === "approved" ? "APPROVED" : "BLOCKED") : "APPROVED / BLOCKED"}
        </span>
        <span className="text-text-muted">-</span>
        <span className={`px-2 py-1 rounded ${run.phase === "resolved" && run.outcome?.kind === "approved" ? "bg-state-approved-light text-state-approved" : "bg-surface-muted text-text-secondary"}`}>
          PAYMENT EXECUTED
        </span>
      </div>

      {configured === false ? (
        <div className="text-[12px] text-text-muted py-4">
          Live run is not configured on this server. The read-only dashboard is fully functional.
        </div>
      ) : (
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
              <label className="block text-[11px] font-medium text-text-muted mb-1.5 uppercase tracking-wider">Amount (mUSD)</label>
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
            disabled={busy || configured === null}
            className="rounded-lg bg-accent px-5 py-2.5 text-[13px] font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
          >
            {busy ? "Processing..." : "Submit Spending Request"}
          </button>
        </div>
      )}

      {/* Result */}
      {run.phase === "error" && (
        <div className="mt-4 rounded-lg border border-state-blocked/30 bg-state-blocked-light p-4">
          <div className="text-[13px] font-medium text-state-blocked">Error</div>
          <div className="text-[12px] text-text-muted mt-1">{run.error}</div>
        </div>
      )}
      {run.phase === "resolved" && run.outcome && (
        <div className={`mt-4 rounded-lg border p-4 ${
          run.outcome.kind === "approved"
            ? "border-state-approved/30 bg-state-approved-light"
            : "border-state-blocked/30 bg-state-blocked-light"
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <StateBadge kind={run.outcome.kind} />
          </div>
          <div className="text-[13px] text-text-primary">
            Requested: ${formatMusd(run.amount!)} mUSD
          </div>
          {run.outcome.kind === "blocked" && (
            <div className="text-[12px] text-text-muted mt-1">
              Reason: {run.outcome.reason ?? "Policy violation"}
            </div>
          )}
          {run.outcome.txHash && (
            <div className="mt-2">
              <TxChip href={explorerTx(run.outcome.txHash)} label={truncateHash(run.outcome.txHash)} />
            </div>
          )}
        </div>
      )}
      {run.phase === "running" || run.phase === "polling" ? (
        <div className="mt-4 flex items-center gap-2 text-[12px] text-text-muted">
          <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
          {run.phase === "running" ? "Sponsoring transaction..." : "Waiting for inclusion..."}
        </div>
      ) : null}
    </div>
  );
}

function TransactionTable({actions, loading, filter}: {actions: ReturnType<typeof useActionHistory>["actions"]; loading: boolean; filter: Filter}) {
  const filtered = filter === "all" ? actions : actions.filter((a) => a.kind === filter);

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

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-4 text-[11px] font-medium text-text-muted uppercase tracking-wider">Status</th>
            <th className="text-left py-3 px-4 text-[11px] font-medium text-text-muted uppercase tracking-wider">Amount</th>
            <th className="text-left py-3 px-4 text-[11px] font-medium text-text-muted uppercase tracking-wider">Token</th>
            <th className="text-left py-3 px-4 text-[11px] font-medium text-text-muted uppercase tracking-wider">Recipient</th>
            <th className="text-left py-3 px-4 text-[11px] font-medium text-text-muted uppercase tracking-wider">Policy Result</th>
            <th className="text-left py-3 px-4 text-[11px] font-medium text-text-muted uppercase tracking-wider">Tx Hash</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {filtered.map((action) => (
            <tr key={`${action.txHash}:${action.logIndex}`} className="hover:bg-surface-hover/50 transition-colors">
              <td className="py-3 px-4"><StateBadge kind={action.kind} /></td>
              <td className="py-3 px-4 font-medium text-text-primary tabular-nums">{formatMusd(action.amount)} mUSD</td>
              <td className="py-3 px-4 text-text-muted">mUSD</td>
              <td className="py-3 px-4 text-text-muted font-mono">{truncateAddress(action.target)}</td>
              <td className="py-3 px-4 text-text-muted">
                {action.kind === "blocked" ? action.reason ?? "Policy" : "Approved"}
              </td>
              <td className="py-3 px-4">
                <TxChip href={explorerTx(action.txHash)} label={truncateHash(action.txHash)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SpendingPage() {
  const agent = DEMO.agent;
  const {data: state, loading, error, refetch} = useVaultState(agent);
  const history = useActionHistory(agent);
  const [filter, setFilter] = useState<Filter>("all");

  const filters: {value: Filter; label: string; count: number}[] = [
    {value: "all", label: "All", count: history.actions.length},
    {value: "approved", label: "Approved", count: history.actions.filter((a) => a.kind === "approved").length},
    {value: "blocked", label: "Blocked", count: history.actions.filter((a) => a.kind === "blocked").length},
  ];

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <div className="mb-6">
        <h1 className="text-[20px] font-semibold text-text-primary tracking-tight">Spending</h1>
        <p className="text-[13px] text-text-muted mt-1">Agent spending operations and transaction history</p>
      </div>

      <div className="space-y-6">
        <RunAgentSection refetch={refetch} />

        <div className="kpi-card">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">Transaction History</div>
            <div className="flex items-center gap-1">
              {filters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
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
          <TransactionTable actions={history.actions} loading={history.loading} filter={filter} />
        </div>
      </div>
    </div>
  );
}
