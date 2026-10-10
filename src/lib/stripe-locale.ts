export type StripeLocaleInput = { cookie: string | null; locale: "en" | "ar" };

export function checkoutLocale(input: StripeLocaleInput): "en" | "auto" {
  return input.cookie === "en" ? "en" : "auto";
}

export function portalLocale(
  input: StripeLocaleInput,
  allow: readonly string[],
): "en" | "ar" | "auto" {
  if (input.cookie === "en") return "en";
  if (input.locale === "ar" && allow.includes("ar")) return "ar";
  return "auto";
}

function isInvalidLocaleRequest(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { type, param } = error as { type?: unknown; param?: unknown };
  return type === "invalid_request_error" && param === "locale";
}

export async function createPortalSession(
  locale: string,
  create: (locale: string) => Promise<string>,
): Promise<string> {
  try {
    return await create(locale);
  } catch (error) {
    if (!isInvalidLocaleRequest(error)) throw error;
    console.warn("Retrying Stripe customer portal with locale=auto after invalid locale");
    return await create("auto");
  }
}
