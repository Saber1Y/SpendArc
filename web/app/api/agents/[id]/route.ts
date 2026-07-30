import {NextResponse} from "next/server";
import {getAgent} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const agent = getAgent(id);
  if (!agent) return NextResponse.json({error: "not found"}, {status: 404});
  return NextResponse.json({agent});
}
