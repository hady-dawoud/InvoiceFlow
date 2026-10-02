import { expect, it } from "vitest";
import { invoiceOverview } from "@/lib/invoice-overview";
import { formatCents } from "@/lib/money";

it.each([
  ["paid", "9999-12-31", "paid"],
  ["sent", "9999-12-31", "outstanding"],
  ["sent", "2000-01-01", "overdue"],
] as const)("dashboard sums %s invoices due %s without losing cents", (status, dueDate, category) => {
  const overview = invoiceOverview([
    { status, dueDate, totalCents: Number.MAX_SAFE_INTEGER },
    { status, dueDate, totalCents: 2 },
    { status: "draft", dueDate, totalCents: 100 },
  ]);
  expect(formatCents(overview.billed, "usd")).toBe("$90,071,992,547,409.93");
  expect(formatCents(overview[category], "usd")).toBe("$90,071,992,547,409.93");
  for (const other of ["paid", "outstanding", "overdue"] as const) {
    if (other !== category) expect(formatCents(overview[other], "usd")).toBe("$0.00");
  }
});
