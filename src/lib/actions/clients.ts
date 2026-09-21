"use server";

import { revalidatePath } from "next/cache";
import {
  createClient,
  deleteClient,
  updateClient,
} from "@/lib/data/clients";
import { getSession } from "@/lib/session";

export type ClientActionResult =
  | { ok: true }
  | { ok: false; error: string };

function parseClientInput(formData: FormData): ClientInputResult {
  const name = formData.get("name");
  const email = formData.get("email");
  const address = formData.get("address");

  if (typeof name !== "string" || name.trim().length === 0) {
    return { ok: false, error: "Client name is required." };
  }
  const emailTrimmed = typeof email === "string" ? email.trim() : "";
  if (emailTrimmed.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
    return { ok: false, error: "Invalid email address." };
  }
  return {
    ok: true,
    input: {
      name: name.trim(),
      email: emailTrimmed.length > 0 ? emailTrimmed : null,
      address: typeof address === "string" && address.trim().length > 0 ? address.trim() : null,
    },
  };
}

type ClientInputResult =
  | { ok: true; input: { name: string; email: string | null; address: string | null } }
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
  if (!updated) return { ok: false, error: "Client not found." };

  revalidatePath("/dashboard/clients");
  return { ok: true };
}

export async function deleteClientAction(clientId: string): Promise<ClientActionResult> {
  const session = await getSession();
  const result = await deleteClient(session.user.id, clientId);
  if (result === "has-invoices") {
    return { ok: false, error: "This client has invoices — delete those first." };
  }
  if (result === "not-found") {
    return { ok: false, error: "Client not found." };
  }
  revalidatePath("/dashboard/clients");
  return { ok: true };
}
