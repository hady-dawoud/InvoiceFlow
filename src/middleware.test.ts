import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "./middleware";

describe("dashboard gate", () => {
  it("sends anonymous visitors to login and keeps the dashboard path", () => {
    const response = middleware(new NextRequest("http://localhost:3000/dashboard/invoices?status=sent"));
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.origin).toBe("http://localhost:3000");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/dashboard/invoices?status=sent");
  });
});
