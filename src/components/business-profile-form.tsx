"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { updateBusinessProfileAction } from "@/lib/actions/business-profile";
import { useRequest } from "@/lib/use-request";

export function BusinessProfileForm({
  currencies,
  initial,
}: {
  currencies: string[];
  initial: { businessName: string; currency: string; taxId: string; paymentInstructions: string };
}) {
  const t = useTranslations("dashboard.settings");
  const tError = useTranslations();
  const router = useRouter();
  const { run, pending, error, setError } = useRequest();
  const [saved, setSaved] = useState(false);
  const options = currencies.includes(initial.currency) ? currencies : [initial.currency, ...currencies];

  function save(formData: FormData) {
    setSaved(false);
    setError(null);
    void run(async () => {
      const result = await updateBusinessProfileAction(formData);
      if (!result.ok) {
        setError(tError(result.error));
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form action={save} className="space-y-4">
      <div>
        <label htmlFor="businessName" className="block text-sm font-medium">{t("businessNameLabel")}</label>
        <input id="businessName" name="businessName" required defaultValue={initial.businessName} className="field mt-1" />
      </div>
      <div>
        <label htmlFor="currency" className="block text-sm font-medium">{t("currencyLabel")}</label>
        <select id="currency" name="currency" defaultValue={initial.currency} className="field mt-1">
          {options.map((currency) => (
            <option key={currency} value={currency}>{currency.toUpperCase()}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="taxId" className="block text-sm font-medium">{t("taxIdLabel")}</label>
        <input id="taxId" name="taxId" defaultValue={initial.taxId} placeholder={t("taxIdPlaceholder")} className="field mt-1" />
      </div>
      <div>
        <label htmlFor="paymentInstructions" className="block text-sm font-medium">{t("paymentInstructionsLabel")}</label>
        <textarea
          id="paymentInstructions"
          name="paymentInstructions"
          defaultValue={initial.paymentInstructions}
          placeholder={t("paymentInstructionsPlaceholder")}
          rows={4}
          className="field mt-1"
        />
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {saved && !error && <p className="text-sm text-quiet">{t("saved")}</p>}
      <button type="submit" disabled={pending} className="btn disabled:opacity-60">
        {pending ? t("saving") : t("save")}
      </button>
    </form>
  );
}
