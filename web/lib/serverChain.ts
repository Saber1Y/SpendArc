import {createPublicClient, createWalletClient, http, type Hex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import type {NetworkConfig} from "./networks";

/**
 * Server-side, per-network chain access. Unlike lib/arc.ts (which exposes the viewer's active
 * network as module-level constants), these helpers act on an explicit network so the server can
 * execute a spend on exactly the network the agent was created on. Executor keys are resolved per
 * network from the environment and never leave the server.
 */

export function publicClientFor(net: NetworkConfig) {
  return createPublicClient({transport: http(net.rpcUrl)});
}

/** The env var holding the executor key for a network. Mainnet and testnet use different keys. */
export function executorKeyEnv(net: NetworkConfig): "EXECUTOR_PRIVATE_KEY" | "EXECUTOR_PRIVATE_KEY_TESTNET" {
  return net.testnet ? "EXECUTOR_PRIVATE_KEY_TESTNET" : "EXECUTOR_PRIVATE_KEY";
}

export function executorAccountFor(net: NetworkConfig) {
  const envName = executorKeyEnv(net);
  const key = process.env[envName] as Hex | undefined;
  if (!key) throw new Error(`${envName} not configured for ${net.label}`);
  return privateKeyToAccount(key);
}

export function executorWalletFor(net: NetworkConfig) {
  return createWalletClient({account: executorAccountFor(net), transport: http(net.rpcUrl)});
}
