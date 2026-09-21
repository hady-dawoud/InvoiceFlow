import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  appName: "InvoiceFlow",
  baseURL: process.env.APP_URL ?? "http://localhost:3000",
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
