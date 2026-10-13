import {NextResponse} from "next/server";
import {listAgents} from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Public roster for the dashboard. Only non-sensitive fields are returned - never the API-key
 * hash or internal bookkeeping - so listing agents leaks nothing that helps impersonate one.
 * Agents are created only through POST /api/agents/user, which requires a wallet-ownership
 * signature; there is no unauthenticated create path.
 */
export async function GET() {
  const agents = listAgents().map((a) => ({
    id: a.id,
    name: a.name,
    address: a.address,
    status: a.status,
    created_at: a.created_at,
    last_active_at: a.last_active_at,
    vault_address: a.vault_address,
    network: a.network,
  }));
  return NextResponse.json({agents});
}
