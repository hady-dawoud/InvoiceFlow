"use client";

import type { Dispatch, SetStateAction } from "react";

export type EditorItem = { description: string; quantity: string; price: string };
export const EMPTY_ITEM: EditorItem = { description: "", quantity: "1", price: "" };

export function InvoiceItemsEditor({ items, setItems }: {
  items: EditorItem[]; setItems: Dispatch<SetStateAction<EditorItem[]>>;
}) {
  function setItem(index: number, patch: Partial<EditorItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  return (
<div className="rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="w-20 px-3 py-2 font-medium">Qty</th>
              <th className="w-32 px-3 py-2 font-medium">Price</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item, index) => (
              <tr key={index}>
                <td className="px-3 py-2">
                  <input
                    aria-label={`Description, line ${index + 1}`}
                    value={item.description}
                    onChange={(e) => setItem(index, { description: e.target.value })}
                    placeholder="Design work, consulting…"
                    className="w-full rounded-md border border-slate-200 px-2 py-1.5 focus:border-emerald-500 focus:outline-none"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step={1}
                    aria-label={`Quantity, line ${index + 1}`}
                    min={1}
                    value={item.quantity}
                    onChange={(e) => setItem(index, { quantity: e.target.value })}
                    className="w-full rounded-md border border-slate-200 px-2 py-1.5 focus:border-emerald-500 focus:outline-none"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    aria-label={`Price, line ${index + 1}`}
                    value={item.price}
                    onChange={(e) => setItem(index, { price: e.target.value })}
                    placeholder="0.00"
                    inputMode="decimal"
                    className="w-full rounded-md border border-slate-200 px-2 py-1.5 focus:border-emerald-500 focus:outline-none"
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
                    className="text-slate-400 hover:text-red-600"
                    aria-label="Remove line"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-slate-100 px-3 py-2">
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, EMPTY_ITEM])}
            className="text-sm font-medium text-emerald-600 hover:underline"
          >
            + Add line item
          </button>
        </div>
      </div>
  );
}
