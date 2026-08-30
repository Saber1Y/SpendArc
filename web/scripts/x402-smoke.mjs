#!/usr/bin/env node
/**
 * x402 live smoke test - validates the SpendArc executor-key x402 flow against a
 * real x402 endpoint WITHOUT agentcash, using the same @x402 packages as
 * web/lib/x402.ts.
 *
 * Steps:
 *   1. Derive the executor address from EXECUTOR_PRIVATE_KEY.
 *   2. Read its USDC balance on Base mainnet (agent402's settlement chain).
 *   3. Run the full x402 handshake against agent402.tools/api/testnet-fund and
 *      print the decoded payment status + receipt.
 *
 * Does NOT spend unless the wallet has a balance; if it settles, the cost is the
 * tool price ($0.001) and the funded address is printed.
 *
 * Usage:
 *   BASE_RPC_URL=... node --env-file=.env.local scripts/x402-smoke.mjs
 */
import {createPublicClient, createWalletClient, http} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {base} from "viem/chains";
import {wrapFetchWithPayment, x402Client, x402HTTPClient} from "@x402/fetch";
import {ExactEvmScheme, toClientEvmSigner} from "@x402/evm";

const RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_ABI = [{constant: true, inputs: [{name: "account", type: "address"}], name: "balanceOf", outputs: [{name: "", type: "uint256"}], stateMutability: "view", type: "function"}];
const TARGET = "https://agent402.tools/api/testnet-fund";

const key = process.env.EXECUTOR_PRIVATE_KEY;
if (!key) {
  console.error("EXECUTOR_PRIVATE_KEY not set");
  process.exit(2);
}

const account = privateKeyToAccount(key);
const publicClient = createPublicClient({chain: base, transport: http(RPC_URL)});
const walletClient = createWalletClient({account, chain: base, transport: http(RPC_URL)});

const balance = await publicClient.readContract({address: USDC_BASE, abi: USDC_ABI, functionName: "balanceOf", args: [account.address]});
const eth = await publicClient.getBalance({address: account.address});
console.log(`executor      : ${account.address}`);
console.log(`base usdc     : ${(Number(balance) / 1e6).toFixed(6)}`);
console.log(`base eth (gas): ${(Number(eth) / 1e18).toFixed(6)}`);

if (balance <= 0n) {
  console.log("\nSettlement not possible (USDC balance is 0). Running client-side decode of live 402 instead (no payment attempt).");
  const res = await fetch(TARGET, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({address: account.address, network: "base-sepolia"})});
  console.log(`\nstatus : ${res.status}`);
  console.log(`p402   : ${res.headers.get("paymENT-required") || res.headers.get("PAYMENT-REQUIRED") || "(none)"}`);
  const settle = res.headers.get("PAYMENT-RESPONSE") || res.headers.get("payment-response");
  if (settle) console.log(`settle : ${settle}`);
  const body = await res.text();
  console.log(`body   : ${body.slice(0, 300)}`);
  process.exit(0);
}

const signer = toClientEvmSigner(account, publicClient);
const scheme = new ExactEvmScheme(signer, {rpcUrl: RPC_URL});
const client = x402Client.fromConfig({
  schemes: [
    {network: "eip155:8453", client: scheme},
    {network: "eip155:84532", client: scheme},
  ],
  spendControls: {maxAmountPerPayment: "$1"},
});
const httpClient = new x402HTTPClient(client);
const fetchWithPay = wrapFetchWithPayment(fetch, httpClient);

console.log(`\nPOST ${TARGET} (fund address ${account.address} on base-sepolia)...`);
const response = await fetchWithPay(TARGET, {
  method: "POST",
  headers: {"content-type": "application/json"},
  body: JSON.stringify({address: account.address, network: "base-sepolia"}),
  cache: "no-store",
});
const parsed = await httpClient.processResponse(response);
console.log(`status        : ${parsed.status}`);
console.log(`paymentStatus : ${parsed.paymentStatus}`);
console.log(`header        : ${JSON.stringify(parsed.header ?? null)}`);
console.log(`body          : ${JSON.stringify(parsed.body ?? null).slice(0, 400)}`);