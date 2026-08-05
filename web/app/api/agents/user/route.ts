import {NextRequest, NextResponse} from "next/server";
import {isAddress, type Address} from "viem";
import {CONTRACTS} from "@/lib/contracts";
import {createUserAgent, getAgentByAddress, addAllowlistEntry} from "@/lib/db";
import {registerAgentOnChain} from "@/lib/executor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MAX_PER_TX = 1_000_000; // 1 USDC
const DEFAULT_DAILY_CAP = 2_000_000; // 2 USDC

/**
 * Register a user's own agent: the user's wallet address becomes an on-chain
 * vault agent with a small default policy, mirrored in the server policy store.
 * Returns the agent's API key exactly once (stored hashed server-side).
 * NOTE: testnet demo - the wallet address is self-claimed (no server-side
 * wallet-proof yet). Behind the authenticated dashboard.
 */
export async function POST(req: NextRequest) {
  let body: {name?: string; address?: string};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const name = (body.name ?? "").trim();
  const address = (body.address ?? "").trim() as Address;
  if (!name || !isAddress(address)) {
    return NextResponse.json({error: "Valid name and address required"}, {status: 400});
  }

  const existing = getAgentByAddress(address);
  if (existing) {
    return NextResponse.json({error: "ADDRESS_REGISTERED", message: "This address already has an agent."}, {status: 409});
  }

  const reg = await registerAgentOnChain(CONTRACTS.vault, address, BigInt(DEFAULT_MAX_PER_TX), BigInt(DEFAULT_DAILY_CAP), CONTRACTS.usdc, address);
  if (!reg.success || !reg.txHashes) {
    return NextResponse.json({error: "ONCHAIN_REGISTRATION_FAILED", message: reg.error ?? "Failed to register agent on-chain"}, {status: 502});
  }

  const {agent, apiKey} = createUserAgent(name, address, address, DEFAULT_MAX_PER_TX, DEFAULT_DAILY_CAP);
  addAllowlistEntry(agent.id, "recipient", address, "self (owner)");
  addAllowlistEntry(agent.id, "token", CONTRACTS.usdc, "USDC");

  return NextResponse.json(
    {
      agent: {id: agent.id, name: agent.name, address: agent.address, status: agent.status},
      apiKey,
      policy: {maxPerTx: DEFAULT_MAX_PER_TX, dailyCap: DEFAULT_DAILY_CAP},
      txHashes: reg.txHashes,
      warning: "apiKey is shown once. Save it - it is stored only as a hash.",
    },
    {status: 201},
  );
}
