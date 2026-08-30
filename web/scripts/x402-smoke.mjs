#!/usr/bin/env node
/**
 * x402 live smoke test - validates the SpendArc executor-key x402 flow WITHOUT
 * agentcash, using the same @x402 packages as web/lib/x402.ts.
 *
 * Steps:
 *   1. Derive the executor address from EXECUTOR_PRIVATE_KEY.
 *   2. Read its USDC balance on the SpendArc settlement chain (Arc testnet).
 *   3. Run the full x402 handshake against a target endpoint and print the
 *      decoded payment status + receipt.
 *
 * Usage:
 *   node --env-file=.env.local scripts/x402-smoke.mjs [url] [body]
 */
import {createPublicClient, createWalletClient, http} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {wrapFetchWithPayment, x402Client, x402HTTPClient} from "@x402/fetch";
import {ExactEvmScheme, toClientEvmSigner} from "@x402/evm";

const RPC_URL = process.env.NEXT_PUBLIC_ARC_RPC_URL || process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network";
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID || "5042002");
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || "0x3600000000000000000000000000000000000000";
const ARC_NETWORK = `eip155:${CHAIN_ID}`;
const USDC_ABI = [{constant: true, inputs: [{name: "account", type: "address"}], name: "balanceOf", outputs: [{name: "", type: "uint256"}], stateMutability: "view", type: "function"}];

const TARGET = process.argv[2] || "https://agent402.tools/api/testnet-fund";
const BODY = process.argv[3] ? JSON.parse(process.argv[3]) : {address: process.env.EXECUTOR_PUBLIC || null, network: "base-sepolia"};

const key = process.env.EXECUTOR_PRIVATE_KEY;
if (!key) {
  console.error("EXECUTOR_PRIVATE_KEY not set");
  process.exit(2);
}

const account = privateKeyToAccount(key);
const publicClient = createPublicClient({chain: {id: CHAIN_ID, name: "arc", nativeCurrency: {name: "USDC", symbol: "USDC", decimals: 6}, rpcUrls: {default: {http: [RPC_URL]}}}, transport: http(RPC_URL)});
const walletClient = createWalletClient({account, chain: {id: CHAIN_ID, name: "arc", nativeCurrency: {name: "USDC", symbol: "USDC", decimals: 6}, rpcUrls: {default: {http: [RPC_URL]}}}, transport: http(RPC_URL)});

const balance = await publicClient.readContract({address: USDC_ADDRESS, abi: USDC_ABI, functionName: "balanceOf", args: [account.address]});
console.log(`executor    : ${account.address}`);
console.log(`chain       : arc:${CHAIN_ID} (${ARC_NETWORK})`);
console.log(`usdc balance: ${(Number(balance) / 1e6).toFixed(6)}`);

if (balance <= 0n) {
  console.log("\nSettlement not possible (USDC balance is 0). Still running the live 402 handshake to show the network/scheme the endpoint offers.");
}

const signer = toClientEvmSigner(account, publicClient);
const scheme = new ExactEvmScheme(signer, {rpcUrl: RPC_URL});
const client = x402Client.fromConfig({
  schemes: [{network: ARC_NETWORK, client: scheme}],
  spendControls: {maxAmountPerPayment: "$1"},
});
const httpClient = new x402HTTPClient(client);
const fetchWithPay = wrapFetchWithPayment(fetch, httpClient);

console.log(`\nPOST ${TARGET}...`);
const response = await fetchWithPay(TARGET, {
  method: "POST",
  headers: {"content-type": "application/json"},
  body: JSON.stringify(BODY),
  cache: "no-store",
});
const parsed = await httpClient.processResponse(response);
console.log(`status        : ${parsed.status}`);
console.log(`paymentStatus : ${parsed.paymentStatus}`);
console.log(`header        : ${JSON.stringify(parsed.header ?? null).slice(0, 800)}`);
console.log(`body          : ${JSON.stringify(parsed.body ?? null).slice(0, 400)}`);