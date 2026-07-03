import Stripe from "stripe";

let cached: Stripe | null = null;

/**
 * Lazily construct the Stripe server client. Throws a clear error if the
 * secret key is missing so API routes can return a helpful 500 instead of
 * failing obscurely.
 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set. Copy .env.example to .env.local and add your keys.");
  }
  if (!cached) {
    // No apiVersion pin — use the account default the installed SDK expects.
    cached = new Stripe(key);
  }
  return cached;
}

/** Find-or-create a Stripe customer by email (keeps one customer per buyer). */
export async function getOrCreateCustomer(
  stripe: Stripe,
  email: string,
  name?: string
): Promise<Stripe.Customer> {
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data[0]) return existing.data[0];
  return stripe.customers.create({ email, name: name || undefined });
}
