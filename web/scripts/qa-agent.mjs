#!/usr/bin/env node
/**
 * QA Agent - autonomous spending test runner for SpendArc.
 *
 * Reads structured ```scenario blocks from QA.md (or --qa <path>), uses
 * `opencode run` (free model) as its decision brain, submits each request via
 * the /api/payments/request control-plane API, verifies the response against
 * the expected result, and streams every step to /api/agent-runs for the
 * live dashboard feed.
 *
 * Usage:
 *   node scripts/qa-agent.mjs --agent agent_c720ee6d [--qa ../QA.md] [--model opencode/deepseek-v4-flash-free] [--base http://localhost:3000] [--api-key spend_...] [--dry-run]
 */

import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = {agent: null, qa: path.join(__dirname, "qa-demo-agent.md"), model: null, base: null, dryRun: false, mission: "Run QA scenarios", apiKey: null};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--agent") args.agent = argv[++i];
    else if (a === "--qa") args.qa = argv[++i];
    else if (a === "--model") args.model = argv[++i];
    else if (a === "--base") args.base = argv[++i];
    else if (a === "--mission") args.mission = argv[++i];
    else if (a === "--api-key") args.apiKey = argv[++i];
    else if (a === "--dry-run") args.dryRun = true;
  }
  args.base = args.base || process.env.AGENT_API_BASE || "http://localhost:3000";
  args.model = args.model || process.env.AGENT_MODEL || "opencode/deepseek-v4-flash-free";
  args.apiKey = args.apiKey || process.env.AGENT_API_KEY || null;
  return args;
}

function extractScenarios(mdPath) {
  const content = readFileSync(mdPath, "utf8");
  const blocks = [];
  const re = /```scenario\s*\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    try {
      blocks.push(JSON.parse(m[1]));
    } catch (e) {
      console.error(`[qa-agent] Skipping malformed scenario block: ${e.message}`);
    }
  }
  return blocks;
}

async function api(base, pathname, {method = "GET", body, auth} = {}) {
  const headers = {};
  if (body) headers["content-type"] = "application/json";
  if (auth) headers["authorization"] = `Bearer ${auth}`;
  const res = await fetch(`${base}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function askBrain(model, prompt, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    const p = spawnSync("opencode", ["run", "-m", model, "--pure", prompt], {
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    if (p.status !== 0) {
      const stderr = (p.stderr || "").slice(0, 500);
      console.error(`[qa-agent] opencode exited ${p.status}: ${stderr}`);
      continue;
    }
    const out = (p.stdout || "").trim();
    const parsed = tryParseJson(out);
    if (parsed) return parsed;
    console.warn(`[qa-agent] Brain did not return parseable JSON (attempt ${i + 1}); retrying...`);
  }
  return null;
}

function tryParseJson(text) {
  const fence = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  const candidate = fence ? fence[1] : text;
  const block = candidate.match(/\{[\s\S]*\}/);
  if (!block) return null;
  try {
    return JSON.parse(block[0]);
  } catch {
    return null;
  }
}

function buildRequestFromBrain(decision, fallbackRequest) {
  const d = decision || {};
  const recipient = d.recipient || fallbackRequest?.recipient;
  const amount = d.amount !== undefined && d.amount !== null ? d.amount : fallbackRequest?.amount;
  const purpose = d.purpose || fallbackRequest?.purpose || d.reasoning || "qa test";
  return {recipient, amount: Number(amount), purpose};
}

function matchExpected(actual, expected) {
  if (expected.status && actual.status !== expected.status) {
    return {pass: false, reason: `status ${actual.status} != expected ${expected.status}`};
  }
  if (expected.reason) {
    const actualReason = (actual.reason || actual.decisionCode || "").toUpperCase();
    if (actualReason !== expected.reason) {
      return {pass: false, reason: `reason ${actualReason} != expected ${expected.reason}`};
    }
  }
  if (expected.executionStatus && actual.executionStatus !== expected.executionStatus) {
    return {pass: false, reason: `executionStatus ${actual.executionStatus} != expected ${expected.executionStatus}`};
  }
  if (expected.hasTx !== undefined) {
    const hasTx = Boolean(actual.txHash);
    if (hasTx !== expected.hasTx) {
      return {pass: false, reason: `hasTx ${hasTx} != expected ${expected.hasTx}`};
    }
  }
  return {pass: true};
}

async function applyPolicyHook(base, agentId, hook, label) {
  if (!hook || hook.setDailyCapUsd === undefined) return;
  const policy = await api(base, `/api/policies/${agentId}`);
  await api(base, `/api/policies/${agentId}`, {
    method: "PUT",
    body: {dailyCap: hook.setDailyCapUsd},
  });
  console.log(`[qa-agent] ${label}: daily cap ${policy.policy?.daily_cap ?? "?"} -> ${hook.setDailyCapUsd} USDC`);
}

async function verifyHistory(base, spec) {
  const data = await api(base, `/api/transactions${spec.agentId ? `?agentId=${spec.agentId}` : ""}`);
  const txs = data.transactions ?? [];
  const confirmed = txs.filter((t) => t.execution_status === "CONFIRMED").length;
  const blocked = txs.filter((t) => t.execution_status === "BLOCKED").length;
  const failed = txs.filter((t) => t.execution_status === "FAILED").length;
  const checks = [];
  if (spec.expectConfirmed) checks.push(["confirmed rows", confirmed > 0, `found ${confirmed}`]);
  if (spec.expectBlocked) checks.push(["blocked rows", blocked > 0, `found ${blocked}`]);
  if (spec.expectFailed) checks.push(["failed rows", failed > 0, `found ${failed}`]);
  const pass = checks.every(([, ok]) => ok);
  const detail = checks.map(([name, ok, found]) => `${name}:${ok ? "ok" : "MISSING"}(${found})`).join(" ");
  return {pass, detail, total: txs.length};
}

function printHeader() {
  console.log("");
  console.log("======================================");
  console.log("  SpendArc QA Agent");
  console.log("======================================");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.agent) {
    console.error("Missing --agent. Usage: node scripts/qa-agent.mjs --agent <agentId>");
    process.exit(1);
  }

  printHeader();
  const scenarios = extractScenarios(args.qa);
  console.log(`[qa-agent] QA file: ${args.qa}`);
  console.log(`[qa-agent] Agent: ${args.agent} | Model: ${args.model} | Base: ${args.base}${args.apiKey ? " | Auth: Bearer api-key" : " | Auth: operator (no key)"}${args.dryRun ? " (DRY RUN)" : ""}`);
  if (scenarios.length === 0) {
    console.error("[qa-agent] No ```scenario blocks found.");
    process.exit(1);
  }
  console.log(`[qa-agent] Found ${scenarios.length} scenario(s).`);
  console.log("");

  // With an api-key, introspect our own leash before spending (agent-facing auth).
  if (args.apiKey) {
    try {
      const me = await api(args.base, "/api/agents/me", {auth: args.apiKey});
      console.log(`[qa-agent] Leash: ${me.agent.name} | ${me.policy?.maxPerTxUsdc ?? "?"} USDC/tx, ${me.policy?.dailyCapUsdc ?? "?"} USDC/day, ${me.policy?.spentTodayUsdc ?? "?"} spent today`);
      console.log(`[qa-agent] Allowlists: recipients=${(me.allowlists?.recipients ?? []).join(",") || "none"} tokens=${(me.allowlists?.tokens ?? []).join(",") || "none"}`);
      console.log("");
    } catch (e) {
      console.error(`[qa-agent] Leash introspection failed (${e.message}); aborting - the api-key may be wrong.`);
      process.exit(1);
    }
  }

  let run = null;
  if (!args.dryRun) {
    try {
      const created = await api(args.base, "/api/agent-runs", {
        method: "POST",
        body: {agentId: args.agent, mission: args.mission, budget: 0, model: args.model},
      });
      run = created.run;
      console.log(`[qa-agent] Run created: ${run.id}`);
    } catch (e) {
      console.error(`[qa-agent] Could not create run via API: ${e.message}. Continuing without feed logging.`);
    }
  }

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    console.log(`--- Scenario ${i + 1}/${scenarios.length}: ${s.title} ---`);

    if (run) {
      await api(args.base, `/api/agent-runs/${run.id}`, {
        method: "POST",
        body: {kind: "scenario", summary: s.title, details: {scenario: i + 1, total: scenarios.length}},
      }).catch(() => {});
    }

    // History-only scenario
    if (s.verifyHistory) {
      const vh = await verifyHistory(args.base, s.verifyHistory);
      const pass = vh.pass;
      if (pass) passed++;
      else failed++;
      if (run) {
        await api(args.base, `/api/agent-runs/${run.id}`, {
          method: "POST",
          body: {
            kind: pass ? "passed" : "fail",
            summary: `History check ${pass ? "passed" : "failed"}`,
            details: {detail: vh.detail, total: vh.total},
          },
        }).catch(() => {});
        await api(args.base, `/api/agent-runs/${run.id}`, {
          method: "PATCH",
          body: {passed, failed},
        }).catch(() => {});
      }
      console.log(`[qa-agent] ${pass ? "PASS" : "FAIL"} - ${vh.detail} (${vh.total} total txs)`);
      continue;
    }

    if (!s.request) {
      console.log("[qa-agent] SKIP - no request body.");
      continue;
    }

    // Setup hook (e.g. zero the daily cap). Dry-run stays read-only.
    if (!args.dryRun) {
      await applyPolicyHook(args.base, args.agent, s.setup, "setup");
    }

    // Brain decides the concrete request
    let req = {...s.request, amount: Number(s.request.amount)};
    const brainPrompt = `You are the autonomous QA agent for SpendArc, an on-chain agent spending control plane.\n` +
      `The SpendArc API will enforce a policy (per-tx cap, daily cap, recipient allowlist) and may approve or block the request.\n` +
      `Given this QA scenario, produce the exact payment request JSON.\n\n` +
      `Scenario: ${JSON.stringify(s, null, 2)}\n\n` +
      `Output ONLY a JSON object of the form:\n` +
      `{"recipient": "<checksum address>", "amount": <number in USDC>, "purpose": "<short purpose>", "reasoning": "<why this request should produce the expected result>"}\n` +
      `Use the recipient and amount from the scenario verbatim. Do not invent values.`;
    const decision = args.dryRun ? null : askBrain(args.model, brainPrompt);
    const brainReq = buildRequestFromBrain(decision, s.request);
    if (decision) {
      console.log(`[qa-agent] Brain reasoning: ${decision.reasoning || "n/a"}`);
    } else if (!args.dryRun) {
      console.warn("[qa-agent] Brain failed; falling back to structured request.");
    }
    console.log(`[qa-agent] Request: ${JSON.stringify(brainReq)}`);

    if (run) {
      await api(args.base, `/api/agent-runs/${run.id}`, {
        method: "POST",
        body: {kind: "decision", summary: `Decided to request ${brainReq.amount} USDC`, details: {recipient: brainReq.recipient, amount: brainReq.amount, reasoning: decision?.reasoning}},
      }).catch(() => {});
    }

    let actual;
    if (args.dryRun) {
      actual = {status: "APPROVED", executionStatus: "CONFIRMED", txHash: "0x" + "0".repeat(64), reason: null};
      console.log("[qa-agent] (dry-run, simulated response)");
    } else {
      actual = await api(args.base, "/api/payments/request", {
        method: "POST",
        auth: args.apiKey,
        body: {
          agentId: args.agent,
          recipient: brainReq.recipient,
          amount: brainReq.amount,
          token: "usdc",
          purpose: brainReq.purpose,
        },
      });
    }

    console.log(`[qa-agent] Response: ${JSON.stringify(actual)}`);

    // Teardown hook (restore policy). Dry-run stays read-only.
    if (!args.dryRun) {
      await applyPolicyHook(args.base, args.agent, s.teardown, "teardown");
    }

    const verdict = matchExpected(actual, s.expected);
    if (verdict.pass) passed++;
    else failed++;

    if (run) {
      const kind = actual.status === "BLOCKED" ? "blocked" : actual.status === "FAILED" ? "failed" : verdict.pass ? "approved" : "error";
      await api(args.base, `/api/agent-runs/${run.id}`, {
        method: "POST",
        body: {
          kind,
          summary: `${verdict.pass ? "PASS" : "FAIL"} ${brainReq.amount} USDC to ${brainReq.recipient}`,
          details: {status: actual.status, reason: actual.reason ?? verdict.reason, purpose: brainReq.purpose},
          txHash: actual.txHash ?? null,
        },
      }).catch(() => {});
      await api(args.base, `/api/agent-runs/${run.id}`, {
        method: "PATCH",
        body: {passed, failed},
      }).catch(() => {});
    }

    console.log(`[qa-agent] VERDICT: ${verdict.pass ? "PASS" : "FAIL"}${verdict.pass ? "" : ` - ${verdict.reason}`}`);
    console.log("");
  }

  console.log("======================================");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("======================================");

  if (run) {
    const status = failed > 0 ? "completed_with_failures" : "completed";
    await api(args.base, `/api/agent-runs/${run.id}`, {
      method: "PUT",
      body: {action: "end", status},
    }).catch(() => {});
    console.log(`[qa-agent] Run finalized: ${run.id}`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(`[qa-agent] Fatal: ${e.message}`);
  process.exit(1);
});
