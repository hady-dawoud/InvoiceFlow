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

## Phase 2 — Data layer

(pending)

## Phase 3 — Auth

(pending)

## Phase 4 — Core CRUD

(pending)

## Phase 5 — Billing

(pending)

## Phase 6 — Delivery

(pending)

## Phase 7 — Quality

(pending)

## Phase 8 — Handoff

(pending)
