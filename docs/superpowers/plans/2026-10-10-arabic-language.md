# Arabic language implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add English/Arabic UI locale and a separate per-invoice document locale, including RTL sheet markup, without changing URLs.

**Architecture:** A pure locale resolver and a pure direction resolver feed next-intl and the invoice sheet. PDF drawing is behind a spike: UAX #9 line ordering is unit-tested first, then a throwaway script is judged by a person. The production PDF renderer does not start until that verdict is pass.

**Tech Stack:** Next.js 15 App Router, next-intl, bidi-js 1.1.0, vendored Noto Naskh Arabic static TTFs, existing pdfkit.

**Spec:** `docs/superpowers/specs/2026-10-10-arabic-language-design.md`

## Global Constraints

- Locales are only `en` and `ar`. Intl and next-intl receive those exact strings, never a raw `Accept-Language` tag.
- Cookie name is `invoiceflow_locale`. Only the switcher writes it. Invalid values are ignored.
- `dir="auto"` is not used.
- Amounts stay on `formatCents`. Do not pass `ar` or `ar-u-nu-latn` into currency formatting.
- Dates shown in the UI are stored `YYYY-MM-DD`. Do not format them with `Intl.DateTimeFormat`.
- next-intl must render `{count, number}` under locale `ar` with Latin digits. A named format is not a default.
- Stored names, addresses, descriptions, and notes are never translated.
- Do not strip U+200C or U+200D.
- The PDF spike script stays until the production renderer has merged. Do not merge the script into `renderInvoicePdf`.
- Do not start the production Arabic PDF renderer until the spike verdict is pass.

## Review Focus

- A pasted isolate (U+2066–U+2069) in a client name must disappear before PDF drawing, and a ZWNJ (U+200C) between Arabic letters must remain. Task 14 strips them. Task 16 checks the PDF buffer.
- `Accept-Language: ar-EG` resolves to `ar`, not `ar-EG`, so Intl cannot switch to Eastern digits. Task 2.
- Checkout sends `en` only when the cookie is exactly `en`. A missing cookie with an English fallback sends `auto`, including when the header is `fr`. A portal locale error retries once with `auto`; any other error does not. Task 13.
- An Arabic sheet under an English UI still shows Arabic labels, and `-$50.00` sits in `dir="ltr"`. Task 11. `calcTotals` rejects a negative unit price, so the negative amount is the amount node, not a line item.
- Recomputing embedding levels on a wrapped line that starts with `$` changes that character’s level. Task 14 keeps the paragraph levels.

## File map

- `src/lib/text-direction.ts` — first-letter direction, no bidi library.
- `src/lib/locale.ts` — cookie and `Accept-Language` resolution.
- `src/i18n/request.ts` — next-intl request config.
- `messages/en.json`, `messages/ar.json` — catalogs.
- `src/lib/actions/locale.ts` — switcher server action.
- `src/db/schema.ts`, `migrations/0002-document-locale.sql`, `src/db/upgrade.ts` — `document_locale`.
- `src/components/invoice-document.tsx` — sheet direction and `bdi` wrappers.
- `src/lib/stripe-locale.ts` — Checkout and portal locale mapping.
- `src/lib/bidi-lines.ts` — strip, UAX #9 reorder, logical token split.
- `fonts/NotoNaskhArabic-Regular.ttf`, `fonts/NotoNaskhArabic-Bold.ttf`, `fonts/OFL.txt` — PDF fonts only.
- `scripts/pdf-bidi-spike.ts` — kept until the production renderer merges, then deleted.

## Task 1: Direction resolver

**Files:**
- Create: `src/lib/text-direction.ts`
- Test: `src/lib/text-direction.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `textDirection(value: string): "ltr" | "rtl"`

- [x] **Step 1: Write the failing test**

```ts
import { expect, it } from "vitest";
import { textDirection } from "./text-direction";

it("classifies stored text", () => {
  expect(textDirection("مكتب")).toBe("rtl");
  expect(textDirection("Acme")).toBe("ltr");
  expect(textDirection("2 كتب")).toBe("rtl");
  expect(textDirection("+20 100 123 4567")).toBe("ltr");
  expect(textDirection("-$50")).toBe("ltr");
  expect(textDirection("")).toBe("ltr");
  expect(textDirection("١٢٣")).toBe("ltr");
});
```

- [x] **Step 2: Run `npx vitest run src/lib/text-direction.test.ts`**

Expected: FAIL, `textDirection` is not defined.

- [x] **Step 3: Implement `textDirection`**

Scan for the first `\p{L}` character. No letter returns `"ltr"`. Arabic, Hebrew, Syriac, Thaana, or `Nko` returns `"rtl"`. Any other letter returns `"ltr"`. Do not import a bidi library.

- [x] **Step 4: Run the same test**

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/lib/text-direction.ts src/lib/text-direction.test.ts
git commit -m "Add a first-letter text direction resolver."
```

## Task 2: UI locale resolver

**Files:**
- Create: `src/lib/locale.ts`
- Test: `src/lib/locale.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `resolveLocale(input: { cookie: string | null; acceptLanguage: string | null }): "en" | "ar"`

- [x] **Step 1: Write the failing test**

Cover: cookie `ar` beats `en-US`; cookie `nope` is ignored and `ar` in the header wins; `en-US,en;q=0.9,ar;q=0.8` is `en`; `ar-EG,en;q=0.5` is `ar`; `AR` is `ar`; `arc,en;q=0.8` is `en`; empty header is `en`; `*` is `en`; `en;q=0, ar;q=0.1` is `ar`. Assert `resolveLocale({ cookie: null, acceptLanguage: "ar-EG" })` is `"ar"`.

- [x] **Step 2: Run `npx vitest run src/lib/locale.test.ts`**

Expected: FAIL

- [x] **Step 3: Implement `resolveLocale`**

A cookie of `en` or `ar` wins. Otherwise parse `Accept-Language` ranges and `q` as the spec describes. Compare the primary subtag, case-insensitively. Return only `"en"` or `"ar"`.

- [x] **Step 4: Run the same test**

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/lib/locale.ts src/lib/locale.test.ts
git commit -m "Resolve UI locale from the cookie or Accept-Language."
```

## Task 3: next-intl, Western digits, pinned amounts

**Files:**
- Modify: `package.json`, `next.config.ts`, `src/app/layout.tsx`
- Create: `src/i18n/request.ts`, `messages/en.json`, `messages/ar.json`, `src/lib/catalog.test.ts`
- Modify: `src/lib/money.test.ts`

**Interfaces:**
- Consumes: `resolveLocale`
- Produces: next-intl `getRequestConfig` returning `locale` of `"en"` or `"ar"`. `{count, number}` under `ar` renders Latin digits.

- [x] **Step 1: Write the failing tests**

In `src/lib/money.test.ts`, assert `formatCents(5000, "usd")` is `$50.00` and `formatCents(-5000, "usd")` is `-$50.00`. `formatCents(123456, "usd")` is already pinned.

In `src/lib/catalog.test.ts`, render a message `{count, number}` with value `1234` under locale `ar` through `NextIntlClientProvider`. The markup contains `1234` and does not contain `١٢٣٤`. Named formats do not count unless that message actually uses them. Also assert the two JSON files have the same key paths, the same `{placeholder}` names on each leaf, and that any Arabic ICU plural contains `zero`, `one`, `two`, `few`, `many`, and `other`. Add one Arabic plural fixture key `quota` so the category check has something to fail on before translations exist.

- [x] **Step 2: Run `npx vitest run src/lib/money.test.ts src/lib/catalog.test.ts`**

Expected: money assertions fail if the strings differ; catalog fails until both files exist and match.

- [x] **Step 3: Install next-intl and wire the request config**

`src/i18n/request.ts` calls `resolveLocale` with the `invoiceflow_locale` cookie and the `accept-language` header. It does not write the cookie. Load `messages/${locale}.json`. The locale passed to next-intl is exactly `en` or `ar`. Configure number formatting so the `{count, number}` test renders Latin digits. Do not treat a named format as a default unless the message references that name. Root layout sets `lang` and `dir` (`rtl` when locale is `ar`) and wraps children in `NextIntlClientProvider`. Add the next-intl plugin in `next.config.ts`. Put a `quota` plural in both catalogs that satisfies the six Arabic categories. English chrome fonts stay Outfit and Fraunces. Load Noto Naskh Arabic for Arabic text on every page.

- [x] **Step 4: Run the same tests**

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add package.json package-lock.json next.config.ts src/i18n/request.ts src/app/layout.tsx messages/en.json messages/ar.json src/lib/catalog.test.ts src/lib/money.test.ts
git commit -m "Load English and Arabic catalogs with Western digits."
```

## Task 4: Marketing strings

**Files:**
- Modify: `messages/en.json`, `messages/ar.json`, `src/app/page.tsx`, `src/app/pricing/page.tsx`
- Test: `src/lib/catalog.test.ts`

**Interfaces:**
- Consumes: `getTranslations` / `useTranslations`
- Produces: marketing keys in both catalogs

- [x] **Step 1: Move marketing copy into both catalogs**

Same keys in both files. Do not translate stored invoice fields. Leave `formatCents` alone.

- [x] **Step 2: Run `npx vitest run src/lib/catalog.test.ts`**

Expected: PASS

- [x] **Step 3: Commit**

```bash
git add messages/en.json messages/ar.json src/app/page.tsx src/app/pricing/page.tsx
git commit -m "Translate the marketing pages."
```

## Task 5: Auth strings

**Files:**
- Modify: `messages/en.json`, `messages/ar.json`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`, `src/app/(auth)/layout.tsx`

- [x] **Step 1: Move auth copy into both catalogs**

- [x] **Step 2: Run `npx vitest run src/lib/catalog.test.ts`**

Expected: PASS

- [x] **Step 3: Commit**

```bash
git add messages/en.json messages/ar.json "src/app/(auth)"
git commit -m "Translate the auth pages."
```

## Task 6: Dashboard strings

**Files:**
- Modify: `messages/en.json`, `messages/ar.json`, `src/app/dashboard/page.tsx`, `src/app/dashboard/layout.tsx`, `src/app/dashboard/clients/page.tsx`, `src/components/nav-links.tsx`, `src/components/client-manager.tsx`, `src/components/client-form.tsx`, `src/components/sign-out-button.tsx`

- [x] **Step 1: Move dashboard and client-list copy into both catalogs**

Leave validation errors for Task 9.

- [x] **Step 2: Run `npx vitest run src/lib/catalog.test.ts`**

Expected: PASS

- [x] **Step 3: Commit**

```bash
git add messages src/app/dashboard/page.tsx src/app/dashboard/layout.tsx src/app/dashboard/clients src/components/nav-links.tsx src/components/client-manager.tsx src/components/client-form.tsx src/components/sign-out-button.tsx
git commit -m "Translate the dashboard chrome."
```

## Task 7: Invoice strings

**Files:**
- Modify: `messages/en.json`, `messages/ar.json`, `src/app/dashboard/invoices`, `src/components/invoice-editor.tsx`, `src/components/invoice-items-editor.tsx`, `src/components/invoice-actions.tsx`, `src/components/invoice-document.tsx`, `src/components/status-badge.tsx`, `src/components/copy-link-button.tsx`, `src/components/print-button.tsx`

- [x] **Step 1: Move invoice-screen copy into both catalogs**

Labels on the sheet use keys the document locale will select in Task 11. Do not change `dir` in this task.

- [x] **Step 2: Run `npx vitest run src/lib/catalog.test.ts`**

Expected: PASS

- [x] **Step 3: Commit**

```bash
git add messages src/app/dashboard/invoices src/components/invoice-editor.tsx src/components/invoice-items-editor.tsx src/components/invoice-actions.tsx src/components/invoice-document.tsx src/components/status-badge.tsx src/components/copy-link-button.tsx src/components/print-button.tsx
git commit -m "Translate the invoice screens."
```

## Task 8: Billing strings

**Files:**
- Modify: `messages/en.json`, `messages/ar.json`, `src/app/dashboard/billing/page.tsx`

- [x] **Step 1: Move billing-page copy into both catalogs**

- [x] **Step 2: Run `npx vitest run src/lib/catalog.test.ts`**

Expected: PASS

- [x] **Step 3: Commit**

```bash
git add messages src/app/dashboard/billing/page.tsx
git commit -m "Translate the billing page."
```

## Task 9: RTL layout and user-visible errors

**Files:**
- Modify: `src/app`, `src/components`, `src/lib/invoice-validation.ts`, `src/lib/client-validation.ts`, `src/lib/actions/invoices.ts`, `src/lib/actions/clients.ts`, `messages/en.json`, `messages/ar.json`
- Create: `src/lib/rtl-layout.test.ts`
- Test: `src/lib/invoice-validation.test.ts`, `src/lib/client-validation.test.ts`

**Interfaces:**
- Consumes: the catalogs from Tasks 4–8
- Produces: logical direction classes, and validation or action errors that are catalog keys rather than English sentences

- [x] **Step 1: Write the failing tests**

`src/lib/rtl-layout.test.ts` reads every `.tsx` file under `src/app` and `src/components`. It fails when a class matches `ml-`, `mr-`, `pl-`, `pr-`, `text-left`, `text-right`, `left-`, or `right-`, unless that file and class are listed in an allowlist in the test. The allowlist starts empty.

A second test fails when a JSX text node in those files contains four or more consecutive Latin letters, unless the text is `InvoiceFlow` or listed in the same allowlist.

Existing validation tests that expect English sentences are updated to expect catalog keys such as `invoice.itemsTooLarge`. Add the Arabic and English messages for those keys.

- [x] **Step 2: Run `npx vitest run src/lib/rtl-layout.test.ts src/lib/invoice-validation.test.ts src/lib/client-validation.test.ts`**

Expected: FAIL

- [x] **Step 3: Convert layout and errors**

Replace physical direction utilities with `ms-`, `me-`, `ps-`, `pe-`, `text-start`, and `text-end`. Numeric columns use `text-end`. Add `rtl:rotate-180` only on an icon that points along the line. Return catalog keys from user-visible validation and actions. Do not change webhook or API machine JSON.

- [x] **Step 4: Run the same tests**

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src messages
git commit -m "Use logical direction classes and catalog error keys."
```

## Task 10: Invoice document locale

**Files:**
- Modify: `src/db/schema.ts`, `src/db/upgrade.ts`, `src/lib/data/invoices.ts`, `src/lib/invoice-validation.ts`, `src/components/invoice-editor.tsx`
- Create: `migrations/0002-document-locale.sql`
- Test: `src/lib/data/invoices.test.ts`, `src/lib/invoice-validation.test.ts`

**Interfaces:**
- Consumes: `useLocale()` in the editor for the default. The server rejects any other value. Do not call `resolveLocale` from the client editor.
- Produces: `invoices.documentLocale: "en" | "ar"` on the Drizzle row and on `InvoiceInput`

- [x] **Step 1: Write the failing tests**

Creating an invoice with `documentLocale: "ar"` reads back `"ar"`. Updating it to `"en"` reads back `"en"`. Omitting it on create stores the locale passed by the caller. A value other than `en` or `ar` is rejected by validation. The upgrade test uses a fixture row inserted without the column and asserts the upgraded row is `en`.

- [x] **Step 2: Run `npx vitest run src/lib/data/invoices.test.ts src/lib/invoice-validation.test.ts`**

Expected: FAIL

- [x] **Step 3: Add the column**

`document_locale` is `text`, not null, default `'en'`. The SQL migration adds it only when `pragma_table_info` does not already list it, so `npm run db:upgrade` can run twice. Thread the field through `InvoiceInput`, create, update, and the editor control. The editor is a client component: default the control with `useLocale()`, and let the server reject a value other than `en` or `ar`. Do not import `resolveLocale` into the editor. There is no duplicate-invoice action; do not add one. The switcher does not write this column.

- [x] **Step 4: Run the same tests**

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/db/schema.ts src/db/upgrade.ts migrations/0002-document-locale.sql src/lib/data/invoices.ts src/lib/invoice-validation.ts src/components/invoice-editor.tsx src/lib/data/invoices.test.ts src/lib/invoice-validation.test.ts
git commit -m "Store a document locale on each invoice."
```

## Task 11: Sheet direction

**Files:**
- Modify: `src/components/invoice-document.tsx`
- Create: `src/components/invoice-document.test.ts`

The pay page (`src/app/pay/[token]/page.tsx`) and the invoice detail page (`src/app/dashboard/invoices/[id]/page.tsx`) already render `InvoiceDocument`. Print is that same sheet, using `print:` classes. Do not add a second sheet component.

**Interfaces:**
- Consumes: `textDirection`, `documentLocale`, `formatCents`, document-locale messages
- Produces: a sheet wrapper with `lang` and `dir` from `documentLocale`

- [x] **Step 1: Write the failing test**

`calcTotals` throws when a unit price is negative, so do not put `-5000` on a line item. Render the sheet for an Arabic document whose total is 5000 cents usd and assert `$50.00` is inside `dir="ltr"`. Render the same amount `bdi` the sheet uses, with `formatCents(-5000, "usd")`, inside a parent `dir="rtl"`, and assert the text is `-$50.00` and the `bdi` `dir` is `ltr`. Also assert `INV-1` and `2026-10-10` are each in `dir="ltr"`.

Assert a stored English name’s `bdi` is `ltr` and a stored Arabic name’s `bdi` is `rtl`. An English notes paragraph’s `bdi` is `ltr`.

Wrap the sheet in `NextIntlClientProvider` with locale `en` and render it with `documentLocale="ar"`. The label whose English catalog value is `Total due` appears as the Arabic catalog value, not as `Total due`.

- [x] **Step 2: Run `npx vitest run src/components/invoice-document.test.ts`**

Expected: FAIL

- [x] **Step 3: Mark up the sheet**

Wrapper `lang` and `dir` come from `documentLocale`. Server rendering passes that locale to the translator. Text cells use logical start alignment and do not set `dir="auto"`. Stored values use an inner `bdi` whose `dir` is `textDirection(value)`. Amounts, quantities, dates, and the invoice number use an inner `bdi` with `dir="ltr"`. Notes alignment follows the spec.

- [x] **Step 4: Run the same test**

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/components/invoice-document.tsx src/components/invoice-document.test.ts
git commit -m "Give the invoice sheet its own direction."
```

## Task 12: Language switcher

**Files:**
- Create: `src/lib/actions/locale.ts`, `src/components/language-switcher.tsx`
- Modify: `src/lib/locale.ts`, `src/lib/locale.test.ts`, `src/app/dashboard/layout.tsx`, `src/app/page.tsx`, `src/app/pricing/page.tsx`, `src/app/(auth)/layout.tsx`, `src/app/pay/[token]/page.tsx`

**Interfaces:**
- Consumes: the cookie name from Task 2
- Produces: `localeCookie(locale: "en" | "ar", options: { secure: boolean }): { name: "invoiceflow_locale"; value: "en" | "ar"; path: "/"; sameSite: "lax"; maxAge: 31536000; secure: boolean }` and `setLocaleAction(locale: "en" | "ar"): Promise<void>`

- [x] **Step 1: Write the failing test**

`localeCookie("ar", { secure: true })` returns `secure: true`. `localeCookie("en", { secure: false })` returns `secure: false`. Both use the name, path, `sameSite: "lax"`, and `maxAge: 31536000` above. Any other locale throws.

- [x] **Step 2: Run `npx vitest run src/lib/locale.test.ts`**

Expected: FAIL

- [x] **Step 3: Implement the cookie and the control**

`setLocaleAction` writes `localeCookie(locale, { secure: process.env.NODE_ENV === "production" })` and does not update an invoice. Place the switcher on the marketing header, auth layout, dashboard header, and the public invoice chrome. The public invoice sheet keeps using `documentLocale`.

- [x] **Step 4: Run the same test**

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/lib/locale.ts src/lib/locale.test.ts src/lib/actions/locale.ts src/components/language-switcher.tsx src/app
git commit -m "Remember the UI language from a switcher."
```

## Task 13: Stripe locale allow-lists

**Files:**
- Create: `src/lib/stripe-locale.ts`
- Modify: `src/lib/actions/billing.ts`
- Test: `src/lib/stripe-locale.test.ts`

**Interfaces:**
- Consumes: nothing from the UI tree. Input is `{ cookie: string | null; locale: "en" | "ar" }`.
- Produces: `checkoutLocale(input): "en" | "auto"`, `portalLocale(input, allow: readonly string[]): "en" | "ar" | "auto"`, and `createPortalSession(locale, create: (locale: string) => Promise<string>): Promise<string>`

- [x] **Step 1: Write the failing test**

`checkoutLocale({ cookie: "en", locale: "en" })` is `en`. `checkoutLocale({ cookie: null, locale: "en" })` is `auto`. `checkoutLocale({ cookie: "ar", locale: "ar" })` is `auto`. `portalLocale({ cookie: "en", locale: "en" }, ["en", "auto"])` is `en`. `portalLocale({ cookie: null, locale: "ar" }, ["en", "ar", "auto"])` is `ar`. `portalLocale({ cookie: "ar", locale: "ar" }, ["en", "auto"])` is `auto`. `portalLocale({ cookie: null, locale: "en" }, ["en", "ar", "auto"])` is `auto`.

`createPortalSession` with a mock that throws `{ type: "invalid_request_error", param: "locale" }` on the first call and returns `"ok"` on the second is called exactly twice. The second call receives `"auto"`. A mock that throws `{ type: "invalid_request_error", param: "customer" }` is called once and the error propagates.

- [x] **Step 2: Run `npx vitest run src/lib/stripe-locale.test.ts`**

Expected: FAIL

- [x] **Step 3: Implement the mappers and the retry**

Checkout’s allow-list is the spec’s enum. Never send `ar` to Checkout. Portal’s allow-list is the SDK enum copied into `portalLocale`’s `allow` argument. `upgradeToProAction` passes `checkoutLocale`. `openCustomerPortalAction` uses `createPortalSession`. Log the locale retry. Do not retry Checkout. Do not retry any other portal error.

- [x] **Step 4: Run the same test**

Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/lib/stripe-locale.ts src/lib/stripe-locale.test.ts src/lib/actions/billing.ts
git commit -m "Send Stripe only locales on its allow-lists."
```

## Task 14: Line ordering and the logical splitter

**Files:**
- Create: `src/lib/bidi-lines.ts`
- Test: `src/lib/bidi-lines.test.ts`
- Modify: `package.json` (dependency `bidi-js@1.1.0`)

**Interfaces:**
- Consumes: `bidi-js` 1.1.0. `getReorderSegments` and `getReorderedString` take the embedding-levels result and an inclusive `start` and `end`. `getMirroredCharactersMap` takes the `levels` `Uint8Array`, not the result object. Passing the result object returns an empty map and drops L4.
- Produces:
  - `stripBidiControls(value: string): string`
  - `paragraphLevels(text: string, base: "ltr" | "rtl"): EmbeddingLevels`
  - `reorderLine(text: string, levels: EmbeddingLevels, start: number, end: number): { text: string; level: number }[]`
  - `splitOversizedToken(value: string, widthOf: (piece: string) => number, columnWidth: number): string[]`

After `npm install bidi-js@1.1.0`, `package-lock.json` must resolve `bidi-js` to `1.1.0`. That is the version whose README and `package.json` were checked. The npm page has also shown `1.0.3`; do not install that.

- [x] **Step 1: Write the failing tests**

`stripBidiControls` removes U+061C, U+200E, U+200F, U+202A–U+202E, and U+2066–U+2069. It keeps U+200C and U+200D.

`paragraphLevels` is called once. `reorderLine` receives that object and a range. It must not call `getEmbeddingLevels` again. These rows were produced with `bidi-js` 1.1.0 `getReorderedString`, which applies L4. For a whole-string check, `start` is 0 and `end` is `text.length - 1`.

| Call | Result |
|---|---|
| `reorderLine("+20 100 123 4567", paragraphLevels(text, "ltr"), 0, end)` | `[{ text: "+20 100 123 4567", level: 0 }]` |
| same text, base `rtl` | `4567` level 2, space level 1, `123` level 2, space level 1, `100` level 2, space level 1, `20` level 2, `+` level 1 |
| `-$50.00`, base `ltr` | `[{ text: "-$50.00", level: 0 }]` |
| `-$50.00`, base `rtl` | `{ text: "$50.00", level: 2 }` then `{ text: "-", level: 1 }` |
| `(مكتب)`, base `rtl` | `[{ text: "(بتكم)", level: 1 }]` with code points U+0028, then the letters, then U+0029 |
| `Acme (Egypt)`, base `rtl` | `[{ text: "Acme (Egypt)", level: 2 }]` |
| `شركة Acme (Egypt)`, base `rtl` | `{ text: "Acme (Egypt)", level: 2 }` then `{ text: " ةكرش", level: 1 }` |

`Acme (Egypt)` stays one even level because this version’s bracket pairing keeps the closing parenthesis with the Latin run. Do not replace that row with a hand-solved N1/N2 split.

Wrapped line: text is `كتب $50 التالي`, base `rtl`, `start` is the index of `$`. `reorderLine` returns `يلاتلا ` at level 1, `50` at level 2, and `$` at level 1. `paragraphLevels("$50 التالي", "rtl").levels` starts with 2, while the paragraph levels at `$` start with 1. Those two arrays must not be equal.

`splitOversizedToken` keeps lam plus each of U+0627, U+0622, U+0623, and U+0625 together when the pair fits. It keeps lam + fatha + alef together. A column narrower than one ordinary cluster returns that cluster. A column narrower than a lam-alef pair returns the whole pair.

- [x] **Step 2: Run `npx vitest run src/lib/bidi-lines.test.ts`**

Expected: FAIL

- [x] **Step 3: Implement the functions**

`paragraphLevels` returns `getEmbeddingLevels(text, base)`. `reorderLine` uses `getReorderedString(text, levels, start, end)` for the inclusive range and groups consecutive visual characters that share the original level. Do not pass the result object to `getMirroredCharactersMap`. Do not write a digit or neutral splitter. `splitOversizedToken` follows the spec’s lam-alef rule.

- [x] **Step 4: Run the same test**

Expected: PASS. If a row fails, rerun `bidi-js` 1.1.0 and keep the library’s output. Do not edit the library result to match an earlier hand calculation.

- [x] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/bidi-lines.ts src/lib/bidi-lines.test.ts
git commit -m "Test UAX #9 line order and lam-alef splitting."
```

## Task 15: PDF spike

This is the first task that draws a PDF. Do not change `renderInvoicePdf`.

**Files:**
- Create: `fonts/NotoNaskhArabic-Regular.ttf`, `fonts/NotoNaskhArabic-Bold.ttf`, `fonts/OFL.txt`
- Create: `src/lib/pdf-cmap.test.ts`, `scripts/pdf-bidi-spike.ts`
- Create: `docs/superpowers/spikes/2026-10-10-arabic-pdf-verdict.md`

**Interfaces:**
- Consumes: `paragraphLevels`, `reorderLine`, `stripBidiControls`, `splitOversizedToken`, `textDirection`
- Produces: the verdict file. The script stays in the tree until Task 16 merges.

- [x] **Step 1: Vendor the fonts and write the cmap test**

Copy the full static Regular and Bold TTFs from notofonts (`fonts/NotoNaskhArabic/full/ttf/`), not a Google Fonts subset and not the variable font. The test reads the Regular cmap and fails if any character in the spike sample list is missing from both Naskh and WinAnsi.

- [x] **Step 2: Run `npx vitest run src/lib/pdf-cmap.test.ts`**

Expected: PASS if the vendored font covers those characters, otherwise stop and record the missing code points in the verdict file. Do not draw blanks.

- [x] **Step 3: Write the script**

`scripts/pdf-bidi-spike.ts` draws one page with the spec’s samples, including `شركة Acme (Egypt)`. It calls `paragraphLevels` once per paragraph and `reorderLine` per wrapped line. It writes a PDF under `tmp/` and prints the path. It is not imported by the app.

- [x] **Step 4: A person compares the page**

Render the same strings in the same font through HarfBuzz or a browser. Do not compare glyph IDs. Pass requires joined letters, wrapped lines that continue the paragraph, phone groups in order, and `-$50.00` with the minus on the left in the LTR numeric column. The person also checks `شركة Acme (Egypt)`.

The verdict file records `PASS` or `FAIL`, the shaping route (`Fontkit` or `pre-shaper`), the font features and sizes used, and one sentence. Keep `scripts/pdf-bidi-spike.ts`.

- [x] **Step 5: Stop or continue**

If the verdict is `FAIL`, do not start Task 16. If it is `PASS`, commit the fonts, the cmap test, the script, and the verdict. Do not delete the script.

```bash
git add fonts src/lib/pdf-cmap.test.ts scripts/pdf-bidi-spike.ts docs/superpowers/spikes/2026-10-10-arabic-pdf-verdict.md
git commit -m "Record the Arabic PDF spike verdict."
```

## Task 16: Production PDF renderer

Start this task only when the verdict file says `PASS`. Read the shaping route, font features, and sizes from that file and use them. Do not pick the other route.

**Files:**
- Modify: `src/lib/invoice-pdf.ts`, `src/app/api/invoices/[id]/pdf/route.ts`, `next.config.ts`
- Test: `src/lib/invoice-pdf.test.ts`
- Delete, in the commit below: `scripts/pdf-bidi-spike.ts`

**Interfaces:**
- Consumes: `paragraphLevels`, `reorderLine`, `stripBidiControls`, `splitOversizedToken`, `textDirection`, the vendored TTFs, translated label strings, the verdict’s shaping route
- Produces: `renderInvoicePdf(detail, owner, labels, documentLocale): Promise<Buffer>`

- [x] **Step 1: Extend the PDF tests**

An English fixture with no Arabic still produces a buffer and that buffer does not contain `NotoNaskh`. An Arabic `documentLocale` fixture produces a buffer that contains `NotoNaskh`. A missing TTF rejects. A client name of `\u2066مكتب\u2069` produces a buffer that does not contain U+2066. `currency: "invalid"` still throws.

- [x] **Step 2: Run `npx vitest run src/lib/invoice-pdf.test.ts`**

Expected: the new tests fail until the loader and the Arabic path exist.

- [x] **Step 3: Implement the spec pipeline**

Follow PDF steps 1–5 in the spec. Call `paragraphLevels` once per paragraph and `reorderLine` for each wrapped line. English documents keep Helvetica where Helvetica can encode the cluster and keep the current column positions. Arabic documents mirror columns and embed Naskh. Shape with the route recorded in the verdict. Measure and draw with that same route. Strip controls before shaping. Draw with line breaking off. `outputFileTracingIncludes` for `/api/invoices/[id]/pdf` includes both vendored TTF files.

- [x] **Step 4: Run `npx vitest run src/lib/invoice-pdf.test.ts src/lib/bidi-lines.test.ts src/lib/pdf-cmap.test.ts`**

Expected: PASS

- [x] **Step 5: Commit**

Delete `scripts/pdf-bidi-spike.ts` in this commit.

```bash
git add src/lib/invoice-pdf.ts src/app/api/invoices/[id]/pdf/route.ts next.config.ts src/lib/invoice-pdf.test.ts
git rm scripts/pdf-bidi-spike.ts
git commit -m "Draw Arabic invoice PDFs with the spiked text pipeline."
```
