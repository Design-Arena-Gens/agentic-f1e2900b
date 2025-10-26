import { NextRequest } from "next/server";

// Mock executor to simulate data center command execution.
// In production, integrate with MCP tools or secure RPC to SDN/controller.
export async function POST(req: NextRequest) {
  const { command } = await req.json();
  const now = new Date().toISOString();

  let output = "";
  switch (String(command || "")) {
    case "reset api":
      output = `OK: API reset @ ${now}`;
      break;
    case "get status":
      output = `STATUS: healthy nodes=12 unhealthy=0 ts=${now}`;
      break;
    case "check link":
      output = `LINK: controller=sdn-a path=up jitter=3ms loss=0% ts=${now}`;
      break;
    default:
      output = `UNKNOWN COMMAND '${command}' @ ${now}`;
  }

  return Response.json({ output });
}
