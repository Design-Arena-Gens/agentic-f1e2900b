import { NextRequest } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  const { incident, logs } = await req.json();
  const apiKey = process.env.OPENAI_API_KEY; // or AZURE_OPENAI_API_KEY with baseUrl
  const baseURL = process.env.OPENAI_BASE_URL; // optional for Azure OpenAI
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Missing OPENAI_API_KEY" }),
      { status: 400 }
    );
  }

  const client = new OpenAI({ apiKey, baseURL });

  const prompt = `You are an SRE troubleshooting assistant. Given an incident and execution logs, produce a concise final verdict and suggested next actions. Respond in 4-8 bullet points.\n\nIncident:\n${incident?.title}\n${incident?.description}\n\nLogs (last 60 lines):\n${(logs || []).slice(-60).join("\n")}`;

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a precise SRE assistant." },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
  });

  const content = response.choices[0]?.message?.content ?? "";
  return Response.json({ verdict: content.trim() });
}
