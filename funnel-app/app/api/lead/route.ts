import { NextResponse } from "next/server";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

// Email capture. Fires on step-1 "Continue" so a lead is recorded even if the
// buyer abandons before paying.
//
// This writes to data/leads.jsonl for local dev. On a serverless host the
// filesystem is ephemeral, so swap this append for your email tool / CRM /
// database (e.g. an insert, or a POST to an ESP webhook) — that is the one
// line to change.
export async function POST(req: Request) {
  let email = "";
  let name = "";
  try {
    const body = await req.json();
    email = String(body?.email || "").trim();
    name = String(body?.name || "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required." }, { status: 400 });
  }

  const record = JSON.stringify({ email, name, at: new Date().toISOString() }) + "\n";
  try {
    const dir = path.join(process.cwd(), "data");
    await mkdir(dir, { recursive: true });
    await appendFile(path.join(dir, "leads.jsonl"), record, "utf8");
  } catch (err) {
    // Don't block the funnel on a capture failure — just log it.
    console.error("Lead capture write failed:", err);
  }

  return NextResponse.json({ ok: true });
}
