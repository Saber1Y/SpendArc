import {NextRequest, NextResponse} from "next/server";
import {encodeFunctionData, type Address} from "viem";
import {CONTRACTS, vaultAbi} from "@/lib/contracts";
import {getAgent, updatePolicy} from "@/lib/db";
import {setAgentPolicyOnChain} from "@/lib/executor";
import {MAX_PER_TX_USDC, MAX_DAILY_CAP_USDC} from "@/lib/policyLimits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PolicyInput {
  maxPerTx: bigint;
  dailyCap: bigint;
}

/** Shared clamp validation. Returns the valid values or an error response. */
function validate(body: unknown): {ok: true; values: PolicyInput} | {ok: false; response: NextResponse} {
  let parsed: {maxPerTxUsdc?: unknown; dailyCapUsdc?: unknown};
  try {
    parsed = typeof body === "string" ? JSON.parse(body) : (body ?? {});
  } catch {
    return {ok: false, response: NextResponse.json({error: "invalid request"}, {status: 400})};
  }
  const maxPerTxUsdc = Number(parsed.maxPerTxUsdc);
  const dailyCapUsdc = Number(parsed.dailyCapUsdc);
  if (!isFinite(maxPerTxUsdc) || !isFinite(dailyCapUsdc) || maxPerTxUsdc <= 0 || dailyCapUsdc <= 0) {
    return {ok: false, response: NextResponse.json({error: "maxPerTxUsdc and dailyCapUsdc must be positive numbers"}, {status: 400})};
  }
  if (maxPerTxUsdc > MAX_PER_TX_USDC) {
    return {ok: false, response: NextResponse.json({error: `Per-tx cap is capped at ${MAX_PER_TX_USDC} USDC`}, {status: 400})};
  }
  if (dailyCapUsdc > MAX_DAILY_CAP_USDC) {
    return {ok: false, response: NextResponse.json({error: `Daily cap is capped at ${MAX_DAILY_CAP_USDC} USDC`}, {status: 400})};
  }
  if (maxPerTxUsdc > dailyCapUsdc) {
    return {ok: false, response: NextResponse.json({error: "Per-tx cap cannot exceed the daily cap"}, {status: 400})};
  }
  return {ok: true, values: {maxPerTx: BigInt(Math.round(maxPerTxUsdc * 1_000_000)), dailyCap: BigInt(Math.round(dailyCapUsdc * 1_000_000))}};
}

/**
 * User self-service leash adjustment.
 *  - Per-user vault agents: the visitor is the vault owner, so the server returns unsigned
 *    calldata for the visitor to sign in their wallet; DB sync happens after confirmation.
 *  - Shared-vault agents (operator plane): the server owner key signs the update directly.
 */
export async function POST(req: NextRequest, {params}: {params: Promise<{agentId: string}>}) {
  const {agentId} = await params;
  const agent = getAgent(agentId);
  if (!agent) return NextResponse.json({error: "Agent not found"}, {status: 404});

  const raw = await req.text();
  const check = validate(raw);
  if (!check.ok) return check.response;
  const {maxPerTx, dailyCap} = check.values;

  if (agent.vault_address) {
    const vault = agent.vault_address as Address;
    const data = encodeFunctionData({abi: vaultAbi, functionName: "setAgentPolicy", args: [agent.address as Address, maxPerTx, dailyCap, 0n, true]});
    return NextResponse.json({
      tx: {
        to: vault,
        data,
        value: "0",
        description: `Set your agent leash to ${Number(maxPerTx) / 1_000_000} USDC/tx, ${Number(dailyCap) / 1_000_000} USDC/day on your vault ${vault}`,
      },
      maxPerTxUsdc: Number(maxPerTx) / 1_000_000,
      dailyCapUsdc: Number(dailyCap) / 1_000_000,
    });
  }

  const onchain = await setAgentPolicyOnChain(CONTRACTS.vault, agent.address as Address, maxPerTx, dailyCap);
  if (!onchain.success) {
    return NextResponse.json(
      {error: "ONCHAIN_POLICY_UPDATE_FAILED", message: onchain.error ?? "On-chain policy update failed"},
      {status: 502},
    );
  }

  const policy = updatePolicy(agentId, {max_per_tx: Number(maxPerTx), daily_cap: Number(dailyCap), active: 1});
  return NextResponse.json({policy, txHash: onchain.txHash});
}
