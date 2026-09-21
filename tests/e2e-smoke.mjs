/**
 * E2E smoke test — walks the whole InvoiceFlow funnel in a real browser.
 *
 *   BASE_URL=http://localhost:3001 node tests/e2e-smoke.mjs
 *
 * Requires a dev/prod server with a freshly-pushed DB (or any state where the
 * demo account exists and signup is open). Creates one throwaway free-plan
 * user per run (email contains a timestamp), exercises the free-tier wall,
 * then verifies the Pro demo account can export a PDF and share a public link.
 *
 * Screenshots are written to gui-test-screenshots/ as evidence.
 */
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3001";
const SHOTS = "gui-test-screenshots";
mkdirSync(SHOTS, { recursive: true });

const results = [];
const consoleErrors = [];

function record(step, ok, detail = "") {
  results.push({ step, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${step}${detail ? " — " + detail : ""}`);
}

async function expectTrue(condition, message) {
  if (!condition) throw new Error(message);
}

const run = async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.on("pageerror", (err) => consoleErrors.push("pageerror: " + err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push("console: " + msg.text().slice(0, 200));
  });

  const shot = (name) => page.screenshot({ path: join(SHOTS, name), fullPage: false });

  /**
   * Dev-mode Turbopack hydrates client components lazily (per-page on-demand
   * compilation), so clicks right after navigation can land on a not-yet-
   * interactive page. Production builds hydrate instantly; this wait is a
   * dev-server accommodation, not a product dependency.
   */
  const settle = () => page.waitForTimeout(5000);

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
  await settle();
  await page.getByLabel("Your name").fill("E2E Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("supersecret9");
  await shot("t2_signup_filled.png");
  await page.getByRole("button", { name: "Create free account" }).click();
  await page.waitForURL("**/dashboard");
  await settle();
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
  await settle();
  await page.getByRole("button", { name: "New client" }).click();
  await page.getByPlaceholder("Client name *").fill("Test Client Co");
  await page.getByPlaceholder("Billing email").fill("billing@testclient.co");
  await shot("t3_client_form.png");
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
    await settle();
    await page.getByPlaceholder("Design work, consulting…").fill(description);
    await page.getByPlaceholder("0.00").fill(price);
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

  // T6 — billing page degrades gracefully without Stripe keys
  await page.getByRole("link", { name: "Billing" }).click();
  await page.waitForURL("**/dashboard/billing");
  await settle();
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
  await settle();
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
  await page.getByRole("link", { name: /INV-2026-\d+/ }).first().click();
  await page.waitForURL(/\/dashboard\/invoices\/(?!new$|edit$)[a-zA-Z0-9-]+$/, { timeout: 30000 });
  await settle();
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

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} steps passed`);
  if (consoleErrors.length) {
    console.log("\nConsole errors observed:");
    for (const e of consoleErrors) console.log("  " + e);
  }
  if (failed.length) process.exit(1);
};

run().catch((err) => {
  console.error("E2E SMOKE FAILED:", err.message);
  process.exit(1);
});
