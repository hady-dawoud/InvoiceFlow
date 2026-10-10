import { beforeEach, describe, expect, it } from "vitest";
import { withLatinDigitsForArabic } from "./latin-digits";

const EASTERN_ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

/**
 * A minimal stand-in for `Intl.NumberFormat` that records how it was
 * constructed and, unless told to use `numberingSystem: "latn"`, formats
 * with Eastern Arabic-Indic digits. This lets the test prove the wrapper's
 * effect on the call it delegates to, instead of depending on whatever the
 * host's real `Intl.NumberFormat("ar")` happens to default to.
 */
class FakeNumberFormat {
  static calls: Array<{ locales: unknown; options: Intl.NumberFormatOptions | undefined }> = [];

  constructor(
    private readonly locales: unknown,
    private readonly options?: Intl.NumberFormatOptions,
  ) {
    FakeNumberFormat.calls.push({ locales, options });
  }

  static supportedLocalesOf(locales: unknown) {
    return Array.isArray(locales) ? locales : [locales];
  }

  format(value: number): string {
    if (this.options?.numberingSystem === "latn") return String(value);
    return String(value).replace(/[0-9]/g, (digit) => EASTERN_ARABIC_DIGITS[Number(digit)]);
  }
}

describe("withLatinDigitsForArabic", () => {
  beforeEach(() => {
    FakeNumberFormat.calls.length = 0;
  });

  const WrappedNumberFormat = withLatinDigitsForArabic(
    FakeNumberFormat as unknown as typeof Intl.NumberFormat,
  );

  it("the unpatched delegate defaults the ar locale to Eastern Arabic-Indic digits", () => {
    const raw = new FakeNumberFormat("ar");
    expect(raw.format(1234)).toBe("١٢٣٤");
  });

  it("forces numberingSystem latn for the bare ar locale", () => {
    const formatted = new WrappedNumberFormat("ar") as unknown as FakeNumberFormat;

    expect(formatted.format(1234)).toBe("1234");
    expect(FakeNumberFormat.calls.at(-1)).toEqual({
      locales: "ar",
      options: { numberingSystem: "latn" },
    });
  });

  it("does not add a numbering system for en-US with explicit currency options", () => {
    const options: Intl.NumberFormatOptions = { style: "currency", currency: "USD" };

    new WrappedNumberFormat("en-US", options);

    expect(FakeNumberFormat.calls.at(-1)).toEqual({ locales: "en-US", options });
  });

  it("does not override a caller-specified numbering system for ar", () => {
    const options: Intl.NumberFormatOptions = { numberingSystem: "arab" };

    new WrappedNumberFormat("ar", options);

    expect(FakeNumberFormat.calls.at(-1)).toEqual({ locales: "ar", options });
  });

  it("leaves a regional Arabic tag like ar-SA untouched", () => {
    new WrappedNumberFormat("ar-SA");

    expect(FakeNumberFormat.calls.at(-1)).toEqual({ locales: "ar-SA", options: undefined });
  });

  it("keeps supportedLocalesOf working", () => {
    expect(WrappedNumberFormat.supportedLocalesOf(["ar", "en"])).toEqual(["ar", "en"]);
  });
});
