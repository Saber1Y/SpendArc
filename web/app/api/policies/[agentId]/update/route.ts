import {NextRequest, NextResponse} from "next/server";
import type {Address} from "viem";
import {CONTRACTS} from "@/lib/contracts";
import {getAgent, updatePolicy} from "@/lib/db";
import {setAgentPolicyOnChain} from "@/lib/executor";
import {MAX_PER_TX_USDC, MAX_DAILY_CAP_USDC} from "@/lib/policyLimits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * User self-service leash adjustment. Clamps against platform ceilings, updates
 * the vault-enforced policy on-chain (owner key), then mirrors the same values
 * into the server policy store so both fences stay in sync.
 */
export async function POST(req: NextRequest, {params}: {params: Promise<{agentId: string}>}) {
  const {agentId} = await params;
  const agent = getAgent(agentId);
  if (!agent) return NextResponse.json({error: "Agent not found"}, {status: 404});

  let body: {maxPerTxUsdc?: unknown; dailyCapUsdc?: unknown};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({error: "invalid request"}, {status: 400});
  }

  const maxPerTxUsdc = Number(body.maxPerTxUsdc);
  const dailyCapUsdc = Number(body.dailyCapUsdc);
  if (!isFinite(maxPerTxUsdc) || !isFinite(dailyCapUsdc) || maxPerTxUsdc <= 0 || dailyCapUsdc <= 0) {
    return NextResponse.json({error: "maxPerTxUsdc and dailyCapUsdc must be positive numbers"}, {status: 400});
  }
  if (maxPerTxUsdc > MAX_PER_TX_USDC) {
    return NextResponse.json({error: `Per-tx cap is capped at ${MAX_PER_TX_USDC} USDC`}, {status: 400});
  }
  if (dailyCapUsdc > MAX_DAILY_CAP_USDC) {
    return NextResponse.json({error: `Daily cap is capped at ${MAX_DAILY_CAP_USDC} USDC`}, {status: 400});
  }
  if (maxPerTxUsdc > dailyCapUsdc) {
    return NextResponse.json({error: "Per-tx cap cannot exceed the daily cap"}, {status: 400});
  }

  const maxPerTx = BigInt(Math.round(maxPerTxUsdc * 1_000_000));
  const dailyCap = BigInt(Math.round(dailyCapUsdc * 1_000_000));

  const onchain = await setAgentPolicyOnChain(CONTRACTS.vault, agent.address as Address, maxPerTx, dailyCap);
  if (!onchain.success) {
    return NextResponse.json(
      {error: "ONCHAIN_POLICY_UPDATE_FAILED", message: onchain.error ?? "On-chain policy update failed"},
      {status: 502},
    );
  }

  const policy = updatePolicy(agentId, {
    max_per_tx: Number(maxPerTx),
    daily_cap: Number(dailyCap),
    active: 1,
  });

  return NextResponse.json({policy, txHash: onchain.txHash});
}
