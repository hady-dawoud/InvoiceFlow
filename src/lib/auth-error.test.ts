import { readFileSync } from "node:fs";
import path from "node:path";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth-policy";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import {
  LOGIN_AUTH_ERROR_CODES,
  RESET_AUTH_ERROR_CODES,
  SIGN_OUT_AUTH_ERROR_CODES,
  SIGN_UP_AUTH_ERROR_CODES,
  loginFailureMessage,
  resetFailureMessage,
  signOutFailureMessage,
  signUpFailureMessage,
} from "./auth-error";

const SERVER_MESSAGE = "Better Auth English message";

const flows = [
  {
    namespace: "auth.login",
    codes: LOGIN_AUTH_ERROR_CODES,
    message: loginFailureMessage,
  },
  {
    namespace: "auth.signup",
    codes: SIGN_UP_AUTH_ERROR_CODES,
    message: signUpFailureMessage,
  },
  {
    namespace: "dashboard.signOut",
    codes: SIGN_OUT_AUTH_ERROR_CODES,
    message: signOutFailureMessage,
  },
  {
    namespace: "auth.reset",
    codes: RESET_AUTH_ERROR_CODES,
    message: resetFailureMessage,
  },
] as const;

function translator(locale: "en" | "ar", namespace: (typeof flows)[number]["namespace"]) {
  const t = createTranslator({
    locale,
    messages: locale === "ar" ? ar : en,
    namespace,
  });
  return Object.assign((key: string) => t(key as never), {
    has: (key: string) => t.has(key as never),
  });
}

describe("auth failure messages", () => {
  it.each(flows)("$namespace uses catalog copy for received codes", ({ namespace, codes, message }) => {
    for (const locale of ["en", "ar"] as const) {
      const t = translator(locale, namespace);
      for (const code of codes) {
        const shown = message(t, { code, message: SERVER_MESSAGE });
        expect(shown).toBe(t(`errors.${code}`));
        expect(shown).not.toBe(SERVER_MESSAGE);
      }
      expect(message(t, { code: "NOT_A_REAL_CODE", message: SERVER_MESSAGE })).toBe(t("genericError"));
      expect(message(t, { message: SERVER_MESSAGE })).toBe(t("genericError"));
    }
  });

  it("states the configured password bounds", () => {
    for (const catalog of [en, ar]) {
      expect(catalog.auth.signup.errors.PASSWORD_TOO_SHORT).toContain(String(PASSWORD_MIN_LENGTH));
      expect(catalog.auth.signup.errors.PASSWORD_TOO_LONG).toContain(String(PASSWORD_MAX_LENGTH));
    }
  });

  it("does not display Better Auth error.message", () => {
    const files = [
      "src/app/(auth)/login/page.tsx",
      "src/app/(auth)/signup/page.tsx",
      "src/components/reset-password-form.tsx",
      "src/components/sign-out-button.tsx",
    ];
    for (const file of files) {
      const src = readFileSync(path.join(process.cwd(), file), "utf8");
      expect(src, file).not.toMatch(/error\.message/);
    }
  });
});
