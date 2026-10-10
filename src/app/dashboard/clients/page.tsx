import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClientManager } from "@/components/client-manager";
import { listClientsWithStats } from "@/lib/data/clients";
import { getSession } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.clients");
  return { title: t("metaTitle") };
}

export default async function ClientsPage() {
  const session = await getSession();
  const clients = await listClientsWithStats(session.user.id);
  return <ClientManager clients={clients} />;
}
