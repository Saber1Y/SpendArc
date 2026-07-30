import {NextResponse} from "next/server";
import {listAuditLogs} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || "50"), 200);
  return NextResponse.json({logs: listAuditLogs(limit)});
}
