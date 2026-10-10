"use client";

import { useTranslations } from "next-intl";

export type FormState = {
  id: string | null; // null = creating
  name: string;
  email: string;
  address: string;
};

export function ClientForm({ form, setForm, pending, save, cancel }: {
  form: FormState; setForm: (form: FormState) => void; pending: boolean; save: () => void; cancel: () => void;
}) {
  const t = useTranslations("dashboard.clients.form");
  return (
        <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
          <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-3">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              aria-label={t("nameLabel")}
              placeholder={t("namePlaceholder")}
              className="field"
              autoFocus
            />
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              aria-label={t("emailLabel")}
              placeholder={t("emailPlaceholder")}
              type="email"
              className="field"
            />
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              aria-label={t("addressLabel")}
              placeholder={t("addressPlaceholder")}
              className="field"
            />
          </fieldset>
          <div className="mt-3 flex gap-2">
            <button
              onClick={save}
              disabled={pending || form.name.trim().length === 0}
              className="btn disabled:opacity-60"
            >
              {pending ? t("saving") : form.id ? t("save") : t("add")}
            </button>
            <button
              disabled={pending}
              onClick={cancel}
              className="btn btn-ghost"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
  );
}
