import {NextResponse} from "next/server";
import {listAllowlistEntries} from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Read-only view of the server-side allowlist mirror. The mirror is never written directly:
 * the vault is the source of truth, and the DB is updated only by /api/allowlist/[agentId]/sync
 * after an owner-signed on-chain change is verified against the vault. This keeps the server
 * policy fence from ever being loosened out of step with the on-chain fence.
 */
export async function GET(_req: Request, {params}: {params: Promise<{agentId: string}>}) {
  const {agentId} = await params;
  const recipients = listAllowlistEntries(agentId, "recipient");
  const tokens = listAllowlistEntries(agentId, "token");
  return NextResponse.json({recipients, tokens});
}
