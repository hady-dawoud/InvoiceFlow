"use server";

import { revalidatePath } from "next/cache";
import { updateBusinessProfile } from "@/lib/data/business-profile";
import { parseBusinessProfile } from "@/lib/business-profile";
import { getSession } from "@/lib/session";

export type BusinessProfileActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateBusinessProfileAction(formData: FormData): Promise<BusinessProfileActionResult> {
  const session = await getSession();
  const parsed = parseBusinessProfile(formData);
  if (!parsed.ok) return parsed;
  const updated = await updateBusinessProfile(session.user.id, parsed.profile);
  if (!updated) return { ok: false, error: "business.accountNotFound" };
  revalidatePath("/dashboard");
  revalidatePath("/pay", "layout");
  return { ok: true };
}
