import {NextRequest, NextResponse} from "next/server";
import {listAgents, getAgent, createAgent} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({agents: listAgents()});
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {name, address} = body;
    if (!name || !address) return NextResponse.json({error: "name and address required"}, {status: 400});
    const agent = createAgent(name, address);
    return NextResponse.json({agent}, {status: 201});
  } catch {
    return NextResponse.json({error: "invalid request"}, {status: 400});
  }
}
