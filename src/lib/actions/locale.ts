"use server";

import { cookies } from "next/headers";
import { localeCookie, type Locale } from "@/lib/locale";

export async function setLocaleAction(locale: Locale): Promise<void> {
  const store = await cookies();
  store.set(localeCookie(locale, { secure: process.env.NODE_ENV === "production" }));
}
