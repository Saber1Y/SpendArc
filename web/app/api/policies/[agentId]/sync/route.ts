import {NextRequest, NextResponse} from "next/server";
import type {Address} from "viem";
import {getAgent, updatePolicy} from "@/lib/db";
import {getVaultPolicy} from "@/lib/executor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * After the visitor signs the leash update in their wallet, mirror the confirmed on-chain
 * values into the server policy store so both fences stay in sync. Verifies the on-chain
 * policy actually matches the requested values before writing.
 */
export async function POST(req: NextRequest, {params}: {params: Promise<{agentId: string}>}) {
  const {agentId} = await params;
  const agent = getAgent(agentId);
  if (!agent) return NextResponse.json({error: "Agent not found"}, {status: 404});
  if (!agent.vault_address) {
    return NextResponse.json({error: "Agent is not backed by a per-user vault"}, {status: 400});
  }

  let body: {maxPerTxUsdc?: number; dailyCapUsdc?: number};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({error: "invalid request"}, {status: 400});
  }

  const maxPerTx = BigInt(Math.round(Number(body.maxPerTxUsdc) * 1_000_000));
  const dailyCap = BigInt(Math.round(Number(body.dailyCapUsdc) * 1_000_000));
  if (maxPerTx <= 0n || dailyCap <= 0n || maxPerTx > dailyCap) {
    return NextResponse.json({error: "invalid leash values"}, {status: 400});
  }

  let onchain;
  try {
    onchain = await getVaultPolicy(agent.vault_address as Address, agent.address as Address);
  } catch {
    return NextResponse.json({error: "VAULT_READ_FAILED", message: "Could not read the vault policy on-chain."}, {status: 502});
  }

  if (onchain.policy.maxPerTx !== maxPerTx || onchain.policy.dailyCap !== dailyCap) {
    return NextResponse.json(
      {error: "ONCHAIN_MISMATCH", message: "On-chain leash does not match the requested values - the update was not confirmed."},
      {status: 409},
    );
  }

  const policy = updatePolicy(agentId, {max_per_tx: Number(maxPerTx), daily_cap: Number(dailyCap), active: 1});
  return NextResponse.json({policy});
}
