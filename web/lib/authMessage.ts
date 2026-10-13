import type {Address} from "viem";

/**
 * Canonical registration challenge. Both the browser (which asks the wallet to sign it) and
 * the server (which verifies the signature) build the message from this single function so the
 * bytes always match. Signing it proves the caller controls `address` before the server mints an
 * API key for it - closing the "register any address you do not own" hole.
 */
export function buildRegistrationMessage(params: {address: Address; vaultAddress: Address; issuedAt: number}): string {
  const {address, vaultAddress, issuedAt} = params;
  return [
    "SpendArc agent registration",
    "",
    "By signing, you prove you control this wallet and authorize creating an agent API key bound to it.",
    "",
    `Wallet: ${address.toLowerCase()}`,
    `Vault: ${vaultAddress.toLowerCase()}`,
    `Issued At: ${new Date(issuedAt).toISOString()}`,
  ].join("\n");
}

/** A registration signature is only accepted within this window of its issued-at time. */
export const REGISTRATION_MAX_AGE_MS = 10 * 60 * 1000;
