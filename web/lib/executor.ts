import {createWalletClient, createPublicClient, http, encodeFunctionData, parseAbi, parseEventLogs, type Address, type Hex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {ARC_RPC_URL, USDC_ADDRESS} from "./arc";

const VAULT_ABI = parseAbi([
  "function executeSpendFor(address agent, address token, address target, uint256 amount, bytes data, bytes32 actionId) returns (bool)",
  "event AgentActionApproved(address indexed agent, address indexed target, address indexed token, uint256 amount, bytes32 actionId)",
  "event AgentActionBlocked(address indexed agent, address indexed target, address indexed token, uint256 amount, string reason)",
  "function owner() view returns (address)",
  "function usdc() view returns (address)",
  "function getPolicy(address agent) view returns ((uint128 maxPerTx,uint128 dailyCap,uint128 spentToday,uint64 lastResetTime,uint64 expiry,bool active))",
  "function remainingDailyCap(address agent) view returns (uint256)",
  "function getService(address agent,address target) view returns ((bool allowed,string label,uint128 maxPerTx,uint128 dailyCap,uint128 spentToday,uint64 lastResetTime,uint64 expiry))",
]);

export interface ExecuteResult {
  success: boolean;
  txHash?: Hex;
  error?: string;
}

function getSigner(keyEnv: "EXECUTOR_PRIVATE_KEY") {
  const key = process.env[keyEnv] as Hex | undefined;
  if (!key) throw new Error(`${keyEnv} not configured`);
  return privateKeyToAccount(key);
}

/**
 * Verify an address is a SpendArc vault owned by `expectedOwner` with the canonical USDC
 * token. Used before binding a self-created per-user vault to a registered agent.
 */
export async function verifyUserVault(vaultAddress: Address, expectedOwner: Address): Promise<{ok: boolean; reason?: string}> {
  try {
    const client = createPublicClient({transport: http(ARC_RPC_URL)});
    const code = await client.getCode({address: vaultAddress});
    if (!code || code === "0x") return {ok: false, reason: "no contract at address"};
    const [owner, usdc] = await Promise.all([
      client.readContract({address: vaultAddress, abi: VAULT_ABI, functionName: "owner", args: []}),
      client.readContract({address: vaultAddress, abi: VAULT_ABI, functionName: "usdc", args: []}),
    ]);
    if ((owner as Address).toLowerCase() !== expectedOwner.toLowerCase()) return {ok: false, reason: "vault owner mismatch"};
    if ((usdc as Address).toLowerCase() !== USDC_ADDRESS.toLowerCase()) return {ok: false, reason: "vault does not use canonical USDC"};
    return {ok: true};
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {ok: false, reason: msg.slice(0, 200)};
  }
}

export async function getVaultPolicy(vaultAddress: Address, agentAddress: Address) {
  const client = createPublicClient({transport: http(ARC_RPC_URL)});
  const [policy, remaining] = await Promise.all([
    client.readContract({address: vaultAddress, abi: VAULT_ABI, functionName: "getPolicy", args: [agentAddress]}),
    client.readContract({address: vaultAddress, abi: VAULT_ABI, functionName: "remainingDailyCap", args: [agentAddress]}),
  ]);
  return {policy, remainingDailyCap: remaining as bigint};
}

export interface VaultService {
  allowed: boolean;
  label: string;
  maxPerTx: bigint;
  dailyCap: bigint;
  spentToday: bigint;
  lastResetTime: bigint;
  expiry: bigint;
}

/** Read the on-chain `serviceAllowlist` policy for `agent` paying `target`. Used to verify a visitor-signed allowlist change before mirroring to the DB. */
export async function getVaultService(vaultAddress: Address, agentAddress: Address, target: Address): Promise<VaultService> {
  const client = createPublicClient({transport: http(ARC_RPC_URL)});
  return client.readContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "getService",
    args: [agentAddress, target],
  }) as Promise<VaultService>;
}

/**
 * Execute a spend on behalf of `agent`. The vault enforces the AGENT's policy, not the
 * executor's. The executor (server key) must be an authorized executor (or the owner) in the
 * vault, and can only ever move value within the agent's on-chain leash.
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

  try {
    const executor = getSigner("EXECUTOR_PRIVATE_KEY");
    const walletClient = createWalletClient({account: executor, transport: http(ARC_RPC_URL)});
    const publicClient = createPublicClient({transport: http(ARC_RPC_URL)});

    const txHash = await walletClient.sendTransaction({to: vaultAddress, data: calldata, chain: undefined});
    const receipt = await publicClient.waitForTransactionReceipt({hash: txHash, timeout: 60_000});

    if (receipt.status === "reverted") {
      return {success: false, txHash, error: "Transaction reverted on-chain"};
    }

    // The vault does not revert when a spend is off-policy: it emits AgentActionBlocked and moves
    // nothing. So a mined tx is NOT proof of payment - decode the events and only treat the spend
    // as successful when the vault emitted AgentActionApproved. This prevents a blocked action
    // from being recorded as CONFIRMED and counted against the daily cap.
    const events = parseEventLogs({abi: VAULT_ABI, logs: receipt.logs});
    const blocked = events.find((e) => e.eventName === "AgentActionBlocked");
    if (blocked) {
      const reason = (blocked.args as {reason?: string}).reason ?? "blocked by vault policy";
      return {success: false, txHash, error: `Vault blocked: ${reason}`};
    }
    const approved = events.some((e) => e.eventName === "AgentActionApproved");
    if (!approved) {
      return {success: false, txHash, error: "Vault emitted no approval event for this spend"};
    }
    return {success: true, txHash};
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {success: false, error: msg.slice(0, 200)};
  }
}
