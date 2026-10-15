const MAX_NAME_CHARS = 120;
const MAX_TAX_ID_CHARS = 40;
const MAX_INSTRUCTIONS_CHARS = 500;

export const BUSINESS_CURRENCIES = ["usd", "eur", "gbp", "cad", "aud", "sar", "aed", "egp"] as const;

export type BusinessCurrency = (typeof BUSINESS_CURRENCIES)[number];

export type BusinessProfile = {
  businessName: string;
  currency: BusinessCurrency;
  taxId: string | null;
  paymentInstructions: string | null;
};

export type BusinessProfileResult =
  | { ok: true; profile: BusinessProfile }
  | { ok: false; error: string };

function optionalText(value: FormDataEntryValue | null, max: number, tooLong: string): { ok: true; text: string | null } | { ok: false; error: string } {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (trimmed.length > max) return { ok: false, error: tooLong };
  return { ok: true, text: trimmed.length > 0 ? trimmed : null };
}

export function parseBusinessProfile(formData: FormData): BusinessProfileResult {
  const name = formData.get("businessName");
  const currency = formData.get("currency");
  if (typeof name !== "string" || name.trim().length === 0) return { ok: false, error: "business.nameRequired" };
  const businessName = name.trim();
  if (businessName.length > MAX_NAME_CHARS) return { ok: false, error: "business.nameTooLong" };

  const normalized = typeof currency === "string" ? currency.trim().toLowerCase() : "";
  if (!BUSINESS_CURRENCIES.includes(normalized as BusinessCurrency)) {
    return { ok: false, error: "business.invalidCurrency" };
  }

  const taxId = optionalText(formData.get("taxId"), MAX_TAX_ID_CHARS, "business.taxIdTooLong");
  if (!taxId.ok) return taxId;
  const paymentInstructions = optionalText(formData.get("paymentInstructions"), MAX_INSTRUCTIONS_CHARS, "business.instructionsTooLong");
  if (!paymentInstructions.ok) return paymentInstructions;

  return {
    ok: true,
    profile: {
      businessName,
      currency: normalized as BusinessCurrency,
      taxId: taxId.text,
      paymentInstructions: paymentInstructions.text,
    },
  };
}
