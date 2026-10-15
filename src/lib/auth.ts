import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { recordSignup } from "@/lib/analytics";
import { authRateLimit, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, trustedOrigins } from "@/lib/auth-policy";

export const auth = betterAuth({
  appName: "InvoiceFlow",
  // Only pin the base URL when explicitly configured (production). Letting
  // better-auth infer it per-request keeps origins trusted on any port.
  baseURL: process.env.APP_URL || undefined,
  trustedOrigins: trustedOrigins(process.env.APP_URL),
  rateLimit: authRateLimit,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
  },
  databaseHooks: {
    user: {
      create: {
        after: async (created) => {
          await recordSignup(created.id);
        },
      },
    },
  },
  user: {
    additionalFields: {
      // All billing-sensitive fields are server-managed: never client-settable.
      businessName: { type: "string", required: false, input: false },
      currency: { type: "string", defaultValue: "usd", input: false },
      taxId: { type: "string", required: false, input: false },
      paymentInstructions: { type: "string", required: false, input: false },
      isPro: { type: "boolean", defaultValue: false, input: false },
      stripeCustomerId: { type: "string", required: false, input: false },
      stripeSubscriptionId: { type: "string", required: false, input: false },
      proSince: { type: "date", required: false, input: false },
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
