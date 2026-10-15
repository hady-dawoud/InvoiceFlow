export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export function trustedOrigins(appUrl: string | undefined) {
  const origin = appUrl?.trim().replace(/\/$/, "");
  return origin ? [origin] : undefined;
}

/** Production-only by better-auth default. Memory storage is per server instance. */
export const authRateLimit = {
  window: 60,
  max: 30,
  customRules: {
    "/sign-in/email": { window: 60, max: 5 },
    "/sign-up/email": { window: 60, max: 3 },
    "/request-password-reset": { window: 60, max: 3 },
    "/reset-password": { window: 60, max: 5 },
  },
};
