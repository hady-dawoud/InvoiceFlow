"use server";

import { revalidatePath } from "next/cache";
import {
  createInvoice,
  deleteInvoice,
  setInvoiceStatus,
  updateInvoice,
} from "@/lib/data/invoices";
import type { InvoiceStatus } from "@/lib/invoice";
import { parseInvoiceInput } from "@/lib/invoice-validation";
import { InvoiceWriteError } from "@/lib/data/invoice-counters";
import { getSession } from "@/lib/session";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function createInvoiceAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  const userId = session.user.id;

  const input = parseInvoiceInput(formData);
  if (typeof input === "string") return { ok: false, error: input };

  let id: string;
  try { ({ id } = await createInvoice(userId, input)); }
  catch (error) {
    if (!(error instanceof InvoiceWriteError)) throw error;
    return { ok: false, error: error.message };
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/invoices");
  return { ok: true, id };
}

export async function updateInvoiceAction(
  invoiceId: string,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  const input = parseInvoiceInput(formData);
  if (typeof input === "string") return { ok: false, error: input };

  let updated: boolean;
  try { updated = await updateInvoice(session.user.id, invoiceId, input); }
  catch (error) {
    if (!(error instanceof InvoiceWriteError)) throw error;
    return { ok: false, error: error.message };
  }
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
  return { ok: true, id: invoiceId };
}

export async function deleteInvoiceAction(invoiceId: string): Promise<ActionResult> {
  const session = await getSession();
  const deleted = await deleteInvoice(session.user.id, invoiceId);
  if (!deleted) return { ok: false, error: "Invoice not found." };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/invoices");
  return { ok: true, id: invoiceId };
}
