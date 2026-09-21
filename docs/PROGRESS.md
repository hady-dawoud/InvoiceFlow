# InvoiceFlow — Build Progress Log

> Running log of what is being built, phase by phase. Newest entries at the bottom.
> Working title: **InvoiceFlow** — a freelancer invoicing SaaS.
> Business goal: **$1000/month MRR** (~110 customers × $9/mo Pro plan).

## Phase 0 — Decisions (2026-09-21)

- Product: Invoice SaaS for freelancers (user picked from 4 candidates).
- Stack: Next.js 15 full-stack + TypeScript + Tailwind v4 + Drizzle ORM + libsql/SQLite.
- Billing: Stripe Checkout subscriptions in **test mode** (graceful no-keys fallback).
- Auth: better-auth (email + password) with Drizzle adapter.
- Freemium: free = 3 invoices/calendar month; Pro $9/mo = unlimited + PDF export.
- Environment at build time: Windows 11, Node 24.11.1, npm 11.6.2, git 2.46.2.

## Phase 1 — Scaffold (2026-09-21)

- `git init` (branch `main`).
- Scaffolded Next.js 15.5.25 (`create-next-app`, App Router, `src/` dir, TS, Tailwind v4, ESLint 9).
- Installed runtime deps: `drizzle-orm@0.45`, `@libsql/client@0.18`, `better-auth@1.7`,
  `stripe@22`, `pdfkit@0.20`.
- Installed dev deps: `drizzle-kit`, `vitest@5`, `tsx`, `@types/pdfkit`; bumped
  `@types/node` to v24 (vitest 5 peer requirement; Node runtime is v24).
- Added `.env.example`, extended `.gitignore` (SQLite files, `.zcode/`, keep `.env.example`).
- Created `docs/` with PROGRESS (this file), DECISIONS, GROWTH; wrote README.

## Phase 2 — Data layer (2026-09-21)

- `src/db/schema.ts`: better-auth core tables (`user`, `session`, `account`,
  `verification`) with app fields on `user` (isPro, stripe ids, businessName,
  currency, proSince) + app tables `clients`, `invoices` (status draft|sent|paid,
  per-user unique number, public share token, tax in basis points),
  `invoice_items` (integer cents).
- `src/db/index.ts` (libsql client; `DATABASE_URL` fallback `file:./app.db`),
  `drizzle.config.ts` (turso dialect so `file:` URLs work without extra drivers).
- Verified: `npm run db:push` creates all 7 tables; inspected via sqlite_master.

## Phase 3 — Auth (2026-09-21)

- `src/lib/auth.ts`: better-auth + drizzleAdapter (sqlite), email+password,
  `user.additionalFields` for app fields with `input: false` (client can never
  set `isPro`), `nextCookies()` plugin.
- Route handler `/api/auth/[...all]`, React client `src/lib/auth-client.ts`.
- Pages: `/login`, `/signup` (auth route group, shared card layout).
- `src/middleware.ts`: redirects cookie-less visitors from `/dashboard*` to
  `/login?next=…` (full session re-validated server-side via
  `src/lib/session.ts` → `auth.api.getSession`).
- `src/db/seed.ts`: demo account `demo@invoiceflow.dev` / `demo12345` with
  3 clients + 5 invoices (2 paid, 2 sent incl. 1 overdue, 1 draft). Seed uses
  `auth.api.signUpEmail`, which also proved the better-auth↔drizzle wiring.
- Live smoke test (curl): `/login` 200; `/dashboard` 307→`/login?next=`;
  `POST /api/auth/sign-in/email` returns user incl. custom fields; `/dashboard`
  with session cookie 200.
- Placeholder landing page + app metadata (full marketing page in Phase 6).

## Phase 4 — Core CRUD (2026-09-21)

- Pure libs: `money.ts` (integer-cents math, `formatCents`, `parseAmountToCents`),
  `invoice.ts` (numbering `INV-YYYY-####`, derived overdue, status transitions),
  `quota.ts` (`FREE_MONTHLY_LIMIT = 3`, calendar-month window).
- Data layer: invoice summaries (grouped item-sum aggregation merged in TS),
  client stats, transactional invoice create/update (items replaced atomically),
  per-user invoice numbering from max existing sequence (delete-safe).
- Server actions for clients/invoices/billing with validation + ownership
  checks on every mutation (server actions are reachable over HTTP, so runtime
  values are re-validated).
- UI: dashboard shell + nav, stat cards (billed/paid/outstanding/overdue),
  invoice list with filter tabs, invoice editor with live totals and
  save-as-draft / save-and-send, detail view with print-friendly document,
  client manager; free-tier wall rendered server-side (page) and client-side
  (editor).
- **Bug found & fixed**: raw correlated subqueries in drizzle render unqualified
  column refs in single-table queries (`"id"`), so `iv.client_id = "id"`
  resolved against the subquery's own table and client invoice counts showed 0.
  Replaced with grouped subqueries merged in TypeScript.
- Verified: `tsc` clean; data-layer integration checks (12 assertions incl.
  quota wall, numbering, totals, ownership, client-invoice guard); pages render
  seed data with correct totals ($8,350 billed = $5,800 paid + $2,100
  outstanding + $450 overdue).

## Phase 5 — Billing (2026-09-21)

- `stripe.ts`: lazy Stripe client; `isBillingConfigured()` / `isTestMode()`;
  checkout uses `STRIPE_PRICE_ID` if set, else an inline $9/mo `price_data`
  (zero dashboard setup to test).
- Webhook state machine in `stripe-events.ts` — **pure** `decideStripeAction()`
  (grant on `checkout.session.completed`, revoke on `subscription.deleted` /
  `updated` when status ∉ {active, trialing, past_due}) + DB executor
  `applyStripeAction()`; route verifies signatures via
  `constructEventAsync`, returns 503 when unconfigured, 400 on bad signature.
- Server actions: `upgradeToProAction` (creates/reuses Stripe customer with
  `metadata.userId`, checkout session, redirect) and
  `openCustomerPortalAction`.
- Pages: `/dashboard/billing` (plan card, upgrade/portal, test-mode hint,
  success/cancel/error banners) and public `/pricing` (two plans, FAQ,
  state-aware CTAs). Nav "Billing" → `/dashboard/billing`.
- Verified: `tsc` clean; 7/7 webhook decision cases; webhook returns 503
  without keys; both pages render.

## Phase 5 — Billing

(pending)

## Phase 6 — Delivery (2026-09-21)

- **PDF export (Pro)**: `/api/invoices/[id]/pdf` with pdfkit (Node runtime,
  `serverExternalPackages` so its font files survive bundling). Ownership
  checked; non-Pro gets 402; response streams as attachment
  `<number>.pdf`. Detail page shows "Download PDF" for Pro, "PDF (Pro)"
  upsell chip for free users.
- **Public invoice page** `/pay/[token]`: tokenized, no-auth, read-only
  invoice document + print/save-as-PDF button + `noindex` metadata.
  Bad token → 404.
- **Landing page** replaced: hero with mock invoice card, 4 features,
  3-step how-it-works, CTA bands, footer; auth-aware CTAs on /pricing.
- Seed updated: demo account is **Pro** (every feature tryable on first
  login); fresh signups get the free-plan experience. Seed's duplicate-user
  catch now matches better-auth's actual error text.
- Verified live: PDF 200 with `%PDF` magic bytes; public page renders;
  404 on bad token; landing content renders; `tsc` clean.

## Phase 7 — Quality

(pending)

## Phase 8 — Handoff

(pending)
