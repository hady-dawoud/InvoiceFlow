"use client";

import type { Dispatch, SetStateAction } from "react";
import { useTranslations } from "next-intl";

export type EditorItem = { description: string; quantity: string; price: string };
export const EMPTY_ITEM: EditorItem = { description: "", quantity: "1", price: "" };

export function InvoiceItemsEditor({ items, setItems }: {
  items: EditorItem[]; setItems: Dispatch<SetStateAction<EditorItem[]>>;
}) {
  const t = useTranslations("invoice.items");
  function setItem(index: number, patch: Partial<EditorItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  return (
<div className="bg-sheet shadow-[0.45rem_0.55rem_0_rgb(26_35_48/10%)]">
        <table className="w-full text-sm">
          <thead className="text-start text-sm text-quiet">
            <tr>
              <th className="px-3 py-2 font-medium">{t("table.description")}</th>
              <th className="w-20 px-3 py-2 font-medium">{t("table.qty")}</th>
              <th className="w-32 px-3 py-2 font-medium">{t("table.price")}</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-paper">
            {items.map((item, index) => (
              <tr key={index}>
                <td className="px-3 py-2">
                  <input
                    aria-label={t("descriptionAria", { line: index + 1 })}
                    value={item.description}
                    onChange={(e) => setItem(index, { description: e.target.value })}
                    placeholder={t("descriptionPlaceholder")}
                    className="field"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step={1}
                    aria-label={t("quantityAria", { line: index + 1 })}
                    min={1}
                    value={item.quantity}
                    onChange={(e) => setItem(index, { quantity: e.target.value })}
                    className="field"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    aria-label={t("priceAria", { line: index + 1 })}
                    value={item.price}
                    onChange={(e) => setItem(index, { price: e.target.value })}
                    placeholder={t("pricePlaceholder")}
                    inputMode="decimal"
                    className="field"
                  />
                </td>
                <td className="px-2 py-2 text-center">
                  <button
                    type="button"
                    onClick={() =>
                      setItems((prev) =>
                        prev.length > 1 ? prev.filter((_, i) => i !== index) : [EMPTY_ITEM],
                      )
                    }
                    className="text-quiet hover:text-red-600"
                    aria-label={t("removeLine")}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-paper px-3 py-2">
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, EMPTY_ITEM])}
            className="text-sm font-medium text-carbon hover:underline"
          >
            {t("addLine")}
          </button>
        </div>
      </div>
  );
}
