import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { productEvents } from "@/db/schema";

export const PRODUCT_EVENT_NAMES = ["signup", "invoice_created", "upgrade_wall", "pro_conversion"] as const;
export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number];

const EMPTY_COUNTS: Record<ProductEventName, number> = {
  signup: 0,
  invoice_created: 0,
  upgrade_wall: 0,
  pro_conversion: 0,
};

export async function recordProductEvent(name: ProductEventName, userId: string | null) {
  try {
    await db.insert(productEvents).values({ id: randomUUID(), name, userId });
  } catch (error) {
    // A missed count must not undo an invoice or signup that already committed.
    // Revisit if these counts become required for billing decisions.
    console.error(`Could not record ${name}`, error);
  }
}

export function recordSignup(userId: string) {
  return recordProductEvent("signup", userId);
}

export async function countProductEvents(): Promise<Record<ProductEventName, number>> {
  const rows = await db
    .select({ name: productEvents.name, count: sql<number>`count(*)`.mapWith(Number) })
    .from(productEvents)
    .groupBy(productEvents.name);
  const counts = { ...EMPTY_COUNTS };
  for (const row of rows) {
    if (row.name in counts) counts[row.name as ProductEventName] = row.count;
  }
  return counts;
}
