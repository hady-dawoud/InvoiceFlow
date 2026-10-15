import { describe, expect, it } from "vitest";
import { safeDashboardNext } from "./return-path";

describe("safeDashboardNext", () => {
  it("keeps a dashboard path and its query", () => {
    expect(safeDashboardNext("/dashboard/invoices?status=sent")).toBe("/dashboard/invoices?status=sent");
  });

  it.each([
    null,
    "",
    "/login",
    "//evil.example/dashboard",
    "https://evil.example/dashboard",
    "/dashboard/../login",
    "/dashboard-evil",
    "/\\evil.example",
    "/%2e%2e/login",
  ])("falls back to the dashboard for %s", (candidate) => {
    expect(safeDashboardNext(candidate)).toBe("/dashboard");
  });
});
