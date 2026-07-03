import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { OTOS, type OtoKey } from "@/lib/products";

export const runtime = "nodejs";

// One-click upsell. Charges the card saved during the main checkout, off
// session, with no card re-entry. This is what makes the "your card is
// already on file" promise real.
export async function POST(req: Request) {
  let customerId = "";
  let product: OtoKey | "" = "";
  let paymentMethodId = "";
  try {
    const body = await req.json();
    customerId = String(body?.customerId || "").trim();
    paymentMethodId = String(body?.paymentMethodId || "").trim();
    product = body?.product;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!customerId) {
    return NextResponse.json({ error: "Missing customer." }, { status: 400 });
  }
  if (!product || !(product in OTOS)) {
    return NextResponse.json({ error: "Unknown offer." }, { status: 400 });
  }

  const offer = OTOS[product];

  try {
    const stripe = getStripe();

    // Prefer the payment method returned from the original purchase; fall back
    // to the customer's most recently attached card.
    let pmId = paymentMethodId;
    if (!pmId) {
      const methods = await stripe.paymentMethods.list({
        customer: customerId,
        type: "card",
        limit: 1,
      });
      pmId = methods.data[0]?.id || "";
    }
    if (!pmId) {
      return NextResponse.json(
        { error: "No card on file for this customer." },
        { status: 400 }
      );
    }

    const intent = await stripe.paymentIntents.create({
      amount: offer.price,
      currency: "usd",
      customer: customerId,
      payment_method: pmId,
      off_session: true,
      confirm: true,
      description: offer.name,
      metadata: { offer: offer.name, type: "oto" },
    });

    if (intent.status === "succeeded") {
      return NextResponse.json({
        ok: true,
        line: { name: offer.name, price: offer.price },
      });
    }

    // Card needs authentication (SCA) — surface it rather than silently failing.
    return NextResponse.json(
      { error: "This card needs extra verification. Please use standard checkout." },
      { status: 402 }
    );
  } catch (err) {
    if (err instanceof Stripe.errors.StripeCardError) {
      return NextResponse.json(
        { error: "Your card was declined for this add-on." },
        { status: 402 }
      );
    }
    const message = err instanceof Error ? err.message : "Charge failed.";
    console.error("OTO error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
