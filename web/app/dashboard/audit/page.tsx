"use client";

import {useState} from "react";
import {useApiAuditLogs, type ApiAuditLog} from "@/lib/hooks";

type EventFilter = "all" | "approved" | "blocked";

function EventType({action}: {action: string}) {
  if (action === "transaction_created" || action === "transaction_updated") {
    const isApproved = action === "transaction_created";
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-state-approved-light text-[11px] font-medium text-state-approved">
        <span className="h-1 w-1 rounded-full bg-state-approved" />
        {isApproved ? "Transaction" : "Updated"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-state-blocked-light text-[11px] font-medium text-state-blocked">
      <span className="h-1 w-1 rounded-full bg-state-blocked" />
      Event
    </span>
  );
}

function AuditEntry({log}: {log: ApiAuditLog}) {
  const timestamp = new Date(log.created_at * 1000);
  const timeStr = timestamp.toLocaleTimeString("en-US", {hour: "2-digit", minute: "2-digit"});
  const dateStr = timestamp.toLocaleDateString("en-US", {month: "short", day: "numeric"});

  let details = log.details;
  try {
    const parsed = JSON.parse(log.details);
    details = Object.entries(parsed)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");
  } catch {}

  return (
    <div className="flex items-start gap-4 py-4 border-b border-border last:border-0">
      <div className="flex flex-col items-center pt-1">
        <span className="h-2 w-2 rounded-full bg-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <EventType action={log.action} />
          <span className="text-[11px] text-text-muted">{dateStr} {timeStr}</span>
        </div>
        <div className="text-[13px] text-text-primary break-all">
          <span className="font-medium">{log.action}</span>{" "}
          <span className="text-text-muted">on {log.entity_type}</span>
        </div>
        <div className="text-[12px] text-text-muted mt-1 font-mono">{details}</div>
      </div>
      <div className="shrink-0 text-[11px] text-text-muted tabular-nums">#{log.id}</div>
    </div>
  );
}

export default function AuditPage() {
  const {logs, loading, error, refetch} = useApiAuditLogs(100);
  const [filter, setFilter] = useState<EventFilter>("all");

  const filtered = filter === "all" ? logs : logs.filter((l) => l.action.includes(filter === "approved" ? "created" : "blocked"));

  const filters: {value: EventFilter; label: string; count: number}[] = [
    {value: "all", label: "All Events", count: logs.length},
    {value: "approved", label: "Created", count: logs.filter((l) => l.action.includes("created")).length},
    {value: "blocked", label: "Blocked", count: logs.filter((l) => l.action.includes("blocked")).length},
  ];

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <div className="mb-6">
        <h1 className="text-[20px] font-semibold text-text-primary tracking-tight">Audit Log</h1>
        <p className="text-[13px] text-text-muted mt-1">Complete timeline of spending decisions and policy events</p>
      </div>

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
              {filtered.map((log) => (
                <AuditEntry key={log.id} log={log} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
