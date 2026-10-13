// Register a SpendArc agent from the CLI - the same flow as the dashboard's "Register" button.
//
// It signs the canonical ownership challenge with your wallet key and POSTs to /api/agents/user,
// which verifies the vault on-chain, writes the agent to the server DB, and returns the API key
// ONCE. After this runs, the agent reflects on the dashboard.
//
// Usage (from the web/ directory so `viem` resolves):
//   OWNER_KEY=0x<your-wallet-private-key> \
//   BASE_URL=https://spend-arc-two.vercel.app \
//   VAULT=0x8D80cEEe03C86de7d90478c5D7599004f375Ef6F \
//   NAME="My Agent" \
//   NETWORK=mainnet \
//   node scripts/register-agent.mjs
//
// Only OWNER_KEY and VAULT are required; the rest have sensible defaults.

import {privateKeyToAccount} from "viem/accounts";

const key = process.env.OWNER_KEY;
const vault = process.env.VAULT;
const baseUrl = (process.env.BASE_URL || "https://spend-arc-two.vercel.app").replace(/\/$/, "");
const name = process.env.NAME || "My Agent";
const network = process.env.NETWORK || "mainnet";

if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
  console.error("Set OWNER_KEY to your wallet private key (0x + 64 hex).");
  process.exit(1);
}
if (!vault || !/^0x[0-9a-fA-F]{40}$/.test(vault)) {
  console.error("Set VAULT to your vault address (0x + 40 hex).");
  process.exit(1);
}

const account = privateKeyToAccount(key);
const address = account.address;
const issuedAt = Date.now();

const message = [
  "SpendArc agent registration",
  "",
  "By signing, you prove you control this wallet and authorize creating an agent API key bound to it.",
  "",
  `Wallet: ${address.toLowerCase()}`,
  `Vault: ${vault.toLowerCase()}`,
  `Issued At: ${new Date(issuedAt).toISOString()}`,
].join("\n");

const signature = await account.signMessage({message});

const res = await fetch(`${baseUrl}/api/agents/user`, {
  method: "POST",
  headers: {"content-type": "application/json"},
  body: JSON.stringify({name, address, vaultAddress: vault, signature, issuedAt, network}),
});

const body = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`Registration failed (HTTP ${res.status}):`, body.error || "", body.message || "");
  process.exit(1);
}

console.log("Registered. The agent now shows on the dashboard.");
console.log("  agentId :", body.agent?.id);
console.log("  address :", body.agent?.address);
console.log("  network :", body.network);
console.log("  leash   :", body.policy ? `${body.policy.maxPerTx / 1e6} USDC/tx, ${body.policy.dailyCap / 1e6} USDC/day` : "-");
console.log("");
console.log("  API KEY (shown once - save it now):");
console.log("  " + body.apiKey);
