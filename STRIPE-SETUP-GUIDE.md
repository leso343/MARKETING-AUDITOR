# Stripe setup guide

Step-by-step walkthrough for wiring this app to Stripe Checkout — first in test mode, then flipping to live.

## 1. Sign up for Stripe + enable test mode

1. Go to https://dashboard.stripe.com/register and create an account (or sign in).
2. In the dashboard, confirm the **Test mode** toggle (top-right) is ON. Everything below uses test keys; no real money moves.

## 2. Create the two products

In the dashboard:

1. **Products → + Add product**
2. Product 1:
   - Name: `Pro`
   - Pricing: **Recurring**, `USD 99.00`, **Monthly**
   - Save.
3. Product 2:
   - Name: `Agency`
   - Pricing: **Recurring**, `USD 299.00`, **Monthly**
   - Save.

## 3. Copy the price IDs

Open each product, scroll to the **Pricing** section, copy the price ID (looks like `price_1Q...`). You'll have two — one for Pro, one for Agency. The format is `price_xxx`, NOT `prod_xxx` (product ID is different).

## 4. Copy the secret API key

1. **Developers → API keys**
2. Reveal the **Secret key** — starts with `sk_test_...`.
3. Copy it.

## 5. Set Vercel env vars

In the Vercel project settings (`Settings → Environment Variables`), add:

| Name                      | Value                                                   |
| ------------------------- | ------------------------------------------------------- |
| `STRIPE_SECRET_KEY`       | `sk_test_...` from step 4                               |
| `STRIPE_PRO_PRICE_ID`     | `price_...` for the Pro product                         |
| `STRIPE_AGENCY_PRICE_ID`  | `price_...` for the Agency product                      |
| `NEXT_PUBLIC_APP_URL`     | `https://marketing-auditor.vercel.app` (or your domain) |

`STRIPE_WEBHOOK_SECRET` comes in the next step.

> The build is deploy-safe: if any of these are missing, `/api/billing/*` returns **HTTP 503** with a clear message instead of crashing. So you can save and redeploy incrementally.

## 6. Create the webhook endpoint

1. **Developers → Webhooks → + Add endpoint**
2. **Endpoint URL**: `https://marketing-auditor.vercel.app/api/billing/webhook`
   (or your custom domain — must be public HTTPS)
3. **Listen to**: select these events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Save the endpoint, then click it to reveal the **Signing secret** (`whsec_...`).
5. Add it to Vercel:

| Name                      | Value      |
| ------------------------- | ---------- |
| `STRIPE_WEBHOOK_SECRET`   | `whsec_...` |

6. **Redeploy** the Vercel project so the new env vars take effect.

## 7. Test the end-to-end flow

1. Visit `https://marketing-auditor.vercel.app/pricing`
2. Sign in (the Subscribe buttons require an authenticated agency user).
3. Click **Subscribe — Pro** → you should be redirected to Stripe Checkout.
4. Use the test card:
   - Card number: `4242 4242 4242 4242`
   - Expiry: any future date (e.g. `12 / 34`)
   - CVC: any 3 digits (e.g. `123`)
   - ZIP: any 5 digits (e.g. `90210`)
5. Stripe redirects back to `/billing/success?session_id=cs_test_...`
6. The page calls `/api/billing/verify`, marks the subscription **active**, and shows a confirmation.
7. Open `/admin/billing` — you should see the plan, status, and next billing date.

## 8. Going live

When you're ready to take real payments:

1. Complete Stripe's **business verification** (KYC, bank account) in the dashboard.
2. Toggle the dashboard to **Live mode**.
3. **Recreate the two products** (Pro $99, Agency $299) in live mode — IDs from test mode don't carry over.
4. **Re-create the webhook endpoint** in live mode pointing at the same URL.
5. In Vercel, replace:
   - `STRIPE_SECRET_KEY` — paste the `sk_live_...` key
   - `STRIPE_PRO_PRICE_ID` / `STRIPE_AGENCY_PRICE_ID` — the new live `price_...` IDs
   - `STRIPE_WEBHOOK_SECRET` — the new live `whsec_...` signing secret
6. Redeploy.

That's it. Real cards will charge real money — test the flow end-to-end once with a real $0.50 card you own before publicizing the pricing page, just to make sure the live keys are wired correctly.

## Local development

You can run checkout against Stripe test mode from `localhost` if you forward the webhook with the [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
# In one terminal: forward webhooks to localhost
stripe listen --forward-to localhost:3000/api/billing/webhook
# The CLI prints a whsec_... — paste it into your local .env as STRIPE_WEBHOOK_SECRET

# In another: run the app
npm run dev
```

Set `NEXT_PUBLIC_APP_URL=http://localhost:3000` in your local `.env` so Stripe redirects come back correctly.

## Troubleshooting

| Symptom | Likely fix |
| --- | --- |
| `503 Stripe not configured — set STRIPE_SECRET_KEY` from `/api/billing/checkout` | `STRIPE_SECRET_KEY` missing in Vercel env. Add it and redeploy. |
| `503 Stripe not configured — set STRIPE_PRO_PRICE_ID` | Missing the relevant price ID env var. |
| Checkout redirects but subscription stays "incomplete" in `/admin/billing` | Webhook isn't reaching Vercel. Check the Stripe dashboard → Webhooks → endpoint → Recent deliveries. Wrong `STRIPE_WEBHOOK_SECRET` causes 400s; missing endpoint causes no events at all. |
| `Signature verification failed` in Vercel logs | `STRIPE_WEBHOOK_SECRET` is for a different endpoint / mode. Copy it fresh from the matching endpoint in the dashboard. |
| Plan shows but `Manage subscription` button errors | The customer ID hasn't been recorded yet — wait for the `customer.subscription.updated` webhook, or retry after a minute. |
