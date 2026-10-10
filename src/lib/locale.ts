type Locale = "en" | "ar";

const languageRangePattern = /^[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*$/;
const qValuePattern = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/;

export function resolveLocale(input: {
  cookie: string | null;
  acceptLanguage: string | null;
}): Locale {
  if (input.cookie === "en" || input.cookie === "ar") {
    return input.cookie;
  }

  let bestLocale: Locale = "en";
  let bestWeight = -1;

  for (const item of input.acceptLanguage?.split(",") ?? []) {
    const parts = item.trim().split(";");
    const range = parts.shift()?.trim();

    if (!range || (range !== "*" && !languageRangePattern.test(range))) {
      continue;
    }

    let weight = 1;
    let hasWeight = false;
    let valid = true;

    for (const parameter of parts) {
      const [name, value, ...extra] = parameter.split("=").map((part) => part.trim());

      if (name?.toLowerCase() !== "q") {
        continue;
      }

      if (hasWeight || extra.length > 0 || !value || !qValuePattern.test(value)) {
        valid = false;
        break;
      }

      weight = Number(value);
      hasWeight = true;
    }

    if (!valid || weight === 0 || range === "*") {
      continue;
    }

    const primarySubtag = range.split("-", 1)[0].toLowerCase();
    const locale = primarySubtag === "en" || primarySubtag === "ar"
      ? primarySubtag
      : null;

    if (locale && weight > bestWeight) {
      bestLocale = locale;
      bestWeight = weight;
    }
  }

  return bestLocale;
}
