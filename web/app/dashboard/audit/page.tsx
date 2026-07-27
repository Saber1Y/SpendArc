"use client";

import {useState} from "react";
import {DEMO} from "@/lib/contracts";
import {useActionHistory} from "@/lib/hooks";
import {formatMusd, truncateAddress, truncateHash} from "@/lib/format";
import {explorerTx} from "@/lib/chain";
import {TxChip} from "@/components/ui/Chip";

type EventFilter = "all" | "approved" | "blocked";

function EventType({kind, reason}: {kind: "approved" | "blocked"; reason?: string}) {
  if (kind === "approved") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-state-approved-light text-[11px] font-medium text-state-approved">
        <span className="h-1 w-1 rounded-full bg-state-approved" />
        Payment Approved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-state-blocked-light text-[11px] font-medium text-state-blocked">
      <span className="h-1 w-1 rounded-full bg-state-blocked" />
      Payment Blocked
    </span>
  );
}

function AuditEntry({action}: {action: ReturnType<typeof useActionHistory>["actions"][0]}) {
  const timestamp = new Date(); // Would come from block timestamp in production
  const timeStr = timestamp.toLocaleTimeString("en-US", {hour: "2-digit", minute: "2-digit"});
  const dateStr = timestamp.toLocaleDateString("en-US", {month: "short", day: "numeric"});

  return (
    <div className="flex items-start gap-4 py-4 border-b border-border last:border-0">
      {/* Timeline dot */}
      <div className="flex flex-col items-center pt-1">
        <span className={`h-2 w-2 rounded-full ${action.kind === "approved" ? "bg-state-approved" : "bg-state-blocked"}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <EventType kind={action.kind} />
          <span className="text-[11px] text-text-muted">{dateStr} {timeStr}</span>
        </div>
        <div className="text-[13px] text-text-primary">
          Agent <span className="font-mono text-accent">{truncateAddress(action.agent)}</span> requested{" "}
          <span className="font-medium">{formatMusd(action.amount)} mUSD</span> to{" "}
          <span className="font-mono">{truncateAddress(action.target)}</span>
        </div>
        {action.kind === "blocked" && action.reason && (
          <div className="text-[12px] text-text-muted mt-1">
            Reason: {action.reason}
          </div>
        )}
        {action.kind === "approved" && (
          <div className="text-[12px] text-text-muted mt-1">
            Payment executed and settled
          </div>
        )}
      </div>

      {/* Transaction hash */}
      <div className="shrink-0">
        <TxChip href={explorerTx(action.txHash)} label={truncateHash(action.txHash)} />
      </div>
    </div>
  );
}

export default function AuditPage() {
  const agent = DEMO.agent;
  const {actions, loading, error, refetch} = useActionHistory(agent);
  const [filter, setFilter] = useState<EventFilter>("all");

  const filtered = filter === "all" ? actions : actions.filter((a) => a.kind === filter);

  const filters: {value: EventFilter; label: string; count: number}[] = [
    {value: "all", label: "All Events", count: actions.length},
    {value: "approved", label: "Approved", count: actions.filter((a) => a.kind === "approved").length},
    {value: "blocked", label: "Blocked", count: actions.filter((a) => a.kind === "blocked").length},
  ];

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <div className="mb-6">
        <h1 className="text-[20px] font-semibold text-text-primary tracking-tight">Audit Log</h1>
        <p className="text-[13px] text-text-muted mt-1">Complete timeline of spending decisions and policy events</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6">
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

      {/* Audit timeline */}
      <div className="kpi-card">
        <div className="px-5">
          {loading && filtered.length === 0 ? (
            <div className="space-y-4 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-4 animate-pulse">
                  <div className="h-2 w-2 rounded-full bg-surface-hover mt-1" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-surface-hover rounded" />
                    <div className="h-3 w-64 bg-surface-hover rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : error && filtered.length === 0 ? (
            <div className="py-12 text-center">
              <div className="text-[13px] text-state-blocked">Failed to load audit log</div>
              <button onClick={refetch} className="text-[12px] text-accent hover:underline mt-2">
                Try again
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <div className="text-[13px] text-text-secondary">No audit events</div>
              <div className="text-[12px] text-text-muted mt-1">
                Spending decisions will be logged here as they occur.
              </div>
            </div>
          ) : (
            <div>
              {filtered.map((action) => (
                <AuditEntry key={`${action.txHash}:${action.logIndex}`} action={action} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
