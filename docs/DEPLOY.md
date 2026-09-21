# Deploying InvoiceFlow

Three moving parts to go live: hosted database, app hosting, live billing.

## 1. Database — Turso (free tier)

Local dev uses `file:./app.db`. Production points the same schema at Turso.

```bash
# one-time: install CLI, create DB, grab credentials
turso db create invoiceflow
turso db show invoiceflow --url          # → DATABASE_URL (libsql://…)
turso db tokens create invoiceflow       # → DATABASE_AUTH_TOKEN
```

## 2. App — Vercel

1. Push this repo to GitHub, import it in Vercel.
2. Environment variables (Production):

| Variable | Value |
|---|---|
| `DATABASE_URL` | `libsql://…` from step 1 |
| `DATABASE_AUTH_TOKEN` | token from step 1 |
| `APP_URL` | `https://yourdomain.com` |
| `STRIPE_SECRET_KEY` | `sk_live_…` |
| `STRIPE_PRICE_ID` | price ID of the $9/mo Pro price (live mode) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from step 3 |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_…` (optional for Checkout-only flow) |

3. Build command `npm run build` (default). Drizzle schema is applied via
   `npm run db:push` run locally against the Turso URL (set the env vars in your
   shell for one run).

## 3. Stripe — live mode

1. Create a **$9/month recurring price** for a product named "InvoiceFlow Pro";
   copy its `price_…` id → `STRIPE_PRICE_ID`.
2. Webhook endpoint: `https://yourdomain.com/api/stripe/webhook`, subscribed to
   `checkout.session.completed` and `customer.subscription.deleted` events.
   Copy the signing secret → `STRIPE_WEBHOOK_SECRET`.
3. Test the flow in **test mode first** (card `4242 4242 4242 4242`), then flip to
   live keys.

### Local webhook testing (test mode)

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
# copy the whsec_… it prints into .env as STRIPE_WEBHOOK_SECRET
```

No Stripe CLI? The webhook's state machine is exercised by unit tests, and you can
verify end-to-end later — checkout itself works without webhooks (Pro unlocks via
the webhook, so keep it for production).

## 4. Post-deploy checklist

- [ ] Sign up → create client → create invoice → share `/pay/…` link
- [ ] Upgrade with test/live card → Pro unlocks
- [ ] PDF export downloads (Pro)
- [ ] `robots.txt` + sitemap + analytics wired
- [ ] Backups: Turso snapshots enabled
