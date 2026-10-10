# Arabic language

InvoiceFlow gains Arabic for the app UI and for invoice documents. URLs do not change. UI language and document language are separate. Stored names, addresses, descriptions, and notes are never translated.

## Decisions

- UI locale is a cookie when one is set, otherwise negotiated from `Accept-Language`. There is no `/ar` prefix and no account column for UI language.
- Each invoice stores `documentLocale` (`en` or `ar`). The sheet, print view, public invoice, and PDF use that value.
- Text columns align to the document’s start side on the web sheet and in the PDF. Paragraph direction controls bidi order only. Notes are the exception: a notes block aligns to its own paragraph direction.
- `dir="auto"` is not used. The HTML fallback for a value with no strong character is the parent direction, which reorders phone numbers and negative amounts inside an Arabic sheet. An inner `bdi` gets an explicit `dir` from the same resolver the PDF uses.
- Amounts keep the current English `formatCents` pattern in both locales. `ar-u-nu-latn` is not used.
- A PDF line is a list of directional runs from UAX #9. Runs are placed left to right. Glyphs inside an RTL run are reversed and L4-mirrored.
- Reading the locale cookie and `Accept-Language` makes catalog routes dynamic, including marketing. That is accepted.
- Arabic PDF rendering waits on a throwaway spike. A failed spike stops that work. The spike does not become production code.
- Copying Arabic out of a PDF is a known v1 limitation, recorded below.

## UI locale

Supported locales are `en` and `ar`.

Resolver, in order:

1. A cookie named `invoiceflow_locale` whose value is `en` or `ar`.
2. Otherwise `Accept-Language`.
3. Otherwise `en`.

Only the language switcher writes the cookie. It is `Path=/`, `SameSite=Lax`, and lasts one year. A server action sets it and accepts only `en` or `ar`. The first visit does not write a cookie, so a later change in the browser language still applies until the person chooses.

Header negotiation parses comma-separated ranges and their `q` values. `q` defaults to 1. A `q` of 0 is dropped. A range that does not parse is skipped. A range matches `en` or `ar` when its primary subtag, the part before the first hyphen, equals that tag, compared case-insensitively. `ar-EG` and `AR` match `ar`. `arc` does not. The highest `q` wins. Equal weights keep the earlier range. No match, including `*` alone, is `en`. `en-US,en;q=0.9,ar;q=0.8` is `en`.

`next-intl` loads `messages/en.json` or `messages/ar.json` from `src/i18n/request.ts`. The root layout sets `lang` and `dir` from the UI locale (`rtl` for Arabic) and wraps the tree in `NextIntlClientProvider`. Dashboard middleware stays an authentication gate and does not resolve a locale.

The switcher is on every page that shows UI chrome, including `/pay/[token]`. It changes the UI cookie only. In production the cookie is `Secure`.

Noto Naskh Arabic loads on every page, because a stored Arabic name can appear inside an English UI and an English document. English chrome keeps Outfit and Fraunces. Stored dates stay `YYYY-MM-DD`.

`src/i18n/request.ts` reads the cookie and `Accept-Language`. Every route that uses the catalog is dynamic, including the marketing pages. Those pages are translated and use the same resolver. They are not statically generated.

Amounts use `formatCents` as it works today, for the UI and for documents. Measured `ar` and `ar-u-nu-latn` output for 5000 usd is U+200F, then `50.00`, then a no-break space, then `US$`. Negative 5000 usd adds U+200E before the minus. That pattern is not used. Pinned usd results are `$50.00`, `-$50.00`, and `$1,234.56`.

`Intl` and next-intl receive exactly `en` or `ar`. They never receive a raw header tag such as `ar-EG`. Plain `ar` uses Western digits on current Node, and `ar-EG` uses Eastern digits (`١٬٢٣٤٫٥`). Older browser ICU data can differ for plain `ar`. `installLatinDigitsForArabic` wraps `Intl.NumberFormat` so locale `ar` uses `numberingSystem: "latn"` unless the caller already chose a numbering system. An unstyled `{count, number}` does not consult next-intl’s format config. Dates shown in the product are the stored `YYYY-MM-DD` strings. They are not passed through `Intl.DateTimeFormat`, which inserts U+200F in Arabic.

## Layout

An Arabic UI is right-to-left, so direction-sensitive layout uses logical Tailwind utilities: `ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`, and `text-end`. Physical `ml-*`, `mr-*`, `pl-*`, `pr-*`, `text-left`, `text-right`, and `left-*` / `right-*` positioning are not used for direction. Numeric columns stay on the end side via `text-end`. An icon that points along the line uses `rtl:rotate-180`.

User-visible errors from server actions and from form validation use catalog keys. Webhook and other machine JSON stays as it is.

## Document locale

`invoices.document_locale` is `en` or `ar`, not null. A new invoice takes the freelancer’s UI locale at save time. The editor can change it. The switcher does not.

The upgrade adds the column with default `en` and is safe to run again. Existing rows are `en`. There is no duplicate-invoice action today. Any later copy of an invoice copies `documentLocale` with it.

On `/pay/[token]` the sheet uses the invoice’s document locale. The chrome around it uses the client’s UI locale from that client’s request.

The invoice sheet and the print view each sit in a wrapper with `lang` and `dir` from `documentLocale`. The sheet builds its labels with `createTranslator` keyed by `documentLocale`, on the owner page and on `/pay/[token]`. The editor saves `documentLocale` and does not render a live sheet. Amounts inside the sheet use `formatCents` and do not change with the locale.

### Direction of one field

Split stored text on explicit newlines first. Each block is its own paragraph. Resolve direction once on that logical paragraph, before wrapping, and reuse it for every line.

Bidi base comes from `src/lib/text-direction.ts` for stored paragraphs, resolved once on the logical paragraph:

- Catalog labels use the document direction.
- A stored paragraph uses that function’s result.
- No letter in the paragraph returns LTR. That includes a phone number, an invoice number, digits only, and an empty string. `+20 100 123 4567` keeps the `+` on the left and the groups in that order. `-$50.00` keeps the minus on the left.

Alignment is a separate decision:

- Text columns align to the document start side in both languages. In an Arabic document that edge is the right. An English client name and an Arabic client name in the same column share that edge.
- Numeric columns align to the document end side in both languages.
- Notes align to the paragraph direction. When the paragraph contains a letter, that direction is the resolver’s result. When it does not, alignment uses the document direction. The LTR bidi base on a no-letter note does not move the block.

Web markup follows the same split. A text cell inherits the sheet’s `dir` and uses logical start alignment. The stored value is an inner `bdi` whose `dir` is `ltr` or `rtl` from the resolver above. The cell itself does not carry `dir="auto"`. A notes block sets its own alignment from the paragraph rule, and its inner `bdi` carries the bidi base.

Amounts, quantities, dates, and invoice numbers are generated or constrained strings. Each is an inner `bdi` with `dir="ltr"`, set explicitly or by the same resolver. Without that, an RTL cell renders `-$50.00` as `$50.00-`. A server render of an Arabic sheet asserts that the amount node’s `dir` is `ltr` and its text is `-$50.00`. The tax percent, including its parentheses, is its own inner `bdi` with `dir="ltr"`, so `(8.5%)` does not paint as `(%8.5)`. Stored client names and addresses in the client list use the same inner `bdi` as stored sheet fields. An amount interpolated into an Arabic sentence, including the overdue note, is an inner `bdi` with `dir="ltr"`.

The PDF places each line with `x` taken from the measured width against the same edge.

## PDF

English documents keep the current column geometry and keep Helvetica for a cluster Helvetica can encode. Arabic documents mirror the columns. On an Arabic document, Naskh draws every cluster it can encode, including Basic Latin.

The font is chosen per grapheme cluster, not once for a whole directional run. On an English document, Helvetica draws a cluster it can encode, Naskh draws a cluster Helvetica cannot and Naskh can, and anything left is `?` in Helvetica. On an Arabic document, Naskh draws a cluster it can encode, including Basic Latin; Helvetica draws a Latin or WinAnsi cluster Naskh cannot; anything left is `?` in Helvetica, not a blank `.notdef`. A smart quote, an en dash, an em dash, or `…` is its own cluster, so it does not force the surrounding Arabic letters onto Helvetica.

The spike’s first step checks the vendored Naskh cmap, and Helvetica’s WinAnsi coverage, against every character the spike draws. That check fails before any page is rendered if a sample character would come out blank. The Basic Latin claim is not taken on faith: the check covers the letters, digits, and `@._+-$,` the samples use, plus alef, lam, and fatha.

`next/font` serves woff2 to the browser. PDFKit cannot use those files. The repo vendors static Regular and Bold TTF instances, not the variable font, plus the OFL notice. `outputFileTracingIncludes` on the invoice PDF route includes those TTF files so a serverless deploy can read them.

The spike chooses the shaping route: Fontkit joining from the embedded font, or a pre-shaper that emits presentation forms. Width measurement and drawing use that same route. A pre-shaper is only acceptable when the embedded font contains the presentation-form glyphs it emits. A finished line is a list of directional runs either way. Fontkit is never given a string that was already visually reversed, because it joins by logical neighbours. Splitting a token that is already shaped is not allowed, because the letter before the break would keep a medial form.

Before any shaping, strip U+061C, U+200E, U+200F, U+202A through U+202E, and U+2066 through U+2069 so those marks are not drawn as boxes. Do not strip U+200C or U+200D. Those two change how Arabic letters join.

Pipeline:

1. Keep the string in logical order. Split on explicit newlines into paragraphs. Resolve each paragraph’s bidi base and alignment once, before wrapping.
2. Compute UAX #9 embedding levels once for the paragraph, using the resolver’s base. Call that result `paragraphLevels(text, base)`. Use an implementation such as `bidi-js`, not a hand-rolled split of digits and neutrals. Group the logical text into directional runs from those levels. Inside a run, split again wherever the cluster font changes. Shape each same-font piece in logical order. Measure the shaped widths. Wrapping uses those widths.
3. Wrap in logical order, on spaces. Trim trailing spaces at each wrap point before the line is ordered. An oversized token is split in the logical string, then each piece is reshaped and remeasured. A token with no Arabic splits on grapheme clusters. A token that contains Arabic splits on grapheme clusters, and a break is forbidden when the previous cluster’s base letter is U+0644 and the next cluster’s base letter is U+0627, U+0622, U+0623, or U+0625. The base letter is the cluster’s starter, so lam + fatha + alef (`لَا`) stays together. If the line is still empty and the next cluster is wider than the column, the line takes that cluster. A lam-alef pair is indivisible for this fallback: the line takes the whole pair and may overflow the column slightly.
4. On that wrapped line only, call `reorderLine(text, levels, start, end)`. It applies UAX #9 L1 and L2 using the paragraph levels from step 2. It does not compute new levels from the line’s own text. Place the visual sequence from left to right. Reverse glyphs inside RTL runs, and mirror the characters L4 mirrors, including parentheses and brackets. `(مكتب)` and `Acme (Egypt)` inside an RTL paragraph must point the right way.
5. Draw each cluster with line breaking off, in the font chosen for that cluster. `x` comes from the measured line width and the alignment rule.

An issue date and a due date are not glued onto their labels. Each date is its own paragraph with an LTR base, so a stored `2026-10-01` stays in that order. A tax caption whose last token is a parenthetical percent, such as `(8.5%)`, is a separate LTR run beside the tax name.

Every line takes at least one cluster, or a whole lam-alef pair when that is the next unit, so a narrow column cannot loop.

### Spike

The spike is a throwaway script. It renders one PDF page to an image and sets that image beside the same strings in the same font, rendered through HarfBuzz or a browser. A person judges joining and order. Glyph IDs are not compared.

Samples:

- a short Arabic word
- lam-alef in all four alef forms
- lam + mark + alef
- a word with diacritics
- a mixed line with an email and a Western-digit amount
- a paragraph that wraps
- Arabic with an English word inside it
- an English document with an Arabic client name
- inside an Arabic document, the phone number `+20 100 123 4567` in a text column, and the amount `-$50.00` in a numeric column (`formatCents(-5000, "usd")`)
- `(مكتب)` and, inside an RTL paragraph, `Acme (Egypt)`
- smart quotes and an em dash inside Arabic text, and the same marks inside an English note

Pass means letters join, wrapped lines continue the paragraph, and digit groups stay in order, including the sign and the groups in the phone number and in `-$50.00`. Failure stops the Arabic PDF renderer. English PDFs stay as they are.

Known v1 limitation: both shaping routes draw visual order, so copying Arabic out of the PDF comes out reversed or in presentation forms. A search for the stored name can miss.

### Splitter tests

Unit tests, separate from the visual spike:

- lam-alef kept together for U+0627, U+0622, U+0623, and U+0625 when the column fits the pair
- lam + combining mark + alef kept together
- a column narrower than one ordinary glyph returns that cluster and finishes
- a column narrower than a lam-alef pair returns the whole pair and finishes

Line-ordering tests, separate from the spike, call the same UAX #9 helper. Given a string and a base, they assert the sequence of `(text, level)` after L1 and L2. Required cases are `+20 100 123 4567` and `-$50.00`, each with an LTR base and with an RTL base. Parentheses are included: `(مكتب)` and `Acme (Egypt)` with an RTL base. The spike is not the only check on this order.

## Stripe

Checkout and the customer portal each have their own allow-list. A locale is sent only when it is on that API’s list.

Checkout’s list, from the Create Checkout Session docs, is `auto`, `bg`, `cs`, `da`, `de`, `el`, `en`, `en-GB`, `es`, `es-419`, `et`, `fi`, `fil`, `fr`, `fr-CA`, `hr`, `hu`, `id`, `it`, `ja`, `ko`, `lt`, `lv`, `ms`, `mt`, `nb`, `nl`, `pl`, `pt`, `pt-BR`, `ro`, `ru`, `sk`, `sl`, `sv`, `th`, `tr`, `vi`, `zh`, `zh-HK`, `zh-TW`. `ar` is not on it.

Checkout `locale` comes from the request of whoever starts the session: the client on `/pay/[token]`, the freelancer on upgrade. The pay page does not create a Checkout Session today. The same rule applies when it does. Send `en` only when that request’s cookie is explicitly `en`. Otherwise send `auto`.

The portal is only ever opened by the freelancer. Its allow-list is copied from the SDK enum, because the portal create-session page documents `locale` and does not publish the values. Send `en` only when that freelancer’s cookie is explicitly `en`. When the resolved UI locale is `ar`, from the cookie or from the header, send `ar` only if `ar` is on that enum, and otherwise send `auto`. Anything else sends `auto`.

Retry the portal call with `auto` only when Stripe returns an `invalid_request_error` whose `param` is `locale`. Log each retry. Checkout is not retried. Checkout only receives `en` or `auto`.

## Direction resolver

`src/lib/text-direction.ts` exports one pure function. It returns `ltr` or `rtl`. It does not import a bidi library. The invoice editor calls it on each keystroke, so the function stays free of server-only code.

It scans for the first letter (`\p{L}`). Digits and punctuation are skipped, including Arabic-Indic digits. No letter returns `ltr`. A letter in the Arabic, Hebrew, Syriac, Thaana, or N’Ko script (`Nko`) returns `rtl`. Any other letter returns `ltr`.

The sheet and the PDF call this function for stored paragraphs. Catalog labels do not: they use the document direction.

## Catalog

Message files cover marketing, auth, dashboard, invoice chrome, billing, and PDF labels. The Arabic file has the same keys as the English file. Every `{placeholder}` in an English message is present in the Arabic message. A counted string uses an ICU plural. The Arabic form of a counted string defines `zero`, `one`, `two`, `few`, `many`, and `other`. A test fails when a key, a placeholder, or one of those six categories is missing. User-typed values are not keys.

Client and server components use the catalog. The PDF renderer receives already-translated label strings plus the document locale, so it does not import React.

## Errors

- An invalid cookie is ignored. Resolution continues with `Accept-Language`. An unparseable header is `en`. The request still renders.
- A write that sends a `documentLocale` other than `en` or `ar` is rejected.
- A missing catalog key, placeholder, or Arabic plural category fails the catalog test.
- A PDF that needs the Arabic font and cannot load it fails the request. It does not draw blank glyphs with Helvetica.
- A portal locale error is retried once, as above. Any other Stripe error is returned as it is today.

## Tests

- Locale resolver: cookie over header, invalid cookie ignored, `q` ordering, primary-subtag match, `arc` rejected, empty header, `*`.
- Direction resolver: an Arabic name, an English name, `2 كتب`, a phone number, `-$50`, an empty string, and Arabic-Indic digits only.
- Arabic sheet render: the amount `-$50.00` is inside `dir="ltr"`.
- Line ordering: `(text, level)` after reordering for the phone number, `-$50.00`, `(مكتب)`, and `Acme (Egypt)`.
- `documentLocale` round-trip on create and update, default from the UI locale, upgrade backfill to `en`.
- Catalog key parity, placeholder parity, and the six Arabic plural categories on counted strings.
- `formatCents(5000, "usd")` is `$50.00`, `formatCents(-5000, "usd")` is `-$50.00`, and `formatCents(123456, "usd")` is `$1,234.56`.
- Stripe mapping: explicit `en` cookie, resolved `ar`, header-derived English, portal `ar` absent from the enum, portal retry only for `invalid_request_error` with `param === "locale"`.
- Splitter cases listed above.
- The visual spike is a manual gate with the samples listed above. It is not a unit assertion on glyph IDs.

## Implementation order

The spike is the first PDF task. It may add the TTF files it draws with. The production PDF renderer, Arabic column mirroring, and the serverless font trace wait until the spike passes. UI locale, catalogs, `documentLocale`, the direction resolver, and the web sheet do not wait on it.

## Out of scope

- Translating stored invoice content.
- A UI-language column on the user.
- Locale prefixes in URLs.
- Eastern Arabic digits.
- Making Arabic PDF text extract or search as logical Unicode. That is the known limitation above.
