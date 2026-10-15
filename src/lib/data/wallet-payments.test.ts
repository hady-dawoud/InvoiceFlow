import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

await vi.hoisted(async () => {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const directory = mkdtempSync(join(tmpdir(), "invoiceflow-wallet-"));
  process.env.DATABASE_URL = `file:${join(directory, "test.db").replaceAll("\\", "/")}`;
});

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { productEvents, user, walletPayment } from "@/db/schema";
import { createTestSchema } from "@/test/database";
import { countProductEvents } from "@/lib/analytics";
import { activateWalletPayment, recordWalletPayment } from "./wallet-payments";

const now = new Date("2026-10-15T12:00:00.000Z");
const payment = {
  userId: "owner",
  method: "instapay" as const,
  planId: "6",
  months: 6,
  amountEgp: 2500,
  confirmation: "InstaPay reference 44556677",
};

beforeAll(createTestSchema);
beforeEach(async () => {
  await db.delete(walletPayment);
  await db.delete(productEvents);
  await db.delete(user);
  await db.insert(user).values({
    id: "owner", name: "Owner", email: "owner@example.com",
    createdAt: now, updatedAt: now, isPro: false,
  });
});
afterAll(() => db.$client.close());

async function owner() {
  return (await db.select().from(user))[0];
}

it("keeps one pending confirmation and replaces it when the account submits again", async () => {
  const first = await recordWalletPayment(payment);
  const second = await recordWalletPayment({
    ...payment,
    method: "orange_cash",
    planId: "1",
    months: 1,
    amountEgp: 500,
    confirmation: "Orange Cash 99887766",
  });
  expect(second.id).toBe(first.id);
  const rows = await db.select().from(walletPayment);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    status: "pending",
    method: "orange_cash",
    amountEgp: 500,
    confirmation: "Orange Cash 99887766",
  });
});

it("grants Pro until the term ends and ignores a second activation", async () => {
  const { id } = await recordWalletPayment(payment);
  expect(await activateWalletPayment(id, now)).toEqual({
    proUntil: new Date("2027-04-15T12:00:00.000Z"),
  });
  const account = await owner();
  expect(account.isPro).toBe(true);
  expect(account.proUntil?.toISOString()).toBe("2027-04-15T12:00:00.000Z");
  expect(account.proSince).toBeInstanceOf(Date);
  expect(await countProductEvents()).toMatchObject({ pro_conversion: 1 });

  expect(await activateWalletPayment(id, new Date("2026-11-01T00:00:00.000Z"))).toEqual({
    proUntil: new Date("2027-04-15T12:00:00.000Z"),
  });
  expect((await owner()).proUntil?.toISOString()).toBe("2027-04-15T12:00:00.000Z");
  expect((await db.select().from(walletPayment))[0].status).toBe("activated");
  expect(await countProductEvents()).toMatchObject({ pro_conversion: 1 });
});

it("adds a new term onto time that has not run out", async () => {
  await db.update(user).set({
    isPro: true,
    proUntil: new Date("2026-12-01T00:00:00.000Z"),
    proSince: new Date("2026-01-01T00:00:00.000Z"),
  }).where(eq(user.id, "owner"));
  const { id } = await recordWalletPayment({ ...payment, months: 1, amountEgp: 500, planId: "1" });
  const activated = await activateWalletPayment(id, now);
  expect(activated?.proUntil?.toISOString()).toBe("2027-01-01T00:00:00.000Z");
});

it("does not put an end date on open-ended Pro", async () => {
  await db.update(user).set({
    isPro: true,
    proSince: new Date("2026-01-01T00:00:00.000Z"),
  }).where(eq(user.id, "owner"));
  const { id } = await recordWalletPayment(payment);
  expect(await activateWalletPayment(id, now)).toEqual({ proUntil: null });
  expect(await owner()).toMatchObject({ isPro: true, proUntil: null });
});

it("does nothing when the request id is unknown", async () => {
  expect(await activateWalletPayment("missing", now)).toBeNull();
  expect((await owner()).isPro).toBe(false);
});
