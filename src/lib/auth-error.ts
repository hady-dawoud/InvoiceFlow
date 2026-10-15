/**
 * Codes Better Auth returns for this app's email sign-in, given email and
 * password enabled and email verification off. Origin failures come from the
 * router middleware on every POST. A response with no code (rate limit) is
 * unmapped.
 */
export const LOGIN_AUTH_ERROR_CODES = [
  "INVALID_EMAIL",
  "INVALID_EMAIL_OR_PASSWORD",
  "FAILED_TO_CREATE_SESSION",
  "INVALID_ORIGIN",
  "MISSING_OR_NULL_ORIGIN",
] as const;

/**
 * Codes the email sign-up route returns for this app. Invalid bodies fail
 * schema validation (`VALIDATION_ERROR`) before the handler's email check.
 * Duplicate emails use `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` because
 * verification is off and auto sign-in stays on.
 */
export const SIGN_UP_AUTH_ERROR_CODES = [
  "VALIDATION_ERROR",
  "PASSWORD_TOO_SHORT",
  "PASSWORD_TOO_LONG",
  "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
  "FAILED_TO_CREATE_USER",
  "FAILED_TO_CREATE_SESSION",
  "INVALID_ORIGIN",
  "MISSING_OR_NULL_ORIGIN",
] as const;

/** Sign-out itself does not throw; origin middleware can still reject the POST. */
export const SIGN_OUT_AUTH_ERROR_CODES = ["INVALID_ORIGIN", "MISSING_OR_NULL_ORIGIN"] as const;

export const RESET_AUTH_ERROR_CODES = ["INVALID_TOKEN", "PASSWORD_TOO_SHORT", "PASSWORD_TOO_LONG"] as const;

type AuthTranslator = {
  has: (key: string) => boolean;
  (key: string): string;
};

function messageForCode(
  t: AuthTranslator,
  error: { code?: unknown; message?: unknown },
  codes: readonly string[],
): string {
  const code = typeof error.code === "string" ? error.code : "";
  const key = `errors.${code}`;
  if (code && codes.includes(code) && t.has(key)) return t(key);
  return t("genericError");
}

export function loginFailureMessage(
  t: AuthTranslator,
  error: { code?: unknown; message?: unknown },
): string {
  return messageForCode(t, error, LOGIN_AUTH_ERROR_CODES);
}

export function signUpFailureMessage(
  t: AuthTranslator,
  error: { code?: unknown; message?: unknown },
): string {
  return messageForCode(t, error, SIGN_UP_AUTH_ERROR_CODES);
}

export function signOutFailureMessage(
  t: AuthTranslator,
  error: { code?: unknown; message?: unknown },
): string {
  return messageForCode(t, error, SIGN_OUT_AUTH_ERROR_CODES);
}

export function resetFailureMessage(
  t: AuthTranslator,
  error: { code?: unknown; message?: unknown },
): string {
  return messageForCode(t, error, RESET_AUTH_ERROR_CODES);
}
