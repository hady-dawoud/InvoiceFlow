import { notFound } from "next/navigation";
import { InvoiceEditor } from "@/components/invoice-editor";
import { listClientOptions } from "@/lib/data/clients";
import { getInvoiceDetail } from "@/lib/data/invoices";
import { getSession } from "@/lib/session";

export const metadata = { title: "Edit invoice" };

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const { id } = await params;
  const [detail, clientOptions] = await Promise.all([
    getInvoiceDetail(session.user.id, id),
    listClientOptions(session.user.id),
  ]);
  if (!detail) notFound();

  const { invoice, items } = detail;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Edit {invoice.number}</h1>
      <InvoiceEditor
        clients={clientOptions}
        currency={session.user.currency}
        invoiceId={invoice.id}
        clientName={detail.client.name}
        initial={{
          clientId: invoice.clientId,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          taxBps: invoice.taxBps,
          notes: invoice.notes ?? "",
          status: invoice.status,
          items: items.map((item) => ({
            description: item.description,
            quantity: String(item.quantity),
            price: (item.unitPriceCents / 100).toFixed(2),
          })),
        }}
      />
    </div>
  );
}
