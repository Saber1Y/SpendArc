"use client";

import {useEffect, useState} from "react";
import {useApiAgentRuns, useApiAgentRun, useApiAgents, type ApiAgentRunEvent} from "@/lib/hooks";
import {truncateHash} from "@/lib/format";
import {explorerTx} from "@/lib/chain";
import {TxChip} from "@/components/ui/Chip";

function runStatusLabel(status: string): {label: string; className: string; dot: string} {
  switch (status) {
    case "running":
      return {label: "Running", className: "bg-state-pending-light text-state-pending", dot: "bg-state-pending animate-pulse"};
    case "completed":
      return {label: "Completed", className: "bg-state-approved-light text-state-approved", dot: "bg-state-approved"};
    case "completed_with_failures":
      return {label: "Completed (with failures)", className: "bg-state-blocked-light text-state-blocked", dot: "bg-state-blocked"};
    case "failed":
    case "error":
      return {label: "Failed", className: "bg-state-blocked-light text-state-blocked", dot: "bg-state-blocked"};
    default:
      return {label: status, className: "bg-surface-muted text-text-secondary", dot: "bg-text-muted"};
  }
}

function eventKindBadge(event: ApiAgentRunEvent) {
  const map: Record<string, {label: string; cls: string}> = {
    scenario: {label: "SCENARIO", cls: "bg-surface-muted text-text-secondary"},
    decision: {label: "DECISION", cls: "bg-accent/10 text-accent"},
    request: {label: "REQUEST", cls: "bg-accent/10 text-accent"},
    approved: {label: "APPROVED", cls: "bg-state-approved-light text-state-approved"},
    blocked: {label: "BLOCKED", cls: "bg-state-blocked-light text-state-blocked"},
    failed: {label: "FAILED", cls: "bg-state-blocked-light text-state-blocked"},
    passed: {label: "PASS", cls: "bg-state-approved-light text-state-approved"},
    fail: {label: "FAIL", cls: "bg-state-blocked-light text-state-blocked"},
    info: {label: "INFO", cls: "bg-surface-muted text-text-secondary"},
    error: {label: "ERROR", cls: "bg-state-blocked-light text-state-blocked"},
    run_end: {label: "END", cls: "bg-surface-muted text-text-secondary"},
  };
  const m = map[event.kind] ?? {label: event.kind.toUpperCase(), cls: "bg-surface-muted text-text-secondary"};
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${m.cls}`}>
      {m.label}
    </span>
  );
}

function EventRow({event}: {event: ApiAgentRunEvent}) {
  const time = new Date(event.created_at * 1000);
  const timeStr = time.toLocaleTimeString("en-US", {hour: "2-digit", minute: "2-digit", second: "2-digit"});

  let detailsText = "";
  try {
    const parsed = JSON.parse(event.details);
    if (typeof parsed === "object" && parsed !== null) {
      detailsText = Object.entries(parsed)
        .filter(([, v]) => typeof v === "string" || typeof v === "number")
        .map(([k, v]) => `${k}=${v}`)
        .join(" ");
    } else {
      detailsText = String(parsed);
    }
  } catch {}

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className="mt-0.5 shrink-0">{eventKindBadge(event)}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-text-primary break-words">{event.summary}</div>
        {detailsText && <div className="text-[11px] text-text-muted mt-0.5 font-mono break-all">{detailsText}</div>}
      </div>
      {event.tx_hash && (
        <div className="shrink-0">
          <TxChip href={explorerTx(event.tx_hash as `0x${string}`)} label={truncateHash(event.tx_hash as `0x${string}`)} />
        </div>
      )}
      <div className="shrink-0 text-[11px] text-text-muted tabular-nums mt-0.5">{timeStr}</div>
    </div>
  );
}

function LaunchCard({agentId, agentName}: {agentId: string; agentName: string}) {
  const [copied, setCopied] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const command = `node scripts/qa-agent.mjs --agent ${agentId}${apiKey ? ` --qa scripts/qa-user-agent.md --api-key ${apiKey}` : ""}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="kpi-card p-5 mb-6" data-aos="fade-up">
      <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary mb-3">Launch Autonomous QA Agent</div>
      <div className="text-[12px] text-text-muted mb-4">
        Runs the structured ```scenario blocks from QA.md against <span className="font-mono text-text-primary">{agentName}</span>. The opencode brain decides each request; SpendArc&apos;s policy engine approves or blocks it.
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-lg border border-border bg-surface-muted px-3 py-2 text-[12px] font-mono text-text-primary overflow-x-auto whitespace-nowrap">
            {command}
          </code>
          <button
            onClick={copy}
            className="rounded-lg bg-accent px-4 py-2 text-[12px] font-medium text-white hover:bg-accent-hover transition-colors"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value.trim())}
            placeholder="Optional: paste the agent's spend_... API key to launch as the agent (Bearer auth)"
            className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-[12px] font-mono text-text-primary outline-none focus:border-accent"
            spellCheck={false}
          />
        </div>
        {apiKey && (
          <div className="text-[11px] text-text-muted">
            With a key, the harness introspects its own leash via <code>/api/agents/me</code> and spends with{" "}
            <code>Authorization: Bearer</code> - exactly how a booth visitor&apos;s AI agent operates.
          </div>
        )}
      </div>
    </div>
  );
}

function DemoCard({agentId, agentName, onRun}: {agentId: string; agentName: string; onRun: (runId: string) => void}) {
  const [status, setStatus] = useState<string>("idle");

  const launch = async () => {
    setStatus("running");
    try {
      const res = await fetch("/api/agent-runs/demo", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({agentId}),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null);
        setStatus("error");
        throw new Error(err?.error ?? "Demo failed to start");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let runId: string | null = null;
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, {stream: true}).split("\n")) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.type === "run") runId = msg.runId;
            if (msg.type === "event" && msg.kind === "scenario") setStatus(`running: ${msg.summary}`);
            if (msg.type === "done") {
              setStatus("done");
              if (runId) onRun(runId);
            }
          } catch {}
        }
      }
    } catch (e) {
      setStatus("error");
      console.error(e);
    }
  };

  const busy = status === "running";

  return (
    <div className="kpi-card p-5 mb-6" data-aos="fade-up">
      <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary mb-3">Launch Live Demo</div>
      <div className="text-[12px] text-text-muted mb-4">
        Runs 3 scripted scenarios through the real payment pipeline against <span className="font-mono text-text-primary">{agentName}</span>: an approved spend, a spend over the per-tx cap, and an un-allowlisted recipient. Fully on-chain, no LLM required.
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={launch}
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2 text-[12px] font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "Launching demo..." : "Launch demo"}
        </button>
        <div className="text-[12px] text-text-muted truncate">
          {status === "idle" && "Ready. Demo spends 1.5 USDC from the live vault."}
          {status === "running" && "Streaming live feed..."}
          {status === "done" && "Done. Opening run feed."}
          {status === "error" && "Failed to start demo. See console."}
        </div>
      </div>
    </div>
  );
}

function RunDetail({runId, onBack}: {runId: string; onBack: () => void}) {
  const {run, events, loading} = useApiAgentRun(runId, 2000);
  const status = runStatusLabel(run?.status ?? "running");

  return (
    <div>
      <button onClick={onBack} className="mb-4 text-[12px] text-text-muted hover:text-text-primary transition-colors">
        ← All runs
      </button>

      <div className="kpi-card p-5 mb-6" data-aos="fade-up">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[13px] font-semibold text-text-primary">{run?.mission ?? "Loading run..."}</div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${status.className}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-[11px] text-text-muted">Passed</div>
            <div className="text-[18px] font-semibold text-text-primary tabular-nums">{run?.passed ?? "-"}</div>
          </div>
          <div>
            <div className="text-[11px] text-text-muted">Failed</div>
            <div className="text-[18px] font-semibold text-text-primary tabular-nums">{run?.failed ?? "-"}</div>
          </div>
          <div>
            <div className="text-[11px] text-text-muted">Model</div>
            <div className="text-[13px] font-medium text-text-primary font-mono break-all">{run?.model ?? "-"}</div>
          </div>
          <div>
            <div className="text-[11px] text-text-muted">Run ID</div>
            <div className="text-[13px] font-medium text-text-primary font-mono">{run ? truncateHash(run.id as `0x${string}`) : "-"}</div>
          </div>
        </div>
      </div>

      <div className="kpi-card" data-aos="fade-up" data-aos-delay="100">
        <div className="px-5 pt-5 pb-2">
          <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">Live Event Feed</div>
          <div className="text-[12px] text-text-muted mt-1">Auto-refreshes every 2 seconds while the agent runs.</div>
        </div>
        <div className="px-5 pb-4">
          {loading && events.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-text-muted">Loading feed...</div>
          ) : events.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-text-muted">No events yet.</div>
          ) : (
            events.map((e) => <EventRow key={e.id} event={e} />)
          )}
        </div>
      </div>
    </div>
  );
}

export default function ControlPage() {
  const {agents} = useApiAgents();
  const agent = agents[0];
  const agentId = agent?.id ?? "";
  const agentName = agent?.name ?? "Test Agent";
  const {runs} = useApiAgentRuns(undefined, 4000);
  const agentNameById = new Map(agents.map((a) => [a.id, a.name]));
  const [selectedRun, setSelectedRun] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!selectedRun && runs.length > 0) setSelectedRun(runs[0].id);
  }, [runs, selectedRun]);

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <div className="mb-6" data-aos="fade-up">
        <h1 className="text-[20px] font-semibold text-text-primary tracking-tight">Agent Control</h1>
        <p className="text-[13px] text-text-muted mt-1">Launch and supervise the autonomous QA agent</p>
      </div>

      {selectedRun ? (
        <RunDetail runId={selectedRun} onBack={() => setSelectedRun(undefined)} />
      ) : (
        <div className="space-y-6">
          {agentId ? (
            <div data-aos="fade-up">
              <DemoCard agentId={agentId} agentName={agentName} onRun={(runId) => setSelectedRun(runId)} />
            </div>
          ) : (
            <div className="kpi-card p-8 text-center" data-aos="fade-up">
              <div className="text-[13px] text-text-secondary">No agent configured</div>
              <div className="text-[12px] text-text-muted mt-1">Create an agent on the Agents page first.</div>
            </div>
          )}

          {agentId && (
            <div data-aos="fade-up">
              <LaunchCard agentId={agentId} agentName={agentName} />
            </div>
          )}

          <div className="kpi-card" data-aos="fade-up" data-aos-delay="100">
            <div className="px-5 pt-5 pb-3">
              <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">Previous Runs</div>
            </div>
            <div className="px-5 pb-5">
              {runs.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="text-[13px] text-text-secondary">No agent runs yet</div>
                  <div className="text-[12px] text-text-muted mt-1">Launch the agent from the terminal to see runs here.</div>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {runs.map((r) => {
                    const status = runStatusLabel(r.status);
                    return (
                      <button
                        key={r.id}
                        onClick={() => setSelectedRun(r.id)}
                        className="w-full flex items-center justify-between py-3 text-left hover:bg-surface-hover/50 transition-colors rounded-lg px-2"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium text-text-primary truncate">{r.mission}</div>
                          <div className="text-[12px] text-text-muted mt-0.5 font-mono text-[11px]">
                            {r.id} <span className="text-text-secondary">· {agentNameById.get(r.agent_id) ?? r.agent_id}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[12px] text-text-muted tabular-nums">
                            {r.passed} ✓ / {r.failed} ✗
                          </span>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${status.className}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                            {status.label}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
