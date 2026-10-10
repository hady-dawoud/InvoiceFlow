import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { recordSignup } from "@/lib/analytics";

export const auth = betterAuth({
  appName: "InvoiceFlow",
  // Only pin the base URL when explicitly configured (production). Letting
  // better-auth infer it per-request keeps origins trusted on any port.
  baseURL: process.env.APP_URL || undefined,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: { enabled: true },
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
      isPro: { type: "boolean", defaultValue: false, input: false },
      stripeCustomerId: { type: "string", required: false, input: false },
      stripeSubscriptionId: { type: "string", required: false, input: false },
      proSince: { type: "date", required: false, input: false },
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
