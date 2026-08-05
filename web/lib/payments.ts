import {keccak256, toBytes, type Address} from "viem";
import {CONTRACTS} from "@/lib/contracts";
import {evaluatePolicy, createTransaction, updateTransaction, incrementDailySpent, type DecisionCode} from "@/lib/db";
import {executeVaultSpend} from "@/lib/executor";

export interface PaymentInput {
  agentId: string;
  recipient: Address;
  amountUsdc: string;
  token: string;
  purpose?: string;
}

export type PaymentOutcome =
  | {status: "BLOCKED"; transactionId: string; reason: string; message?: string; amount: string; token: string; recipient: string}
  | {status: "FAILED"; transactionId: string; reason?: string; amount: string; token: string; recipient: string}
  | {status: "APPROVED"; transactionId: string; amount: string; token: string; recipient: string; network: string; executionStatus: string; txHash: string | null};

/**
 * Run a payment request through both fences: the server-side policy store first,
 * then the on-chain vault spend. Shared by /api/payments/request and the live demo.
 */
export async function processPayment(input: PaymentInput): Promise<PaymentOutcome> {
  const USDC = CONTRACTS.usdc;
  const amount = Math.round(Number(input.amountUsdc) * 1_000_000);
  const recipientAddr = input.recipient;
  const actionId = keccak256(toBytes(`${input.agentId}:${recipientAddr}:${amount}:${Date.now()}:${Math.random()}`));

  const policyResult = evaluatePolicy(input.agentId, amount, recipientAddr, USDC);

  const tx = createTransaction({
    agent_id: input.agentId,
    amount,
    token: USDC,
    recipient: recipientAddr,
    purpose: input.purpose || "",
    policy_decision: policyResult.approved ? "APPROVED" : "BLOCKED",
    decision_code: policyResult.code,
    execution_status: policyResult.approved ? "APPROVED" : "BLOCKED",
    tx_hash: null,
    action_id: policyResult.approved ? actionId : null,
  });

  if (!policyResult.approved) {
    return {
      status: "BLOCKED",
      transactionId: tx.id,
      reason: policyResult.code,
      message: policyResult.reason,
      amount: input.amountUsdc,
      token: "USDC",
      recipient: recipientAddr,
    };
  }

  try {
    const result = await executeVaultSpend(CONTRACTS.vault, USDC, recipientAddr, BigInt(amount), actionId);

    if (!result.success) {
      updateTransaction(tx.id, {
        execution_status: "FAILED",
        tx_hash: result.txHash || null,
        decision_code: result.error?.includes("revert") ? ("EXCEEDS_PER_TX_LIMIT" as DecisionCode) : ("AGENT_NOT_FOUND" as DecisionCode),
      });

      return {
        status: "FAILED",
        transactionId: tx.id,
        reason: result.error,
        amount: input.amountUsdc,
        token: "USDC",
        recipient: recipientAddr,
      };
    }

    updateTransaction(tx.id, {
      execution_status: "CONFIRMED",
      tx_hash: result.txHash || null,
      confirmed_at: Math.floor(Date.now() / 1000),
    });

    incrementDailySpent(input.agentId, amount);

    return {
      status: "APPROVED",
      transactionId: tx.id,
      amount: input.amountUsdc,
      token: "USDC",
      recipient: recipientAddr,
      network: "Arc Testnet",
      executionStatus: "CONFIRMED",
      txHash: result.txHash || null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    updateTransaction(tx.id, {execution_status: "FAILED", decision_code: "AGENT_NOT_FOUND" as DecisionCode});

    return {
      status: "FAILED",
      transactionId: tx.id,
      reason: `Execution error: ${msg.slice(0, 200)}`,
      amount: input.amountUsdc,
      token: "USDC",
      recipient: recipientAddr,
    };
  }
}
