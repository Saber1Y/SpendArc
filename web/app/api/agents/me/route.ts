import {NextRequest, NextResponse} from "next/server";
import {getAgentByApiKey, getPolicy, listAllowlistEntries} from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Agent-facing introspection: the agent calls with its API key and learns its
 * own leash (policy + allowlists) before deciding what to request.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const apiKey = auth.replace(/^Bearer\s+/i, "").trim();
  if (!apiKey) {
    return NextResponse.json({error: "MISSING_API_KEY", message: "Authorization: Bearer <api-key> required"}, {status: 401});
  }

  const agent = getAgentByApiKey(apiKey);
  if (!agent) {
    return NextResponse.json({error: "INVALID_API_KEY", message: "Unknown API key"}, {status: 401});
  }

  const policy = getPolicy(agent.id);
  return NextResponse.json({
    agent: {id: agent.id, name: agent.name, address: agent.address, status: agent.status},
    policy: policy
      ? {
          maxPerTxUsdc: policy.max_per_tx / 1_000_000,
          dailyCapUsdc: policy.daily_cap / 1_000_000,
          spentTodayUsdc: policy.spent_today / 1_000_000,
          active: policy.active === 1,
          expiry: policy.expiry,
        }
      : null,
    allowlists: {
      recipients: listAllowlistEntries(agent.id, "recipient").map((e) => e.address),
      tokens: listAllowlistEntries(agent.id, "token").map((e) => e.address),
    },
  });
}
