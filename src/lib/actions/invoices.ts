"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients as clientsTable } from "@/db/schema";
import { getQuotaState } from "@/lib/quota";
import {
  countInvoicesThisMonth,
  createInvoice,
  deleteInvoice,
  setInvoiceStatus,
  updateInvoice,
  type InvoiceInput,
} from "@/lib/data/invoices";
import type { InvoiceStatus } from "@/lib/invoice";
import { parseAmountToCents } from "@/lib/money";
import { getSession } from "@/lib/session";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

type ParsedItems = { description: string; quantity: number; unitPriceCents: number }[];

function parseItems(raw: unknown): ParsedItems | null {
  if (typeof raw !== "string") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;

  const items: ParsedItems = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) return null;
    const { description, quantity, price } = entry as Record<string, unknown>;
    if (typeof description !== "string" || description.trim().length === 0) return null;
    // The editor keeps input values as strings; accept both representations.
    const qty =
      typeof quantity === "number"
        ? quantity
        : typeof quantity === "string"
          ? Number.parseInt(quantity, 10)
          : Number.NaN;
    if (!Number.isInteger(qty) || qty < 1) return null;
    const unitPriceCents = typeof price === "string" ? parseAmountToCents(price) : null;
    if (unitPriceCents === null) return null;
    items.push({ description: description.trim(), quantity: qty, unitPriceCents });
  }
  return items;
}

function parseInput(formData: FormData): InvoiceInput | string {
  const clientId = formData.get("clientId");
  const issueDate = formData.get("issueDate");
  const dueDate = formData.get("dueDate");
  const taxRate = formData.get("taxRate");
  const notes = formData.get("notes");
  const status = formData.get("status");

  if (typeof clientId !== "string" || clientId.length === 0) return "Choose a client.";
  if (typeof issueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) return "Invalid issue date.";
  if (typeof dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return "Invalid due date.";

  let taxBps = 0;
  if (typeof taxRate === "string" && taxRate.trim().length > 0) {
    const rate = Number(taxRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 50) return "Tax rate must be between 0 and 50.";
    taxBps = Math.round(rate * 100);
  }

  if (status !== "draft" && status !== "sent" && status !== "paid") {
    return "Invalid status.";
  }
  const items = parseItems(formData.get("itemsJson"));
  if (!items) return "Add at least one line item with a valid price.";

  return {
    clientId,
    status,
    issueDate,
    dueDate,
    taxBps,
    notes: typeof notes === "string" && notes.trim().length > 0 ? notes.trim() : null,
    items,
  };
}

export async function createInvoiceAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  const userId = session.user.id;

  const input = parseInput(formData);
  if (typeof input === "string") return { ok: false, error: input };

  const [ownedClient] = await db
    .select({ id: clientsTable.id })
    .from(clientsTable)
    .where(and(eq(clientsTable.id, input.clientId), eq(clientsTable.userId, userId)))
    .limit(1);
  if (!ownedClient) return { ok: false, error: "Unknown client." };

  const used = await countInvoicesThisMonth(userId);
  const quota = getQuotaState(session.user.isPro, used);
  if (quota.blocked) return { ok: false, error: "quota" };

  const { id } = await createInvoice(userId, input);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/invoices");
  return { ok: true, id };
}

export async function updateInvoiceAction(
  invoiceId: string,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  const input = parseInput(formData);
  if (typeof input === "string") return { ok: false, error: input };

  const updated = await updateInvoice(session.user.id, invoiceId, input);
  if (!updated) return { ok: false, error: "Invoice not found." };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  return { ok: true, id: invoiceId };
}

export async function setInvoiceStatusAction(
  invoiceId: string,
  status: InvoiceStatus,
): Promise<ActionResult> {
  // Server actions are reachable over HTTP: re-validate the runtime value.
  if (status !== "draft" && status !== "sent" && status !== "paid") {
    return { ok: false, error: "Invalid status." };
  }
  const session = await getSession();
  const updated = await setInvoiceStatus(session.user.id, invoiceId, status);
  if (!updated) return { ok: false, error: "Invoice not found." };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  return { ok: true };
}

export async function deleteInvoiceAction(invoiceId: string): Promise<ActionResult> {
  const session = await getSession();
  const deleted = await deleteInvoice(session.user.id, invoiceId);
  if (!deleted) return { ok: false, error: "Invoice not found." };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/invoices");
  return { ok: true };
}
