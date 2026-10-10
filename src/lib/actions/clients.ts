"use server";

import { revalidatePath } from "next/cache";
import {
  createClient,
  deleteClient,
  updateClient,
} from "@/lib/data/clients";
import { parseClientInput } from "@/lib/client-validation";
import { getSession } from "@/lib/session";

export type ClientActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function createClientAction(formData: FormData): Promise<ClientActionResult> {
  const session = await getSession();
  const parsed = parseClientInput(formData);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  await createClient(session.user.id, parsed.input);
  revalidatePath("/dashboard/clients");
  return { ok: true };
}

export async function updateClientAction(
  clientId: string,
  formData: FormData,
): Promise<ClientActionResult> {
  const session = await getSession();
  const parsed = parseClientInput(formData);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const updated = await updateClient(session.user.id, clientId, parsed.input);
  if (!updated) return { ok: false, error: "client.notFound" };

  revalidatePath("/dashboard/clients");
  return { ok: true };
}

export async function deleteClientAction(clientId: string): Promise<ClientActionResult> {
  const session = await getSession();
  const result = await deleteClient(session.user.id, clientId);
  if (result === "has-invoices") {
    return { ok: false, error: "client.hasInvoices" };
  }
  if (result === "not-found") {
    return { ok: false, error: "client.notFound" };
  }
  revalidatePath("/dashboard/clients");
  return { ok: true };
}
