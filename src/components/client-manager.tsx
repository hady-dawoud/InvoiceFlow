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
        <h1 className="text-xl font-bold text-slate-900">Clients</h1>
        {!form && (
          <button
            disabled={pending}
            onClick={openCreate}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
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
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-600">
          No clients yet. Add your first client to start invoicing.
        </div>
      ) : (
        clients.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Invoices</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {client.name}
                      {client.address && (
                        <p className="text-xs font-normal text-slate-400">{client.address}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{client.email ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{client.invoiceCount}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        disabled={pending}
                        onClick={() => openEdit(client)}
                        className="rounded px-2 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100"
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
          </div>
        )
      )}
    </div>
  );
}

