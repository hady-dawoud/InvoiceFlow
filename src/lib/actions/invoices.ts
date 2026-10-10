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

// `InvoiceWriteError` messages are either the "quota" sentinel (handled by
// the client as a special case, never shown as text) or a defensive-write
// failure that still needs a catalog key before it can reach the UI.
const WRITE_ERROR_KEYS: Record<string, string> = {
  "Unknown client.": "invoice.unknownClient",
  "Account not found.": "invoice.accountNotFound",
  "Invoice sequence is too large.": "invoice.sequenceTooLarge",
};

function writeErrorResult(error: Error): ActionResult {
  if (error.message === "quota") return { ok: false, error: "quota" };
  return { ok: false, error: WRITE_ERROR_KEYS[error.message] ?? error.message };
}

function mappedWriteError(error: unknown): ActionResult | null {
  if (error instanceof InvoiceWriteError) return writeErrorResult(error);
  if (error instanceof RangeError && error.message in WRITE_ERROR_KEYS) {
    return writeErrorResult(error);
  }
  return null;
}

export async function createInvoiceAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  const userId = session.user.id;

  const input = parseInvoiceInput(formData);
  if (typeof input === "string") return { ok: false, error: input };

  let id: string;
  try { ({ id } = await createInvoice(userId, input)); }
  catch (error) {
    const mapped = mappedWriteError(error);
    if (!mapped) throw error;
    return mapped;
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
    const mapped = mappedWriteError(error);
    if (!mapped) throw error;
    return mapped;
  }
  if (!updated) return { ok: false, error: "invoice.notFound" };

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
    return { ok: false, error: "invoice.invalidStatus" };
  }
  const session = await getSession();
  const updated = await setInvoiceStatus(session.user.id, invoiceId, status);
  if (!updated) return { ok: false, error: "invoice.notFound" };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  return { ok: true, id: invoiceId };
}

export async function deleteInvoiceAction(invoiceId: string): Promise<ActionResult> {
  const session = await getSession();
  const deleted = await deleteInvoice(session.user.id, invoiceId);
  if (!deleted) return { ok: false, error: "invoice.notFound" };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/invoices");
  return { ok: true, id: invoiceId };
}
