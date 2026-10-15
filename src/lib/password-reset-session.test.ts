import { afterAll, beforeAll, expect, it, vi } from "vitest";

await vi.hoisted(async () => {
  const { randomBytes } = await import("node:crypto");
  process.env.DATABASE_URL = "file::memory:";
  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString("hex");
  process.env.APP_URL = "http://localhost:3000";
});

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { session, verification } from "@/db/schema";
import { auth } from "@/lib/auth";
import { createTestSchema } from "@/test/database";

beforeAll(createTestSchema);
afterAll(() => db.$client.close());

it("signs out existing sessions when the password changes", async () => {
  const signup = await auth.api.signUpEmail({
    body: { name: "Owner", email: "owner@example.com", password: "testing-password" },
    asResponse: true,
  });
  expect(signup.status).toBe(200);
  const cookie = signup.headers.get("set-cookie")!.split(";")[0];
  const userId = (await db.select().from(session))[0].userId;

  await auth.api.requestPasswordReset({
    body: { email: "owner@example.com", redirectTo: "/reset-password" },
  });
  const [reset] = await db.select().from(verification).where(eq(verification.value, userId));
  const token = reset.identifier.slice("reset-password:".length);
  const resetResponse = await auth.api.resetPassword({
    body: { newPassword: "replacement-password", token },
  });
  expect(resetResponse.status).toBe(true);

  const stillSignedIn = await auth.api.getSession({ headers: new Headers({ cookie }) });
  expect(stillSignedIn).toBeNull();
  const signIn = await auth.api.signInEmail({
    body: { email: "owner@example.com", password: "replacement-password" },
  });
  expect(signIn.user.email).toBe("owner@example.com");
});
