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
| `BETTER_AUTH_SECRET` | Private random secret of at least 32 bytes; keep it stable across app instances |
| `APP_URL` | `https://yourdomain.com` — pins better-auth's trusted origin |
| `STRIPE_SECRET_KEY` | `sk_live_…` |
| `STRIPE_PRICE_ID` | price ID of the $9/mo Pro price (live mode) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from step 3 |

3. Build command `npm run build` (default). Drizzle schema is applied via
   `npm run db:push` run locally against the Turso URL (set the env vars in your
   shell for one run). Before upgrading an existing database, back it up and
   stop invoice writes, then run `npm run db:upgrade` from the repo root against
   the reviewed target database. The upgrade is additive and rerunnable; the
   build does not migrate the database.

## 3. Stripe — live mode

1. Create a **$9/month recurring price** for a product named "InvoiceFlow Pro";
   copy its `price_…` id → `STRIPE_PRICE_ID`.
2. Webhook endpoint: `https://yourdomain.com/api/stripe/webhook`, subscribed to
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `customer.subscription.paused`, `customer.subscription.resumed`, `invoice.paid`,
   `invoice.payment_succeeded`, and `invoice.payment_failed`.
   The handler retrieves current Stripe state before applying access. Active,
   trialing, and past_due subscriptions retain Pro; other states revoke access.
   Checkout requires eligible payment and an eligible retrieved subscription.
   Returning from checkout shows pending activation until stored access confirms
   Pro. Old subscription events cannot change a replacement subscription.
   Copy the signing secret → `STRIPE_WEBHOOK_SECRET`.
3. Test the flow in **test mode first** (card `4242 4242 4242 4242`), then flip to
   live keys.

### Local webhook testing (test mode)

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
# copy the whsec_… it prints into .env as STRIPE_WEBHOOK_SECRET
```

No Stripe CLI? Offline tests cover webhook decisions, reconciliation, real
SQLite entitlement persistence and checkout guards (see [TESTING.md](TESTING.md)), but Pro unlocks **only** via the webhook —
without it, payments succeed yet accounts stay on Free. Configure it before
accepting real payments.

## 4. Post-deploy checklist

- [ ] Sign up → create client → create invoice → share `/pay/…` link
- [ ] Upgrade with test/live card → Pro unlocks
- [ ] PDF export downloads (Pro)
- [ ] `robots.txt` + sitemap + analytics wired
- [ ] Backups: Turso snapshots enabled

## Quota and numbering upgrades

Monthly creation counters use the server’s local calendar month. Creation checks
quota, allocates a yearly sequence, and inserts the invoice and items in one
write transaction with bounded lock retries. Deletion preserves usage and the
sequence; a failed creation rolls back both.

The upgrade initializes months from surviving invoices’ creation timestamps and
yearly sequences from their highest surviving `INV-YYYY-NNNN` numbers. Previously
deleted invoices cannot be reconstructed. Existing counters are never lowered
on a repeat upgrade. Keep the server time zone stable after deployment.

See [Stripe subscription webhook guidance](https://docs.stripe.com/billing/subscriptions/webhooks)
for the provider lifecycle. Account creation, live-key setup, and deployment are
separate operational steps; this review only verifies the integration offline.
