import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, invoices, type Client } from "@/db/schema";

export type ClientWithStats = Client & { invoiceCount: number };

export async function listClientsWithStats(userId: string): Promise<ClientWithStats[]> {
  const rows = await db
    .select()
    .from(clients)
    .where(eq(clients.userId, userId))
    .orderBy(clients.name);

  const counts = await db
    .select({
      clientId: invoices.clientId,
      n: sql<number>`count(*)`.mapWith(Number),
    })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .where(eq(clients.userId, userId))
    .groupBy(invoices.clientId);

  const countById = new Map(counts.map((c) => [c.clientId, c.n]));
  return rows.map((client) => ({ ...client, invoiceCount: countById.get(client.id) ?? 0 }));
}

export async function listClientOptions(userId: string): Promise<Pick<Client, "id" | "name">[]> {
  return db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(eq(clients.userId, userId))
    .orderBy(clients.name);
}

export type ClientInput = {
  name: string;
  email: string | null;
  address: string | null;
};

export async function createClient(userId: string, input: ClientInput): Promise<Client> {
  const [client] = await db
    .insert(clients)
    .values({ id: randomUUID(), userId, ...input })
    .returning();
  return client!;
}

export async function updateClient(
  userId: string,
  clientId: string,
  input: ClientInput,
): Promise<boolean> {
  const result = await db
    .update(clients)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(clients.id, clientId), eq(clients.userId, userId)));
  return result.rowsAffected > 0;
}

export async function deleteClient(userId: string, clientId: string): Promise<
  "ok" | "not-found" | "has-invoices"
> {
  const [inUse] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(invoices)
    .where(eq(invoices.clientId, clientId));
  if ((inUse?.n ?? 0) > 0) return "has-invoices";

  const result = await db
    .delete(clients)
    .where(and(eq(clients.id, clientId), eq(clients.userId, userId)));
  return result.rowsAffected > 0 ? "ok" : "not-found";
}
