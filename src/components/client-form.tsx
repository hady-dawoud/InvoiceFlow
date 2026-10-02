"use client";

export type FormState = {
  id: string | null; // null = creating
  name: string;
  email: string;
  address: string;
};

export function ClientForm({ form, setForm, pending, save, cancel }: {
  form: FormState; setForm: (form: FormState) => void; pending: boolean; save: () => void; cancel: () => void;
}) {
  return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-3">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              aria-label="Client name"
              placeholder="Client name *"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              autoFocus
            />
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              aria-label="Billing email"
              placeholder="Billing email"
              type="email"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              aria-label="Address"
              placeholder="Address"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </fieldset>
          <div className="mt-3 flex gap-2">
            <button
              onClick={save}
              disabled={pending || form.name.trim().length === 0}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {pending ? "Saving…" : form.id ? "Save changes" : "Add client"}
            </button>
            <button
              disabled={pending}
              onClick={cancel}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
  );
}
