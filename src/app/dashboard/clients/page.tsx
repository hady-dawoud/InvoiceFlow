import { ClientManager } from "@/components/client-manager";
import { listClientsWithStats } from "@/lib/data/clients";
import { getSession } from "@/lib/session";

export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  const session = await getSession();
  const clients = await listClientsWithStats(session.user.id);
  return <ClientManager clients={clients} />;
}
