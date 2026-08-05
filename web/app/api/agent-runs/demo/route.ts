import {NextRequest} from "next/server";
import type {Address} from "viem";
import {createAgentRun, getAgent, addAgentRunEvent, updateAgentRun, endAgentRun} from "@/lib/db";
import {processPayment, type PaymentOutcome} from "@/lib/payments";
import {AGENT_ADDRESS} from "@/lib/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ALLOWLISTED = AGENT_ADDRESS;
const UNKNOWN = "0x1111111111111111111111111111111111111111" as Address;

const SCENARIOS: {title: string; request: {recipient: Address; amount: string; purpose: string}; expect: "APPROVED" | "BLOCKED"}[] = [
  {title: "Approved spend - within policy (1.5 USDC)", request: {recipient: ALLOWLISTED, amount: "1.5", purpose: "live demo"}, expect: "APPROVED"},
  {title: "Blocked - 6 USDC exceeds the 5 USDC per-tx cap", request: {recipient: ALLOWLISTED, amount: "6", purpose: "live demo"}, expect: "BLOCKED"},
  {title: "Blocked - recipient not allowlisted", request: {recipient: UNKNOWN, amount: "2", purpose: "live demo"}, expect: "BLOCKED"},
];

/**
 * One-click live demo. Runs a deterministic scripted sequence through the real
 * payment pipeline (server policy fence + on-chain vault spend), streaming each
 * step as NDJSON so the dashboard feed animates in real time. No LLM involved.
 */
export async function POST(req: NextRequest) {
  let body: {agentId?: string};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const agentId = body.agentId || undefined;
  if (!agentId || !getAgent(agentId)) {
    return new Response(JSON.stringify({error: "Agent not found."}), {status: 400, headers: {"content-type": "application/json"}});
  }

  const run = createAgentRun({agent_id: agentId, mission: "Live demo - scripted on-chain run", budget: 0, model: "scripted"});
  addAgentRunEvent(run.id, "info", "Demo run started. Executing 3 scripted scenarios against the live vault.");

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      send({type: "run", runId: run.id, total: SCENARIOS.length});

      let passed = 0;
      let failed = 0;

      for (let i = 0; i < SCENARIOS.length; i++) {
        const s = SCENARIOS[i];
        const label = `Scenario ${i + 1}/${SCENARIOS.length}: ${s.title}`;
        addAgentRunEvent(run.id, "scenario", label, {scenario: i + 1, total: SCENARIOS.length});
        send({type: "event", kind: "scenario", summary: label});

        await sleep(900);

        let outcome: PaymentOutcome;
        try {
          outcome = await processPayment({agentId, recipient: s.request.recipient, amountUsdc: s.request.amount, token: "usdc", purpose: s.request.purpose});
        } catch (e) {
          outcome = {status: "FAILED", transactionId: "", reason: e instanceof Error ? e.message : String(e), amount: s.request.amount, token: "USDC", recipient: s.request.recipient};
        }

        const pass = outcome.status === s.expect;
        if (pass) passed++;
        else failed++;

        const kind = outcome.status === "APPROVED" ? "approved" : outcome.status === "BLOCKED" ? "blocked" : "failed";
        const reason = outcome.status === "BLOCKED" ? outcome.reason : outcome.status === "FAILED" ? outcome.reason ?? "failed" : "approved";
        const summary = `${outcome.status} ${s.request.amount} USDC to ${s.request.recipient}`;
        addAgentRunEvent(
          run.id,
          kind,
          summary,
          {status: outcome.status, reason, purpose: s.request.purpose},
          "txHash" in outcome ? (outcome.txHash as string) : null,
        );
        send({
          type: "event",
          kind,
          summary,
          status: outcome.status,
          reason,
          txHash: "txHash" in outcome ? outcome.txHash : null,
          pass,
        });

        if (pass) {
          addAgentRunEvent(run.id, "passed", "PASS", {scenario: i + 1});
        } else {
          addAgentRunEvent(run.id, "fail", "FAIL - unexpected result", {scenario: i + 1, expected: s.expect, got: outcome.status});
        }
        updateAgentRun(run.id, {passed, failed});

        await sleep(900);
      }

      const status = failed > 0 ? "completed_with_failures" : "completed";
      endAgentRun(run.id, status);
      addAgentRunEvent(run.id, "run_end", `Demo run ${status}`, {passed, failed});

      send({type: "done", runId: run.id, status, passed, failed});
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {"content-type": "application/x-ndjson", "cache-control": "no-cache, no-transform"},
  });
}
