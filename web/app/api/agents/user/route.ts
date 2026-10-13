import {NextRequest, NextResponse} from "next/server";
import {isAddress, type Address} from "viem";
import {CONTRACTS} from "@/lib/contracts";
import {createUserAgent, getAgentByAddress, addAllowlistEntry, getVaultByAddress, createVaultRow} from "@/lib/db";
import {verifyUserVault, getVaultPolicy} from "@/lib/executor";
import {verifyRegistrationSignature} from "@/lib/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Register a user's own agent against a per-user vault they created via the factory.
 *
 * The caller must prove control of `address` with a wallet signature over the canonical
 * registration challenge (see authMessage.ts); the server then verifies the vault on-chain
 * (owner == address, canonical USDC), reads its leash for the DB mirror, and binds the agent.
 * Returns the agent's API key exactly once (stored only as a hash). There is no shared-vault
 * path: every agent is backed by a vault its own wallet owns.
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
  let body: {name?: string; address?: string; vaultAddress?: string; signature?: string; issuedAt?: number};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const name = (body.name ?? "").trim();
  const address = (body.address ?? "").trim() as Address;
  const vaultAddress = (body.vaultAddress ?? "").trim();
  if (!name || !isAddress(address)) {
    return NextResponse.json({error: "Valid name and address required"}, {status: 400});
  }
  if (!isAddress(vaultAddress)) {
    return NextResponse.json({error: "VAULT_REQUIRED", message: "Create your vault first - a vaultAddress is required."}, {status: 400});
  }

  // Proof of wallet ownership: the caller must sign the registration challenge with `address`.
  const sig = await verifyRegistrationSignature({
    address,
    vaultAddress,
    issuedAt: Number(body.issuedAt),
    signature: body.signature ?? "",
  });
  if (!sig.ok) {
    return NextResponse.json({error: "SIGNATURE_INVALID", message: `Wallet ownership proof failed: ${sig.reason}`}, {status: 401});
  }

  const existing = getAgentByAddress(address);
  if (existing) {
    return NextResponse.json({error: "ADDRESS_REGISTERED", message: "This address already has an agent."}, {status: 409});
  }

  {
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
}
