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
<div className="bg-sheet shadow-[0.45rem_0.55rem_0_rgb(26_35_48/10%)]">
        <table className="w-full text-sm">
          <thead className="text-left text-sm text-quiet">
            <tr>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="w-20 px-3 py-2 font-medium">Qty</th>
              <th className="w-32 px-3 py-2 font-medium">Price</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-paper">
            {items.map((item, index) => (
              <tr key={index}>
                <td className="px-3 py-2">
                  <input
                    aria-label={`Description, line ${index + 1}`}
                    value={item.description}
                    onChange={(e) => setItem(index, { description: e.target.value })}
                    placeholder="Design work, consulting…"
                    className="field"
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
                    className="field"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    aria-label={`Price, line ${index + 1}`}
                    value={item.price}
                    onChange={(e) => setItem(index, { price: e.target.value })}
                    placeholder="0.00"
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
                    aria-label="Remove line"
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
            + Add line item
          </button>
        </div>
      </div>
  );
}
