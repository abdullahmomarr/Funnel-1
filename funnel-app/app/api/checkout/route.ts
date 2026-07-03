import { NextResponse } from "next/server";
import { getStripe, getOrCreateCustomer } from "@/lib/stripe";
import { baseOrderAmount, baseOrderLines, type BumpKey } from "@/lib/products";

export const runtime = "nodejs";

// Creates the PaymentIntent for the main order (base + any order bumps).
// setup_future_usage: "off_session" saves the card to the customer so the
// one-click OTO (/api/oto) can charge it later without re-entering details.
export async function POST(req: Request) {
  let email = "";
  let name = "";
  let bumps: Partial<Record<BumpKey, boolean>> = {};
  try {
    const body = await req.json();
    email = String(body?.email || "").trim();
    name = String(body?.name || "").trim();
    bumps = {
      voice: !!body?.bumps?.voice,
      content: !!body?.bumps?.content,
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required." }, { status: 400 });
  }

  // Amount is computed server-side from the catalog — never from the client.
  const amount = baseOrderAmount(bumps);
  const lines = baseOrderLines(bumps);

  try {
    const stripe = getStripe();
    const customer = await getOrCreateCustomer(stripe, email, name);

    const intent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      customer: customer.id,
      setup_future_usage: "off_session",
      receipt_email: email,
      automatic_payment_methods: { enabled: true },
      description: "The Clone Blueprint",
      metadata: {
        order: lines.map((l) => l.name).join(", "),
      },
    });

    return NextResponse.json({
      clientSecret: intent.client_secret,
      customerId: customer.id,
      amount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed.";
    console.error("Checkout error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
