import {NextRequest, NextResponse} from "next/server";
import {isAddress, type Address} from "viem";
import {CONTRACTS} from "@/lib/contracts";
import {createUserAgent, getAgentByAddress, addAllowlistEntry, getVaultByAddress, createVaultRow} from "@/lib/db";
import {registerAgentOnChain, verifyUserVault, getVaultPolicy} from "@/lib/executor";
import {DEFAULT_MAX_PER_TX_USDC, DEFAULT_DAILY_CAP_USDC} from "@/lib/policyLimits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MAX_PER_TX = DEFAULT_MAX_PER_TX_USDC * 1_000_000; // 5 USDC
const DEFAULT_DAILY_CAP = DEFAULT_DAILY_CAP_USDC * 1_000_000; // 10 USDC

/**
 * Register a user's own agent. Two paths:
 *  - vaultAddress provided: the user self-created a per-user vault (factory). We verify it
 *    on-chain (owner == user, canonical USDC), read the vault's leash for the DB mirror, and
 *    bind the agent to it. No owner-signed txs needed - the vault is already fully configured.
 *  - no vaultAddress (legacy): owner-signed registration on the shared operator vault.
 * Returns the agent's API key exactly once (stored hashed server-side).
 */
export async function POST(req: NextRequest) {
  try {
    return await handle(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[agents/user] unhandled error:", msg);
    return NextResponse.json({error: "INTERNAL_ERROR", message: msg.slice(0, 300)}, {status: 500});
  }
}

async function handle(req: NextRequest) {
  let body: {name?: string; address?: string; vaultAddress?: string};
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

  const vaultAddress = (body.vaultAddress ?? "").trim();

  if (vaultAddress && isAddress(vaultAddress)) {
    // Per-user vault path: the user created their own vault and (typically) deposited.
    const verify = await verifyUserVault(vaultAddress as Address, address);
    if (!verify.ok) {
      return NextResponse.json(
        {error: "INVALID_VAULT", message: `Vault verification failed: ${verify.reason ?? "unknown"}`},
        {status: 400},
      );
    }

    let policy;
    try {
      policy = await getVaultPolicy(vaultAddress as Address, address);
    } catch {
      return NextResponse.json({error: "VAULT_READ_FAILED", message: "Could not read the vault policy on-chain."}, {status: 502});
    }
    if (!policy || policy.policy.maxPerTx <= 0n) {
      return NextResponse.json({error: "UNCONFIGURED_VAULT", message: "The vault has no leash configured for this agent."}, {status: 400});
    }

    const vaultRow = getVaultByAddress(vaultAddress) ?? createVaultRow({
      vaultAddress,
      ownerAddress: address,
      agentAddress: address,
      usdcAddress: CONTRACTS.usdc,
    });

    const {agent, apiKey} = createUserAgent(
      name,
      address,
      address,
      Number(policy.policy.maxPerTx),
      Number(policy.policy.dailyCap),
      vaultAddress,
    );
    addAllowlistEntry(agent.id, "recipient", address, "self (owner)");
    addAllowlistEntry(agent.id, "token", CONTRACTS.usdc, "USDC");

    return NextResponse.json(
      {
        agent: {id: agent.id, name: agent.name, address: agent.address, status: agent.status, vaultAddress},
        apiKey,
        policy: {maxPerTx: Number(policy.policy.maxPerTx), dailyCap: Number(policy.policy.dailyCap)},
        vaultAddress,
        vaultId: vaultRow.id,
        txHashes: [],
        warning: "apiKey is shown once. Save it - it is stored only as a hash.",
      },
      {status: 201},
    );
  }

  // Legacy shared-vault path (owner-signed, kept for the operator plane).
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
