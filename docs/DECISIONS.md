# Architectural & Product Decisions

Why things are the way they are. Newest at the bottom. Each entry: decision, context, trade-offs.

## D1 — Product: freelancer invoicing SaaS (2026-09-21)

Chosen from four candidate directions (invoice SaaS, testimonial widget, AI content
repurposer, subscription tracker). Invoicing has mass, evergreen demand from
freelancers, an obvious freemium hook (more invoices = pay), and **no per-user API
costs** — important because gross margin on a $9/mo plan must stay near 100% for the
$1000/mo goal to be reachable with ~110 customers rather than ~300.

## D2 — Next.js full-stack, single repo (2026-09-21)

One App Router project holds UI (React Server Components), server actions, API
routes, and the DB access layer. Trade-off vs. separate Express backend: less
boilerplate, one deploy target, one type system end-to-end. Cost: less explicit
layering — mitigated by keeping business logic in `src/lib` (framework-free modules
that vitest can test without Next).

## D3 — SQLite via libsql, Postgres-compatible later (2026-09-21)

`@libsql/client` with `DATABASE_URL=file:./app.db` gives zero-setup local dev. The
same drizzle schema works against Turso (hosted libsql) by only changing the URL,
which is the production path. Trade-off vs. starting on Postgres: no native
extensions or concurrent-write heavy loads — irrelevant at MVP scale, and Turso's
free tier keeps early fixed costs at $0.

## D4 — better-auth for email+password (2026-09-21)

Mature, actively maintained, Drizzle adapter, sensible session-cookie handling.
Fallback considered: hand-rolled bcrypt + HMAC cookie sessions (~100 LOC). If
better-auth version churn bites, the fallback remains available; the schema keeps
its own `users` table joined 1:1 to better-auth's `user` table.

## D5 — Freemium wall: 3 invoices per calendar month (2026-09-21)

The limit must be hit *quickly* by an active freelancer (3 invoices/month is one
week's work) but not so fast that the tool can't be evaluated. Server-enforced
(count of invoices created this calendar month for the user). Pro unlocks unlimited
invoices + PDF export. Monthly (not lifetime) reset keeps the upgrade prompt
recurring for value-seekers without being punitive.

## D6 — Money as integer cents (2026-09-21)

All amounts stored as INTEGER cents; never floats. Currency is per-user (default
USD) rather than per-invoice for MVP — simpler totals on the dashboard; per-invoice
currency is a v2 candidate.

## D7 — Stripe test-mode-first, graceful degradation (2026-09-21)

The full checkout → webhook → `is_pro` flow is implemented and demonstrable with
Stripe test keys and `4242 4242 4242 4242 4242`. With no keys configured the app
runs with billing disabled and shows an explicit notice — the MVP never crashes
because billing env vars are missing. Webhook events are processed through a pure
`decideStripeAction()` function so the state machine is unit-testable without Stripe.

## D8 — PDF via pdfkit, server-side (2026-09-21)

Server-generated PDF (Pro-only) beats client print-CSS for a paid feature: same
bytes on every client, works when shared as a file, no browser print-dialog UX.
pdfkit is pure JS, no headless browser dependency. Node runtime pinned on that route.

## D9 — Client delivery: tokenized public link, email deferred (2026-09-21)

MVP delivery = public read-only invoice page at `/pay/{token}` + owner marks status
manually (draft → sent → paid). Real email sending (Resend/SMTP) requires an API
key, deliverability setup (SPF/DKIM), and per-mail costs — deferred to v2, noted in
GROWTH.md so the launch checklist is honest.
