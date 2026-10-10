/**
 * Unstyled ICU arguments like `{count, number}` call `Intl.NumberFormat`
 * directly with no options — next-intl's `formats` config is never consulted
 * unless a message names a format, so it can't reach this case. Whatever the
 * rendering host's `Intl.NumberFormat("ar")` defaults to (Eastern
 * Arabic-Indic digits on some hosts, Western digits on others) is what every
 * unstyled number in the ar catalog would render as.
 *
 * This wraps the real `Intl.NumberFormat` so the bare `"ar"` locale always
 * gets `numberingSystem: "latn"` unless the caller already chose one, while
 * every other locale (including `en`/`en-US`, and regional Arabic tags like
 * `ar-SA`) is passed through unchanged.
 */

type NumberFormatConstructor = typeof Intl.NumberFormat;
type NumberFormatArgs = ConstructorParameters<typeof Intl.NumberFormat>;

function wantsLatinDigits(
  locales: NumberFormatArgs[0],
  options: NumberFormatArgs[1],
): boolean {
  if (options?.numberingSystem) return false;
  if (typeof locales === "string") return locales === "ar";
  if (Array.isArray(locales)) return locales.length === 1 && locales[0] === "ar";
  return false;
}

export function withLatinDigitsForArabic(Delegate: NumberFormatConstructor): NumberFormatConstructor {
  function LatinDigitsNumberFormat(
    this: unknown,
    ...[locales, options]: NumberFormatArgs
  ): Intl.NumberFormat {
    const resolvedOptions = wantsLatinDigits(locales, options)
      ? { ...options, numberingSystem: "latn" as const }
      : options;
    return new Delegate(locales, resolvedOptions);
  }

  LatinDigitsNumberFormat.supportedLocalesOf = Delegate.supportedLocalesOf.bind(Delegate);

  return LatinDigitsNumberFormat as unknown as NumberFormatConstructor;
}

const INSTALLED_FLAG = Symbol.for("invoiceflow.latinDigitsForArabic.installed");

/**
 * Patches the global `Intl.NumberFormat`. Safe to call from both server
 * (`src/i18n/request.ts`) and client (`src/i18n/latin-digits-client.ts`)
 * entry points — a process-wide flag makes repeated calls a no-op.
 */
export function installLatinDigitsForArabic(): void {
  const flagHolder = globalThis as typeof globalThis & { [INSTALLED_FLAG]?: boolean };
  if (flagHolder[INSTALLED_FLAG]) return;
  flagHolder[INSTALLED_FLAG] = true;
  Intl.NumberFormat = withLatinDigitsForArabic(Intl.NumberFormat);
}
