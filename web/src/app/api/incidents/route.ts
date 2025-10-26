import { NextRequest } from "next/server";

// In-memory store (stateless on Vercel; use DB in production)
const updates: Array<{
  id: string;
  title: string;
  description: string;
  verdict: string;
  logs: string[];
  ts: string;
}> = [];

export async function POST(req: NextRequest) {
  const { incident, verdict, logs } = await req.json();
  const ts = new Date().toISOString();
  updates.push({
    id: incident?.id ?? "INC-unknown",
    title: incident?.title ?? "",
    description: incident?.description ?? "",
    verdict: verdict ?? "",
    logs: Array.isArray(logs) ? logs.slice(-2000) : [],
    ts,
  });
  return Response.json({ ok: true, count: updates.length });
}

export async function GET() {
  return Response.json({ updates });
}
