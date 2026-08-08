import {NextRequest, NextResponse} from "next/server";
import {encodeFunctionData, isAddress, type Address} from "viem";
import {vaultAbi} from "@/lib/contracts";
import {getAgent} from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Visitor self-service allowlist change for per-user vault agents.
 * The visitor owns their vault, so the server returns unsigned calldata for
 * `setAllowedTarget` that the visitor signs in their wallet; the DB mirror happens
 * after confirmation via /api/allowlist/[agentId]/sync.
 */
export async function POST(req: NextRequest, {params}: {params: Promise<{agentId: string}>}) {
  const {agentId} = await params;
  const agent = getAgent(agentId);
  if (!agent) return NextResponse.json({error: "Agent not found"}, {status: 404});
  if (!agent.vault_address) {
    return NextResponse.json({error: "Agent is not backed by a per-user vault"}, {status: 400});
  }

  let body: {address?: string; allowed?: boolean; label?: string};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({error: "invalid request"}, {status: 400});
  }

  const address = (body.address ?? "").trim();
  if (!isAddress(address)) {
    return NextResponse.json({error: "A valid recipient address is required"}, {status: 400});
  }

  const allowed = body.allowed !== false;
  const vault = agent.vault_address as Address;
  const short = `${address.slice(0, 8)}...${address.slice(-4)}`;
  const data = encodeFunctionData({
    abi: vaultAbi,
    functionName: "setAllowedTarget",
    args: [agent.address as Address, address as Address, allowed],
  });

  return NextResponse.json({
    tx: {
      to: vault,
      data,
      value: "0",
      description: allowed
        ? `Allow your agent to pay service ${short} from your vault ${vault}`
        : `Remove service ${short} from your agent's payee allowlist on vault ${vault}`,
    },
    address,
    allowed,
    label: body.label ?? "",
  });
}
