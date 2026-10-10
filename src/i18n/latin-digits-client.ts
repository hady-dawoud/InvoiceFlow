"use client";

import { installLatinDigitsForArabic } from "./latin-digits";

// Runs once, as soon as this client chunk loads in the browser — the
// server-side install in `src/i18n/request.ts` only patches the server's
// Intl implementation, not the one in the user's browser.
installLatinDigitsForArabic();

export function LatinDigitsForArabic() {
  return null;
}
