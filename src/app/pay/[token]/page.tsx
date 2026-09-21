import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, invoices, user } from "@/db/schema";
import { InvoiceDocument } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";

export const metadata = {
  title: "Your invoice",
  robots: { index: false },
};

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const [row] = await db
    .select({
      invoice: invoices,
      client: clients,
      ownerName: user.name,
      ownerBusiness: user.businessName,
      ownerEmail: user.email,
      currency: user.currency,
    })
    .from(invoices)
    .innerJoin(clients, eq(invoices.clientId, clients.id))
    .innerJoin(user, eq(invoices.userId, user.id))
    .where(eq(invoices.token, token))
    .limit(1);

  if (!row) notFound();

  const items = await db.query.invoiceItems.findMany({
    where: (items, { eq }) => eq(items.invoiceId, row.invoice.id),
    orderBy: (items, { asc }) => [asc(items.position)],
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
          Invoice<span className="text-emerald-600">Flow</span>
        </Link>
        <PrintButton />
      </div>

      <InvoiceDocument
        invoice={row.invoice}
        client={row.client}
        items={items}
        businessName={row.ownerBusiness ?? row.ownerName}
        businessEmail={row.ownerEmail}
        currency={row.currency}
      />

      <p className="mt-6 text-center text-xs text-slate-400 print:hidden">
        This invoice was created with{" "}
        <Link href="/" className="underline">
          InvoiceFlow
        </Link>{" "}
        — professional invoices for freelancers.
      </p>
    </main>
  );
}
