import {NextRequest, NextResponse} from "next/server";
import type {Address} from "viem";
import {CONTRACTS} from "@/lib/contracts";
import {processPayment} from "@/lib/payments";
import {getAgentByApiKey} from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USDC = CONTRACTS.usdc;
const VAULT = CONTRACTS.vault;

export async function POST(req: NextRequest) {
  if (VAULT === "0x0000000000000000000000000000000000000000") {
    return NextResponse.json({error: "VAULT_NOT_DEPLOYED", message: "Vault contract not yet deployed on Arc."}, {status: 503});
  }

  let body: {agentId?: string; recipient?: string; amount?: string; token?: string; purpose?: string};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({error: "INVALID_JSON", message: "Body must be JSON."}, {status: 400});
  }

  const {agentId, recipient, amount: amountStr, token, purpose} = body ?? {};
  if (!agentId || !recipient || !amountStr || !token) {
    return NextResponse.json({error: "MISSING_FIELDS", message: "agentId, recipient, amount, token required."}, {status: 400});
  }

  // Agent-facing auth: a Bearer API key, when present, must belong to the agent.
  const auth = req.headers.get("authorization") ?? "";
  const apiKey = auth.replace(/^Bearer\s+/i, "").trim();
  if (apiKey) {
    const keyed = getAgentByApiKey(apiKey);
    if (!keyed || keyed.id !== agentId) {
      return NextResponse.json({error: "INVALID_API_KEY", message: "API key does not match agentId"}, {status: 401});
    }
  }

  const amount = Math.round(Number(amountStr) * 1_000_000);
  if (isNaN(amount) || amount <= 0) {
    return NextResponse.json({error: "INVALID_AMOUNT", message: "amount must be a positive number."}, {status: 400});
  }

  const tokenLower = token.toLowerCase();
  if (tokenLower !== "usdc" && tokenLower !== USDC.toLowerCase()) {
    return NextResponse.json({error: "UNSUPPORTED_TOKEN", message: "Only USDC is supported."}, {status: 400});
  }

  const outcome = await processPayment({agentId, recipient: recipient as Address, amountUsdc: amountStr, token, purpose});
  return NextResponse.json(outcome);
}
