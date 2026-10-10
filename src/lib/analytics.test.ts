import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

await vi.hoisted(async () => {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const directory = mkdtempSync(join(tmpdir(), "invoiceflow-analytics-"));
  process.env.DATABASE_URL = `file:${join(directory, "test.db").replaceAll("\\", "/")}`;
});

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { productEvents, user } from "@/db/schema";
import { createTestSchema, seedOwners } from "@/test/database";
import { createInvoice } from "@/lib/data/invoices";
import { applyStripeAction } from "@/lib/data/billing";
import { countProductEvents, recordProductEvent, recordSignup } from "./analytics";

const invoice = {
  clientId: "owner-client", status: "draft" as const, issueDate: "2026-10-01", dueDate: "2026-10-31",
  taxBps: 0, notes: null, items: [{ description: "Work", quantity: 1, unitPriceCents: 100 }],
};

beforeAll(createTestSchema);
beforeEach(async () => {
  await db.delete(productEvents);
  await db.delete(user);
  await seedOwners();
});
afterAll(() => db.$client.close());

describe("product events", () => {
  it("counts each named event", async () => {
    await recordSignup("owner");
    await recordProductEvent("invoice_created", "owner");
    expect(await countProductEvents()).toEqual({
      signup: 1,
      invoice_created: 1,
      upgrade_wall: 0,
      pro_conversion: 0,
    });
  });

  it("records a created invoice and a quota wall without changing the write result", async () => {
    await createInvoice("owner", invoice);
    await createInvoice("owner", invoice);
    await createInvoice("owner", invoice);
    await expect(createInvoice("owner", invoice)).rejects.toThrow("quota");
    expect(await countProductEvents()).toMatchObject({ invoice_created: 3, upgrade_wall: 1 });
  });

  it("records Pro only when access is newly granted", async () => {
    await db.update(user).set({ isPro: false, stripeCustomerId: "cus_1" }).where(eq(user.id, "owner"));
    await applyStripeAction({ type: "grant_pro", userId: "owner", subscriptionId: "sub_1", customerId: "cus_1" });
    await applyStripeAction({ type: "grant_pro", userId: "owner", subscriptionId: "sub_1", customerId: "cus_1" });
    expect(await countProductEvents()).toMatchObject({ pro_conversion: 1 });
  });
});
