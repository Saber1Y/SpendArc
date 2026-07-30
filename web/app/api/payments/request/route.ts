import {NextRequest, NextResponse} from "next/server";
import {keccak256, toBytes, type Address, type Hex} from "viem";
import {CONTRACTS} from "@/lib/contracts";
import {evaluatePolicy, createTransaction, updateTransaction, incrementDailySpent, type PaymentRequest, type DecisionCode} from "@/lib/db";
import {executeVaultSpend} from "@/lib/executor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USDC = CONTRACTS.usdc;
const VAULT = CONTRACTS.vault;

export async function POST(req: NextRequest) {
  if (VAULT === "0x0000000000000000000000000000000000000000") {
    return NextResponse.json({error: "VAULT_NOT_DEPLOYED", message: "Vault contract not yet deployed on Arc."}, {status: 503});
  }

  let body: PaymentRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({error: "INVALID_JSON", message: "Body must be JSON."}, {status: 400});
  }

  const {agentId, recipient, amount: amountStr, token, purpose} = body;
  if (!agentId || !recipient || !amountStr || !token) {
    return NextResponse.json({error: "MISSING_FIELDS", message: "agentId, recipient, amount, token required."}, {status: 400});
  }

  const amount = Math.round(Number(amountStr) * 1_000_000);
  if (isNaN(amount) || amount <= 0) {
    return NextResponse.json({error: "INVALID_AMOUNT", message: "amount must be a positive number."}, {status: 400});
  }

  const tokenLower = token.toLowerCase();
  if (tokenLower !== "usdc" && tokenLower !== USDC.toLowerCase()) {
    return NextResponse.json({error: "UNSUPPORTED_TOKEN", message: "Only USDC is supported."}, {status: 400});
  }

  // 1. Evaluate policy (control plane - server side)
  const policyResult = evaluatePolicy(agentId, amount, recipient, USDC);

  const recipientAddr = recipient as Address;
  const actionId = keccak256(toBytes(`${agentId}:${recipient}:${amount}:${Date.now()}:${Math.random()}`));

  // 2. Create transaction record
  const tx = createTransaction({
    agent_id: agentId,
    amount,
    token: USDC,
    recipient: recipientAddr,
    purpose: purpose || "",
    policy_decision: policyResult.approved ? "APPROVED" : "BLOCKED",
    decision_code: policyResult.code,
    execution_status: policyResult.approved ? "APPROVED" : "BLOCKED",
    tx_hash: null,
    action_id: policyResult.approved ? actionId : null,
  });

  if (!policyResult.approved) {
    return NextResponse.json({
      status: "BLOCKED",
      transactionId: tx.id,
      reason: policyResult.code,
      message: policyResult.reason,
      amount: amountStr,
      token: "USDC",
      recipient,
    });
  }

  // 3. Execute USDC transfer via vault on Arc
  try {
    const result = await executeVaultSpend(VAULT, USDC, recipientAddr, BigInt(amount), actionId as Hex);

    if (!result.success) {
      updateTransaction(tx.id, {
        execution_status: "FAILED",
        tx_hash: result.txHash || null,
        decision_code: result.error?.includes("revert") ? "EXCEEDS_PER_TX_LIMIT" as DecisionCode : "AGENT_NOT_FOUND" as DecisionCode,
      });

      return NextResponse.json({
        status: "FAILED",
        transactionId: tx.id,
        reason: result.error,
        amount: amountStr,
        token: "USDC",
        recipient,
      });
    }

    // 4. Update transaction as confirmed
    updateTransaction(tx.id, {
      execution_status: "CONFIRMED",
      tx_hash: result.txHash || null,
      confirmed_at: Math.floor(Date.now() / 1000),
    });

    incrementDailySpent(agentId, amount);

    return NextResponse.json({
      status: "APPROVED",
      transactionId: tx.id,
      amount: amountStr,
      token: "USDC",
      recipient,
      network: "Arc Testnet",
      executionStatus: "CONFIRMED",
      txHash: result.txHash,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    updateTransaction(tx.id, {execution_status: "FAILED", decision_code: "AGENT_NOT_FOUND" as DecisionCode});

    return NextResponse.json({
      status: "FAILED",
      transactionId: tx.id,
      reason: `Execution error: ${msg.slice(0, 200)}`,
      amount: amountStr,
      token: "USDC",
      recipient,
    });
  }
}
