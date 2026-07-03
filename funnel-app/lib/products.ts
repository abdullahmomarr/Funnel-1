// Single source of truth for pricing. Prices are in cents (Stripe's unit).
// The server ALWAYS recomputes the charge amount from this catalog — client
// values are never trusted for the actual charge.

export const BASE = { id: "blueprint", name: "The Clone Blueprint", price: 2700 } as const;

export const BUMPS = {
  voice: { id: "voice-upgrade", name: "Voice Upgrade", price: 1700 },
  content: { id: "content-pack", name: "Content Pack", price: 1300 },
} as const;

export const OTOS = {
  "deploy-kit": { id: "deploy-kit", name: "Deploy Kit", price: 4700 },
  "deploy-lite": { id: "deploy-lite", name: "Deploy Lite", price: 1900 },
} as const;

export type BumpKey = keyof typeof BUMPS;
export type OtoKey = keyof typeof OTOS;

export type OrderLine = { name: string; price: number };

/** Compute the base-order amount (cents) from the selected bumps. */
export function baseOrderAmount(bumps: Partial<Record<BumpKey, boolean>>): number {
  let total = BASE.price;
  for (const key of Object.keys(BUMPS) as BumpKey[]) {
    if (bumps[key]) total += BUMPS[key].price;
  }
  return total;
}

/** Build the human-readable order lines for the base order. */
export function baseOrderLines(bumps: Partial<Record<BumpKey, boolean>>): OrderLine[] {
  const lines: OrderLine[] = [{ name: BASE.name, price: BASE.price }];
  for (const key of Object.keys(BUMPS) as BumpKey[]) {
    if (bumps[key]) lines.push({ name: BUMPS[key].name, price: BUMPS[key].price });
  }
  return lines;
}

/** Format cents as a whole-dollar string, e.g. 2700 -> "$27". */
export function usd(cents: number): string {
  return "$" + (cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
}
