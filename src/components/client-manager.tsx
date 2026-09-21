"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createClientAction,
  deleteClientAction,
  updateClientAction,
} from "@/lib/actions/clients";
import type { ClientWithStats } from "@/lib/data/clients";

type FormState = {
  id: string | null; // null = creating
  name: string;
  email: string;
  address: string;
};

const EMPTY: FormState = { id: null, name: "", email: "", address: "" };

export function ClientManager({ clients }: { clients: ClientWithStats[] }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
    startTransition(async () => {
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
    startTransition(async () => {
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
            onClick={openCreate}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            New client
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {form && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Client name *"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              autoFocus
            />
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Billing email"
              type="email"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Address"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={save}
              disabled={pending || form.name.trim().length === 0}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {pending ? "Saving…" : form.id ? "Save changes" : "Add client"}
            </button>
            <button
              onClick={() => setForm(null)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
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
                        onClick={() => openEdit(client)}
                        className="rounded px-2 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100"
                      >
                        Edit
                      </button>
                      <button
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

