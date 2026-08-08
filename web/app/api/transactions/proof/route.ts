import {NextResponse} from "next/server";
import {latestProofTx} from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Latest approved + blocked payments for the landing-page live proof (real DB transactions). */
export async function GET() {
  const {approved, blocked} = latestProofTx();
  const toProof = (tx: NonNullable<typeof approved>, kind: "approved" | "blocked") =>
    tx
      ? {
          txHash: tx.tx_hash,
          amountRaw: String(Math.round(tx.amount * 1_000_000)),
          reason: kind === "blocked" && tx.decision_code ? tx.decision_code : null,
        }
      : null;
  return NextResponse.json({
    approved: approved ? toProof(approved, "approved") : null,
    blocked: blocked ? toProof(blocked, "blocked") : null,
  });
}
