# InvoiceFlow

Professional invoicing SaaS for freelancers — create and send invoices in 60
seconds, track who paid, get paid.

> **Status: MVP in active development.** See [docs/PROGRESS.md](docs/PROGRESS.md)
> for the build log and [docs/GROWTH.md](docs/GROWTH.md) for the revenue plan
> (target: $1000/mo MRR).

## Stack

- **Next.js 15** (App Router, TypeScript) + **Tailwind CSS v4**
- **Drizzle ORM** + **libsql/SQLite** (local file DB; swap `DATABASE_URL` to Turso for prod)
- **better-auth** (email + password)
- **Stripe** Checkout subscriptions (test mode until you add live keys)
- **pdfkit** for Pro PDF export, **vitest** for tests

## Quick start

```bash
npm install
cp .env.example .env   # defaults work out of the box (no Stripe keys needed)
npm run db:push        # create the SQLite schema
npm run dev            # http://localhost:3000
```

Without Stripe keys the app runs with billing disabled (upgrade buttons show a
notice). With test keys, the whole checkout flow works using card
`4242 4242 4242 4242` and any future expiry/CVC.

## Docs

- [docs/PROGRESS.md](docs/PROGRESS.md) — build log
- [docs/DECISIONS.md](docs/DECISIONS.md) — architectural decisions & trade-offs
- [docs/GROWTH.md](docs/GROWTH.md) — pricing, channels, 90-day revenue roadmap
- [docs/DEPLOY.md](docs/DEPLOY.md) — going live (Vercel + Turso + Stripe live mode)

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run db:push` | Apply Drizzle schema to the database |
| `npm run db:studio` | Browse the DB in Drizzle Studio |
| `npm test` | Vitest unit tests |
