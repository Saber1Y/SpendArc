import {NextRequest, NextResponse} from "next/server";
import {createAgentRun, listAgentRuns, getAgent, addAgentRunEvent} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const agentId = url.searchParams.get("agentId") || undefined;
  const limit = Math.min(Number(url.searchParams.get("limit") || "20"), 100);
  const runs = listAgentRuns(agentId, limit);
  return NextResponse.json({runs});
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {agentId, mission, budget, model} = body;
    if (!agentId || !mission) return NextResponse.json({error: "agentId and mission required"}, {status: 400});
    const agent = getAgent(agentId);
    if (!agent) return NextResponse.json({error: "agent not found"}, {status: 404});
    const run = createAgentRun({
      agent_id: agentId,
      mission,
      budget: Math.max(0, Math.round(Number(budget) * 1e6) || 0),
      model: model || "opencode",
    });
    addAgentRunEvent(run.id, "info", `Run started. Mission: ${mission}`);
    return NextResponse.json({run}, {status: 201});
  } catch {
    return NextResponse.json({error: "invalid request"}, {status: 400});
  }
}
