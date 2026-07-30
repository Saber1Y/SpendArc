import {NextResponse} from "next/server";
import {listTransactions, getTransaction} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const agentId = url.searchParams.get("agentId") || undefined;
  const id = url.searchParams.get("id") || undefined;
  if (id) {
    const tx = getTransaction(id);
    if (!tx) return NextResponse.json({error: "not found"}, {status: 404});
    return NextResponse.json({transaction: tx});
  }
  return NextResponse.json({transactions: listTransactions(agentId)});
}
