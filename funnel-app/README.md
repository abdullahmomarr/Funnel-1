# The Clone Blueprint — Next.js funnel

A Next.js (App Router, TypeScript) rebuild of `clone-blueprint-funnel.html` with:

- **Live Maya demo** powered by an API route (`/api/maya`) that proxies to Claude
  server-side — the API key and system prompt never reach the browser.
- **Stripe checkout** in the order modal using the Payment Element
  (`/api/checkout`), which saves the card to a Stripe Customer.
- **One-click OTO** (`/api/oto`) that charges the saved card off-session, with no
  card re-entry — powering both the Deploy Kit upsell and the Deploy Lite downsell.
- **Email capture** (`/api/lead`) that fires on step 1 of the modal, so a lead is
  recorded even if the buyer abandons before paying.

## Setup

```bash
cd funnel-app
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev                  # http://localhost:3000
```

### Environment variables (`.env.local`)

| Var | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Powers the Maya demo. |
| `MAYA_MODEL` | Optional. Defaults to `claude-opus-4-8`. The original HTML used `claude-sonnet-4-6` — set this to switch. |
| `STRIPE_SECRET_KEY` | Stripe server key (`sk_test_...`). |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe browser key (`pk_test_...`). |

The funnel renders and the Maya demo work without Stripe keys; the checkout step
shows a "Stripe not configured" note until the keys are present.

## How the flow works

1. **Sales page** → "Get the Blueprint" opens the modal.
2. **Step 1** (name + email) → `POST /api/lead` captures the email, then advances.
3. **Step 2** (order bumps + Payment Element) → on pay, `POST /api/checkout`
   creates a Customer + PaymentIntent with `setup_future_usage: "off_session"`,
   confirmed client-side with `redirect: "if_required"`.
4. **OTO 1 / Downsell** → "Yes, add" calls `POST /api/oto`, which charges the
   saved card off-session (`confirm: true`) — one click, no card re-entry.
5. **Thank-you** page shows the assembled order.

Prices live in one place: `lib/products.ts`. The server always recomputes the
charge amount from that catalog — client-sent amounts are never trusted.

## Testing Stripe locally

Use test-mode keys and card `4242 4242 4242 4242`, any future expiry, any CVC.
Card `4000 0025 0000 3155` triggers 3-D Secure (the one-click OTO returns a
"needs verification" message for cards that require authentication off-session).

## Notes / deviations from the source HTML

- **Testimonial screenshots** live in `public/assets/` and are served at
  `/assets/vicky-testimonial.png` (Case 1, sales coaching) and
  `/assets/liz-testimonial.png` (Case 2, entire company), in that order. To
  replace them, drop new files in `public/assets/` and keep the same names, or
  update the two `<img src>` values in `components/Funnel.tsx`.
- `/api/lead` appends to `data/leads.jsonl` for local dev. Swap that append for
  your CRM / ESP on a serverless host (the filesystem there is ephemeral).
