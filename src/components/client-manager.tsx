"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useRequest } from "@/lib/use-request";
import {
  createClientAction,
  deleteClientAction,
  updateClientAction,
} from "@/lib/actions/clients";
import { ClientForm, type FormState } from "./client-form";
import type { ClientWithStats } from "@/lib/data/clients";

const EMPTY: FormState = { id: null, name: "", email: "", address: "" };

export function ClientManager({ clients }: { clients: ClientWithStats[] }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const { run, pending, error, setError } = useRequest();

  function openCreate() {
    setError(null);
    setForm({ ...EMPTY });
  }

  function openEdit(client: ClientWithStats) {
    setError(null);
    setForm({
      id: client.id,
      name: client.name,
      email: client.email ?? "",
      address: client.address ?? "",
    });
  }

  function save() {
    if (!form) return;
    setError(null);
    const formData = new FormData();
    formData.set("name", form.name);
    formData.set("email", form.email);
    formData.set("address", form.address);
    void run(async () => {
      const result = form.id
        ? await updateClientAction(form.id, formData)
        : await createClientAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setForm(null);
      router.refresh();
    });
  }

  function remove(client: ClientWithStats) {
    if (!window.confirm(`Delete client "${client.name}"?`)) return;
    setError(null);
    void run(async () => {
      const result = await deleteClientAction(client.id);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink">Clients</h1>
        {!form && (
          <button
            disabled={pending}
            onClick={openCreate}
            className="btn"
          >
            New client
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {form && (
        <ClientForm form={form} setForm={setForm} pending={pending} save={save} cancel={() => setForm(null)} />
      )}

      {clients.length === 0 && !form ? (
        <div className="rounded-xl border border-dashed border-line bg-white px-6 py-12 text-center text-quiet">
          No clients yet. Add your first client to start invoicing.
        </div>
      ) : (
        clients.length > 0 && (
          <table className="ledger text-sm">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Invoices</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper">
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-sheet">
                    <td className="px-4 py-2.5 font-medium text-ink">
                      {client.name}
                      {client.address && (
                        <p className="text-xs font-normal text-quiet">{client.address}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-quiet">{client.email ?? "—"}</td>
                    <td className="px-4 py-2.5 text-quiet">{client.invoiceCount}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        disabled={pending}
                        onClick={() => openEdit(client)}
                        className="rounded px-2 py-1 text-sm font-medium text-quiet hover:bg-ink/8"
                      >
                        Edit
                      </button>
                      <button
                        disabled={pending}
                        onClick={() => remove(client)}
                        className="rounded px-2 py-1 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        )
      )}
    </div>
  );
}

