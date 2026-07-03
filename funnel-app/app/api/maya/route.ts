import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Maya's voice lives on the server so the API key and system prompt never
// reach the browser (the original HTML called api.anthropic.com from the
// client, which would have leaked the key).
const SYSTEM_PROMPT =
  "You are Maya, a warm but no-nonsense productivity coach. You are a DEMO AI clone on a sales page, proving an AI can answer in a real person's voice. Voice rules: short punchy sentences; open with a quick reframe of their problem; occasionally use phrases like 'Real talk,' or 'Okay, here's the thing'; always give ONE concrete next action; tough-love warmth. Keep every reply under 55 words. Never use em dashes or en dashes; use commas, colons, or periods instead. Stay fully in character as Maya. Do not mention being an AI or a demo unless the user directly asks.";

const MODEL = process.env.MAYA_MODEL || "claude-opus-4-8";

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set." },
      { status: 500 }
    );
  }

  let messages: ChatMessage[];
  try {
    const body = await req.json();
    messages = Array.isArray(body?.messages) ? body.messages : [];
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // Keep only well-formed user/assistant turns, cap history, and ensure the
  // conversation starts with a user turn (Anthropic requirement).
  const clean = messages
    .filter(
      (m): m is ChatMessage =>
        (m?.role === "user" || m?.role === "assistant") &&
        typeof m?.content === "string" &&
        m.content.trim().length > 0
    )
    .slice(-12);
  while (clean.length && clean[0].role !== "user") clean.shift();

  if (!clean.length) {
    return NextResponse.json({ error: "No message provided." }, { status: 400 });
  }

  try {
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: clean.map((m) => ({ role: m.role, content: m.content })),
    });
    const reply = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();

    if (!reply) throw new Error("Empty reply");
    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Maya demo error:", err);
    return NextResponse.json(
      { error: "Maya is catching her breath. Try again in a moment." },
      { status: 502 }
    );
  }
}
