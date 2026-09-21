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
| `APP_URL` | `https://yourdomain.com` — pins better-auth's trusted origin |
| `STRIPE_SECRET_KEY` | `sk_live_…` |
| `STRIPE_PRICE_ID` | price ID of the $9/mo Pro price (live mode) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from step 3 |

3. Build command `npm run build` (default). Drizzle schema is applied via
   `npm run db:push` run locally against the Turso URL (set the env vars in your
   shell for one run).

## 3. Stripe — live mode

1. Create a **$9/month recurring price** for a product named "InvoiceFlow Pro";
   copy its `price_…` id → `STRIPE_PRICE_ID`.
2. Webhook endpoint: `https://yourdomain.com/api/stripe/webhook`, subscribed to
   `checkout.session.completed`, `customer.subscription.updated` and
   `customer.subscription.deleted` (Pro is revoked when a subscription is
   canceled or left unpaid via the updated/deleted events).
   Copy the signing secret → `STRIPE_WEBHOOK_SECRET`.
3. Test the flow in **test mode first** (card `4242 4242 4242 4242`), then flip to
   live keys.

### Local webhook testing (test mode)

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
# copy the whsec_… it prints into .env as STRIPE_WEBHOOK_SECRET
```

No Stripe CLI? The webhook's state machine is covered by unit tests
(`src/lib/stripe-events.test.ts`), but Pro unlocks **only** via the webhook —
without it, payments succeed yet accounts stay on Free. Configure it before
accepting real payments.

## 4. Post-deploy checklist

- [ ] Sign up → create client → create invoice → share `/pay/…` link
- [ ] Upgrade with test/live card → Pro unlocks
- [ ] PDF export downloads (Pro)
- [ ] `robots.txt` + sitemap + analytics wired
- [ ] Backups: Turso snapshots enabled
