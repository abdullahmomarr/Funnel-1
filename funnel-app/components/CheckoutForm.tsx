"use client";

import { useState } from "react";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { usd, type BumpKey } from "@/lib/products";

type Props = {
  email: string;
  name: string;
  bumps: Record<BumpKey, boolean>;
  amount: number; // cents, for the button label
  onPaid: (result: { customerId: string; paymentMethodId: string }) => void;
};

export default function CheckoutForm({ email, name, bumps, amount, onPaid }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);

    // 1. Validate the Payment Element inputs.
    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message || "Please check your card details.");
      setBusy(false);
      return;
    }

    // 2. Create the PaymentIntent server-side (amount recomputed there).
    let clientSecret: string;
    let customerId: string;
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, bumps }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Checkout failed.");
      clientSecret = data.clientSecret;
      customerId = data.customerId;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
      setBusy(false);
      return;
    }

    // 3. Confirm the payment. redirect: "if_required" keeps us in the SPA for
    //    cards that don't need 3-D Secure.
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret,
      redirect: "if_required",
      confirmParams: { return_url: window.location.href },
    });

    if (confirmError) {
      setError(confirmError.message || "Payment could not be completed.");
      setBusy(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === "succeeded") {
      const pmId =
        typeof paymentIntent.payment_method === "string"
          ? paymentIntent.payment_method
          : paymentIntent.payment_method?.id || "";
      onPaid({ customerId, paymentMethodId: pmId });
      return;
    }

    setError("Payment is still processing. Please wait a moment.");
    setBusy(false);
  }

  return (
    <div>
      <div className="pay-element">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>
      <button
        className="btn"
        style={{ marginTop: 18 }}
        onClick={handlePay}
        disabled={busy || !stripe}
      >
        {busy ? "Processing…" : `Get instant access, ${usd(amount)}`}
      </button>
      <p className="mnote">60-minute guarantee · keep the kit either way</p>
      {error && <p className="merror">{error}</p>}
    </div>
  );
}
