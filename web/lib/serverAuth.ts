import {NextRequest, NextResponse} from "next/server";
import {createPublicClient, http, isAddress, type Address, type Hex} from "viem";
import {ARC_RPC_URL} from "./arc";
import {buildRegistrationMessage, REGISTRATION_MAX_AGE_MS} from "./authMessage";
import {getAgentByApiKey, type Agent} from "./db";

/**
 * Extract and validate the Bearer API key on an agent-facing request. The key is mandatory:
 * a request without one is rejected, so possession of a valid key is the only way to act as an
 * agent. When `agentId` is given, the key must belong to that agent.
 */
export function requireAgentApiKey(req: NextRequest, agentId?: string): {agent: Agent} | {error: NextResponse} {
  const auth = req.headers.get("authorization") ?? "";
  const apiKey = auth.replace(/^Bearer\s+/i, "").trim();
  if (!apiKey) {
    return {error: NextResponse.json({error: "MISSING_API_KEY", message: "Authorization: Bearer <api-key> required"}, {status: 401})};
  }
  const agent = getAgentByApiKey(apiKey);
  if (!agent) {
    return {error: NextResponse.json({error: "INVALID_API_KEY", message: "Unknown API key"}, {status: 401})};
  }
  if (agentId && agent.id !== agentId) {
    return {error: NextResponse.json({error: "INVALID_API_KEY", message: "API key does not match agentId"}, {status: 401})};
  }
  return {agent};
}

/**
 * Verify a wallet-ownership signature over the canonical registration challenge. Returns ok only
 * when the signature recovers to `address`, the vault matches, and the challenge is recent. The
 * signature is verified via EIP-1271/EIP-6492-aware `verifyMessage`, so smart-contract wallets
 * (e.g. Privy embedded/smart accounts) are supported as well as EOAs.
 */
export async function verifyRegistrationSignature(params: {
  address: string;
  vaultAddress: string;
  issuedAt: number;
  signature: string;
}): Promise<{ok: true} | {ok: false; reason: string}> {
  const {address, vaultAddress, issuedAt, signature} = params;
  if (!isAddress(address) || !isAddress(vaultAddress)) return {ok: false, reason: "bad address"};
  if (!signature || !/^0x[0-9a-fA-F]+$/.test(signature)) return {ok: false, reason: "missing signature"};
  if (!Number.isFinite(issuedAt)) return {ok: false, reason: "missing issuedAt"};

  const age = Date.now() - issuedAt;
  if (age > REGISTRATION_MAX_AGE_MS) return {ok: false, reason: "signature expired - please retry"};
  if (age < -60_000) return {ok: false, reason: "issuedAt is in the future"};

  const message = buildRegistrationMessage({address: address as Address, vaultAddress: vaultAddress as Address, issuedAt});
  const client = createPublicClient({transport: http(ARC_RPC_URL)});
  let valid = false;
  try {
    valid = await client.verifyMessage({address: address as Address, message, signature: signature as Hex});
  } catch {
    return {ok: false, reason: "signature verification failed"};
  }
  if (!valid) return {ok: false, reason: "signature does not match wallet"};
  return {ok: true};
}
