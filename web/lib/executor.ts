import {createWalletClient, createPublicClient, http, encodeFunctionData, parseAbi, type Address, type Hex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {ARC_RPC_URL, USDC_ADDRESS} from "./arc";

const VAULT_ABI = parseAbi([
  "function executeSpend(address token, address target, uint256 amount, bytes data, bytes32 actionId) returns (bool)",
  "function executeSpendFor(address agent, address token, address target, uint256 amount, bytes data, bytes32 actionId) returns (bool)",
  "function setAgentPolicy(address agent, uint128 maxPerTx, uint128 dailyCap, uint64 expiry, bool active)",
  "function setAllowedTarget(address agent, address target, bool allowed)",
  "function setAllowedToken(address agent, address token, bool allowed)",
  "function setExecutor(address executor, bool enabled)",
  "function getPolicy(address agent) view returns ((uint128 maxPerTx,uint128 dailyCap,uint128 spentToday,uint64 lastResetTime,uint64 expiry,bool active))",
  "function remainingDailyCap(address agent) view returns (uint256)",
  "function allowedTarget(address agent,address target) view returns (bool)",
  "function allowedToken(address agent,address token) view returns (bool)",
]);

const USDC_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

export interface ExecuteResult {
  success: boolean;
  txHash?: Hex;
  error?: string;
}

function getSigner(keyEnv: "EXECUTOR_PRIVATE_KEY" | "VAULT_OWNER_PRIVATE_KEY") {
  const key = process.env[keyEnv] as Hex | undefined;
  if (!key) throw new Error(`${keyEnv} not configured`);
  return privateKeyToAccount(key);
}

async function sendAndWait(to: Address, calldata: Hex): Promise<ExecuteResult> {
  try {
    const executor = getSigner("EXECUTOR_PRIVATE_KEY");
    const walletClient = createWalletClient({account: executor, transport: http(ARC_RPC_URL)});
    const publicClient = createPublicClient({transport: http(ARC_RPC_URL)});

    const txHash = await walletClient.sendTransaction({to, data: calldata, chain: undefined});
    const receipt = await publicClient.waitForTransactionReceipt({hash: txHash, timeout: 60_000});

    if (receipt.status === "reverted") {
      return {success: false, txHash, error: "Transaction reverted on-chain"};
    }
    return {success: true, txHash};
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("reverted") || msg.includes("revert")) {
      return {success: false, error: `Vault rejected: ${msg.slice(0, 200)}`};
    }
    return {success: false, error: msg.slice(0, 200)};
  }
}

export async function checkVaultBalance(vaultAddress: Address): Promise<bigint> {
  const client = createPublicClient({transport: http(ARC_RPC_URL)});
  return client.readContract({address: USDC_ADDRESS, abi: USDC_ABI, functionName: "balanceOf", args: [vaultAddress]});
}

export async function getVaultPolicy(vaultAddress: Address, agentAddress: Address) {
  const client = createPublicClient({transport: http(ARC_RPC_URL)});
  const [policy, remaining] = await Promise.all([
    client.readContract({address: vaultAddress, abi: VAULT_ABI, functionName: "getPolicy", args: [agentAddress]}),
    client.readContract({address: vaultAddress, abi: VAULT_ABI, functionName: "remainingDailyCap", args: [agentAddress]}),
  ]);
  return {policy, remainingDailyCap: remaining as bigint};
}

export async function checkVaultAllowlist(vaultAddress: Address, agentAddress: Address, target: Address, token: Address) {
  const client = createPublicClient({transport: http(ARC_RPC_URL)});
  const [targetOk, tokenOk] = await Promise.all([
    client.readContract({address: vaultAddress, abi: VAULT_ABI, functionName: "allowedTarget", args: [agentAddress, target]}),
    client.readContract({address: vaultAddress, abi: VAULT_ABI, functionName: "allowedToken", args: [agentAddress, token]}),
  ]);
  return {targetAllowed: targetOk as boolean, tokenAllowed: tokenOk as boolean};
}

/**
 * Execute a spend on behalf of `agent`. The vault enforces the AGENT's policy,
 * not the executor's. The executor (server key) must be an authorized executor
 * (or the owner) in the vault.
 */
export async function executeVaultSpend(
  vaultAddress: Address,
  agent: Address,
  token: Address,
  recipient: Address,
  amount: bigint,
  actionId: Hex,
): Promise<ExecuteResult> {
  const calldata = encodeFunctionData({
    abi: VAULT_ABI,
    functionName: "executeSpendFor",
    args: [agent, token, recipient, amount, "0x" as Hex, actionId],
  });
  return sendAndWait(vaultAddress, calldata);
}

/** Owner-only on-chain registration: create/set an agent's policy + allowlists. */
export async function registerAgentOnChain(vaultAddress: Address, agent: Address, maxPerTx: bigint, dailyCap: bigint, token: Address, target: Address) {
  const owner = getSigner("VAULT_OWNER_PRIVATE_KEY");
  const walletClient = createWalletClient({account: owner, transport: http(ARC_RPC_URL)});
  const publicClient = createPublicClient({transport: http(ARC_RPC_URL)});

  const steps: {functionName: "setAgentPolicy" | "setAllowedToken" | "setAllowedTarget"; args: `0x${string}` | bigint | boolean}[] = [
    {functionName: "setAgentPolicy", args: agent},
    {functionName: "setAllowedToken", args: token},
    {functionName: "setAllowedTarget", args: target},
  ];

  const txHashes: Hex[] = [];
  for (const step of steps) {
    const calldata =
      step.functionName === "setAgentPolicy"
        ? encodeFunctionData({abi: VAULT_ABI, functionName: "setAgentPolicy", args: [agent, maxPerTx, dailyCap, 0n, true]})
        : encodeFunctionData({abi: VAULT_ABI, functionName: step.functionName, args: [agent, step.args, true] as [Address, Address, boolean]});
    const txHash = await walletClient.sendTransaction({to: vaultAddress, data: calldata, chain: undefined});
    const receipt = await publicClient.waitForTransactionReceipt({hash: txHash, timeout: 60_000});
    if (receipt.status !== "success") {
      return {success: false, txHash, error: `${step.functionName} reverted on-chain`};
    }
    txHashes.push(txHash);
  }
  return {success: true, txHashes};
}
