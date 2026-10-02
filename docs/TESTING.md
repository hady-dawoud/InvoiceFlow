# Verification

Use the Node version and dependencies described in README. Configure a private
`BETTER_AUTH_SECRET` before building; set `APP_URL` to the intended server origin.
Run commands from the repository root:

```powershell
npm test
npm run lint -- --max-warnings 0
npx tsc --noEmit --incremental false
npm run build
node tests/e2e-smoke.mjs
git diff --check
```

Vitest generates the SQLite schema from the real Drizzle definitions. Invoice
persistence uses disposable file databases under the OS temporary directory;
billing tests use independent in-memory databases. It covers account ownership,
real dates, strict quantities, exact money and overflow, deletion history,
rollback, upgrade preservation, quota concurrency, and exhausted write locks.
Command tests verify `.env` database targets and shell overrides in separate
processes, using disposable databases rather than the application database.
Billing tests exercise real authentication and SQLite; only the Next request and
redirect boundary and Stripe HTTP are replaced. Stripe accounts and keys are
not required for these tests.

The smoke script starts a production server on an available port with a freshly
created disposable database and an ephemeral authentication secret. It seeds its
own demo account, disables billing, and closes the server and browser on exit.
It does not use the application database or modify environment files. Temporary
SQLite files can remain until the OS cleans them up because Windows native
SQLite can retain handles until process exit. Screenshots and the downloaded PDF
are saved to ignored `gui-test-screenshots/`.

The browser checks signup, failed-request recovery, clients, invoices, the quota
wall, disabled billing, Pro login, PDF export, and public links. Invoice-number
matching accepts the current year. It waits for observable state rather than
fixed sleeps.

## PDF layout review

For additional visual verification, install PyMuPDF in your Python environment,
then run:

```powershell
npx tsx tests/pdf-review.ts
python tests/verify-pdf.py
```

The scripts write ignored review PDFs and page images to `tmp/pdf-review/` and
verify page counts, repeated headings, retained ending markers in long content,
and text bounds. Inspect the images for spacing and column alignment; geometric
checks alone do not prove the layout is readable.
