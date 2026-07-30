import {createWalletClient, createPublicClient, http, encodeFunctionData, parseAbi, type Address, type Hex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {ARC_RPC_URL, USDC_ADDRESS} from "./arc";
import {vaultAbi, usdcAbi} from "./contracts";

const VAULT_ABI = parseAbi([
  "function executeSpend(address token, address target, uint256 amount, bytes data, bytes32 actionId) returns (bool)",
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

function getExecutor() {
  const key = process.env.EXECUTOR_PRIVATE_KEY as Hex | undefined;
  if (!key) throw new Error("EXECUTOR_PRIVATE_KEY not configured");
  return privateKeyToAccount(key);
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

export async function executeVaultSpend(
  vaultAddress: Address,
  token: Address,
  recipient: Address,
  amount: bigint,
  actionId: Hex,
): Promise<ExecuteResult> {
  try {
    const executor = getExecutor();
    const walletClient = createWalletClient({account: executor, transport: http(ARC_RPC_URL)});
    const publicClient = createPublicClient({transport: http(ARC_RPC_URL)});

    const calldata = encodeFunctionData({
      abi: VAULT_ABI,
      functionName: "executeSpend",
      args: [token, recipient, amount, "0x" as Hex, actionId],
    });

    const txHash = await walletClient.sendTransaction({to: vaultAddress, data: calldata, chain: undefined});

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
