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

Use Node.js 24 LTS. On a fresh checkout (PowerShell):

```powershell
npm install
Copy-Item .env.example .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copy the generated value into `BETTER_AUTH_SECRET` in `.env` before running the
app or building it. Keep `.env` private. Stripe keys can stay empty.

```powershell
npm run db:push
npm run db:seed  # optional demo data; use a development database
npm run dev
```

For an existing database, back it up and run `npm run db:upgrade` from the repo
root before starting the updated app. This additive upgrade creates and
initializes invoice counters without changing invoices or authentication data.
Upgrade and seed commands load Next.js environment files before connecting;
explicit shell environment variables take precedence.
Do not replace an existing `.env` with the example.

Demo login after seeding: `demo@invoiceflow.dev` / `demo12345` (Pro plan, with
sample clients and invoices). New signups get the free plan — 3 invoices per
calendar month. Deleted invoices still count toward that month’s quota.

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
| `npm run db:upgrade` | Add durable counters to an existing database |
| `npm run db:seed` | Seed the demo account (see above) |
| `npm run db:studio` | Browse the DB in Drizzle Studio |
| `npm test` | Vitest logic, authentication, SQLite persistence and offline Stripe tests |
| `node tests/e2e-smoke.mjs` | Playwright E2E smoke test with an isolated database and server |

## Verification

See [docs/TESTING.md](docs/TESTING.md) for the complete checks, isolated browser
smoke test, and PDF layout review. Production builds use standard `next build`.
