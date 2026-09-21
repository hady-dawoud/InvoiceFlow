import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  allowedTransitions,
  isOverdue,
  maxInvoiceSequence,
  nextInvoiceNumber,
} from "@/lib/invoice";

describe("nextInvoiceNumber", () => {
  it("zero-pads the sequence", () => {
    expect(nextInvoiceNumber(2026, 1)).toBe("INV-2026-0001");
    expect(nextInvoiceNumber(2026, 42)).toBe("INV-2026-0042");
    expect(nextInvoiceNumber(2026, 12345)).toBe("INV-2026-12345");
  });
});

describe("maxInvoiceSequence", () => {
  it("finds the max suffix for the given year", () => {
    const numbers = ["INV-2025-0009", "INV-2026-0003", "INV-2026-0017", "INV-2026-0010"];
    expect(maxInvoiceSequence(numbers, 2026)).toBe(17);
    expect(maxInvoiceSequence(numbers, 2025)).toBe(9);
  });

  it("returns 0 when there are none for the year", () => {
    expect(maxInvoiceSequence(["INV-2025-0001"], 2026)).toBe(0);
    expect(maxInvoiceSequence([], 2026)).toBe(0);
  });

  it("ignores malformed numbers", () => {
    expect(maxInvoiceSequence(["INV-2026-XXXX", "INV-2026-0007"], 2026)).toBe(7);
  });
});

describe("isOverdue", () => {
  const cases = [
    { status: "sent" as const, dueDate: "2026-01-01", expected: true },
    { status: "sent" as const, dueDate: "2099-01-01", expected: false },
    { status: "paid" as const, dueDate: "2026-01-01", expected: false },
    { status: "draft" as const, dueDate: "2026-01-01", expected: false },
  ];
  for (const { status, dueDate, expected } of cases) {
    it(`${status} due ${dueDate} → ${expected}`, () => {
      expect(isOverdue({ status, dueDate }, "2026-09-21")).toBe(expected);
    });
  }
});

describe("allowedTransitions", () => {
  it("moves draft → sent, sent → paid/draft, paid → sent", () => {
    expect(allowedTransitions("draft")).toEqual(["sent"]);
    expect(allowedTransitions("sent")).toEqual(["paid", "draft"]);
    expect(allowedTransitions("paid")).toEqual(["sent"]);
  });
});

describe("addDaysIso", () => {
  it("adds days across month boundaries", () => {
    expect(addDaysIso("2026-09-21", 14)).toBe("2026-10-05");
    expect(addDaysIso("2026-01-31", 1)).toBe("2026-02-01");
  });
});
