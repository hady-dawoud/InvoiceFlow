// Exercises an isolated production server and disposable database.
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { startLocalServer } from "./local-server.mjs";
import assert from "node:assert/strict";

const local = await startLocalServer();
const BASE_URL = local.url;
const SHOTS = "gui-test-screenshots";
mkdirSync(SHOTS, { recursive: true });

const results = [];
const consoleErrors = [];
const pageErrors = [];

function record(step, ok, detail = "") {
  results.push({ step, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${step}${detail ? " — " + detail : ""}`);
}

async function expectTrue(condition, message) {
  assert.ok(condition, message);
}

const run = async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  try {
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push("console: " + msg.text().slice(0, 200));
  });

  const shot = (name) => page.screenshot({ path: join(SHOTS, name), fullPage: false });

  // T1 — landing page
  await page.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
  await expectTrue(
    await page.getByRole("heading", { name: /Professional invoices in/i }).isVisible(),
    "hero heading missing",
  );
  await shot("t1_landing.png");
  record("T1 landing renders", true);

  // T2 — signup → dashboard (fresh free user)
  const email = `e2e+${Date.now()}@example.com`;
  await page.getByRole("link", { name: "Start free" }).first().click();
  await page.waitForURL("**/signup");
  await page.getByLabel("Your name").fill("E2E Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("supersecret9");
  await shot("t2_signup_filled.png");
  await page.route("**/api/auth/sign-up/email", (route) => route.abort());
  await page.getByRole("button", { name: "Create free account" }).click();
  await page.getByRole("alert").filter({ hasText: "Request failed. Please try again." }).waitFor({ state: "visible" });
  await page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled);
  await page.unroute("**/api/auth/sign-up/email");
  await page.getByRole("button", { name: "Create free account" }).click();
  await page.waitForURL("**/dashboard");
  await expectTrue(
    await page.getByText("Free", { exact: true }).first().isVisible(),
    "Free plan badge missing on dashboard",
  );
  await expectTrue(
    await page.getByText(/0 of 3 invoices used/i).isVisible(),
    "quota banner missing",
  );
  await shot("t2_dashboard_free.png");
  record("T2 signup → free dashboard with quota banner", true, email);

  // T3 — create client
  await page.getByRole("link", { name: "Clients" }).click();
  await page.waitForURL("**/dashboard/clients");
  await page.getByRole("button", { name: "New client" }).click();
  await page.getByLabel("Client name").fill("Test Client Co");
  await page.getByLabel("Billing email").fill("billing@testclient.co");
  await shot("t3_client_form.png");
  await page.route("**/dashboard/clients", (route) => route.request().method() === "POST" ? route.abort() : route.continue());
  await page.getByRole("button", { name: "Add client" }).click();
  await page.getByRole("alert").filter({ hasText: "Request failed. Please try again." }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Add client" }).waitFor({ state: "visible" });
  await page.unroute("**/dashboard/clients");
  await page.getByRole("button", { name: "Add client" }).click();
  const clientRow = page.getByRole("cell", { name: /Test Client Co/ });
  try {
    await clientRow.waitFor({ state: "visible", timeout: 20000 });
  } catch {
    const errorText = await page.locator("body").innerText();
    throw new Error(
      "client row missing after create. Error shown: " +
        (errorText.match(/[^\n]*error[^\n]*/i)?.[0] ?? "none"),
    );
  }
  await shot("t3_client_created.png");
  record("T3 client created", true);

  // T4 — create invoice (sent)
  async function createInvoice(description, price, shotName) {
    await page.goto(BASE_URL + "/dashboard/invoices/new", { waitUntil: "domcontentloaded" });
      await page.getByPlaceholder("Design work, consulting…").fill(description);
    await page.getByLabel("Price, line 1").fill(price);
    await shot(shotName + "_form.png");
    await page.getByRole("button", { name: "Save & mark as sent" }).click();
    // id is a UUID; exclude the literal /new and /edit segments
    await page.waitForURL(/\/dashboard\/invoices\/(?!new$|edit$)[a-zA-Z0-9-]+$/, { timeout: 30000 });
    await expectTrue(
      await page.getByText("Sent", { exact: true }).first().isVisible(),
      "Sent badge missing on detail page",
    );
    await shot(shotName + "_detail.png");
  }
  await createInvoice("Website design sprint", "1500", "t4_invoice1");
  record("T4 invoice #1 created and marked sent", true);
  const firstInvoiceUrl = page.url();
  const firstInvoiceId = firstInvoiceUrl.split("/").at(-1);
  const deniedPdf = await context.request.get(`${BASE_URL}/api/invoices/${firstInvoiceId}/pdf`);
  assert.equal(deniedPdf.status(), 402, "Free account must not download a PDF");

  // T5 — fill the free quota, then hit the wall
  await createInvoice("Consulting day", "800", "t5_invoice2");
  await createInvoice("Logo refresh", "600", "t5_invoice3");

  // the invoices list swaps its CTA for an upgrade link at the quota…
  await page.goto(BASE_URL + "/dashboard/invoices", { waitUntil: "domcontentloaded" });
  await expectTrue(
    await page.getByRole("link", { name: /Free limit reached/i }).isVisible(),
    "list page should show upgrade CTA at quota",
  );
  // …and the editor page server-renders the wall
  await page.goto(BASE_URL + "/dashboard/invoices/new", { waitUntil: "domcontentloaded" });
  await expectTrue(
    await page.getByText(/Free plan limit reached/i).isVisible(),
    "server-rendered wall missing on /new",
  );
  await shot("t5_free_wall.png");
  record("T5 free-tier wall blocks invoice #4", true);
  await page.goto(firstInvoiceUrl);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.waitForURL("**/dashboard/invoices");
  await page.goto(`${BASE_URL}/dashboard/invoices/new`);
  await page.getByText("Free plan limit reached", { exact: true }).waitFor({ state: "visible" });
  record("T5b deletion preserves the quota wall", true);

  // T6 — billing page degrades gracefully without Stripe keys
  await page.getByRole("link", { name: "Billing" }).click();
  await page.waitForURL("**/dashboard/billing");
  const billingBody = await page.locator("main").innerText();
  await expectTrue(
    /Billing is not configured/i.test(billingBody) || /Upgrade to Pro/i.test(billingBody),
    "billing page shows neither notice nor upgrade CTA",
  );
  await shot("t6_billing.png");
  record(
    "T6 billing page",
    true,
    /not configured/i.test(billingBody) ? "no-keys notice shown" : "upgrade CTA shown (keys present)",
  );

  // T7 — switch to the Pro demo account
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/login");
  await page.getByLabel("Email").fill("demo@invoiceflow.dev");
  await page.getByLabel("Password").fill("demo12345");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
  await expectTrue(
    await page.getByText("Pro", { exact: true }).first().isVisible(),
    "Pro badge missing for demo user",
  );
  await shot("t7_demo_dashboard.png");
  record("T7 demo Pro sign-in", true);

  // T8 — PDF export on an invoice
  await page.getByRole("link", { name: "Invoices" }).click();
  await page.waitForURL("**/dashboard/invoices");
  await page.getByRole("link", { name: /INV-\d{4}-\d+/ }).first().click();
  await page.waitForURL(/\/dashboard\/invoices\/(?!new$|edit$)[a-zA-Z0-9-]+$/, { timeout: 30000 });
  const pdfLink = page.getByRole("link", { name: "Download PDF" });
  await expectTrue(await pdfLink.isVisible(), "Download PDF link missing for Pro user");
  const [download] = await Promise.all([page.waitForEvent("download"), pdfLink.click()]);
  const pdfPath = join(SHOTS, "t8_download.pdf");
  await download.saveAs(pdfPath);
  const magic = readFileSync(pdfPath).subarray(0, 5).toString();
  await expectTrue(magic === "%PDF-", "downloaded file is not a PDF");
  await shot("t8_invoice_detail.png");
  record("T8 PDF export works for Pro", true, download.suggestedFilename());

  // T9 — public shareable link
  await page.getByRole("button", { name: "Copy client link" }).click();
  await page.getByText("Link copied ✓").waitFor({ state: "visible", timeout: 10000 });
  const publicUrl = await page.evaluate(() => navigator.clipboard.readText());
  await expectTrue(publicUrl.includes("/pay/"), "clipboard does not contain /pay/ link");
  const publicPage = await context.newPage();
  await publicPage.goto(publicUrl, { waitUntil: "domcontentloaded" });
  await expectTrue(
    await publicPage.getByText("Total due").isVisible(),
    "public invoice page missing total",
  );
  await publicPage.screenshot({ path: join(SHOTS, "t9_public_invoice.png") });
  record("T9 public invoice link renders", true, publicUrl);
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => { throw new DOMException("Clipboard denied", "NotAllowedError"); };
    document.execCommand = () => false;
  });
  await page.getByRole("button", { name: "Copy client link" }).click();
  await page.getByRole("alert").filter({ hasText: "Could not copy" }).waitFor({ state: "visible" });
  assert.equal(await page.getByLabel("Client link").inputValue(), publicUrl);
  assert.equal(await page.getByText("Link copied ✓").isVisible(), false);
  record("T9b clipboard failure offers the link without claiming success", true);
  assert.deepEqual(pageErrors, [], "Unhandled browser exceptions");

  } finally { await browser.close(); }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} steps passed`);
  const unexpectedErrors = consoleErrors.filter((error) => !error.includes("net::ERR_FAILED"));
  if (unexpectedErrors.length) {
    console.log("\nConsole errors observed:");
    for (const e of unexpectedErrors) console.log("  " + e);
  }
  assert.equal(failed.length, 0);
  assert.deepEqual(unexpectedErrors, [], "Unexpected console errors");
};

try { await run(); }
catch (error) { console.error("E2E SMOKE FAILED:", error.message); process.exitCode = 1; }
finally { await local.stop(); }
