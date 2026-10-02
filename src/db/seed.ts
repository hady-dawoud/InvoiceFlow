/**
 * Seeds the local database with a demo account.
 *
 *   npm run db:seed
 *
 * Demo login: demo@invoiceflow.dev / demo12345 (Pro plan, so every feature
 * is tryable immediately — fresh signups get the free-plan experience).
 *
 * The demo user starts with 5 invoices across all statuses.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { clients, invoiceItems, invoices, user } from "./schema";
import { auth } from "../lib/auth";

const DEMO_EMAIL = "demo@invoiceflow.dev";
const DEMO_PASSWORD = "demo12345";

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function main() {
  await auth.api
    .signUpEmail({
      body: { name: "Demo Freelancer", email: DEMO_EMAIL, password: DEMO_PASSWORD },
    })
    .catch((err) => {
      if (/already exists/i.test(String(err))) return null;
      throw err;
    });

  const [demoUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, DEMO_EMAIL))
    .limit(1);

  if (!demoUser) throw new Error("Demo user missing after signup");

  // Demo account is Pro so every feature (PDF export, unlimited invoices)
  // can be explored immediately; new signups get the free-plan experience.
  if (!demoUser.isPro) {
    await db.update(user).set({ isPro: true }).where(eq(user.id, demoUser.id));
  }

  const existing = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.userId, demoUser.id))
    .limit(1);

  if (existing.length > 0) {
    console.log("Demo data already present — skipping.");
    return;
  }

  const seedClients = await db
    .insert(clients)
    .values([
      { id: randomUUID(), userId: demoUser.id, name: "Acme Studio", email: "billing@acme.studio", address: "100 Main St, Springfield" },
      { id: randomUUID(), userId: demoUser.id, name: "Bright Media LLC", email: "ap@brightmedia.io", address: "221B Market St, San Francisco" },
      { id: randomUUID(), userId: demoUser.id, name: "Northwind Co.", email: "finance@northwind.co", address: "7 Harbour Rd, Boston" },
    ])
    .returning();

  type SeedInvoice = {
    status: "draft" | "sent" | "paid";
    issueOffset: number;
    dueOffset: number;
    client: number;
    items: { description: string; quantity: number; unitPriceCents: number }[];
  };

  const seedInvoices: SeedInvoice[] = [
    { status: "paid", issueOffset: -40, dueOffset: -25, client: 0, items: [{ description: "Landing page design", quantity: 1, unitPriceCents: 120000 }, { description: "Responsive implementation", quantity: 4, unitPriceCents: 90000 }] },
    { status: "paid", issueOffset: -20, dueOffset: -5, client: 1, items: [{ description: "Blog articles (batch)", quantity: 4, unitPriceCents: 25000 }] },
    { status: "sent", issueOffset: -6, dueOffset: 8, client: 2, items: [{ description: "Brand identity refresh", quantity: 1, unitPriceCents: 180000 }, { description: "Logo usage guide", quantity: 1, unitPriceCents: 30000 }] },
    { status: "sent", issueOffset: -30, dueOffset: -10, client: 1, items: [{ description: "Newsletter template", quantity: 1, unitPriceCents: 45000 }] },
    { status: "draft", issueOffset: 0, dueOffset: 14, client: 0, items: [{ description: "Maintenance retainer", quantity: 1, unitPriceCents: 60000 }] },
  ];

  for (let i = 0; i < seedInvoices.length; i++) {
    const seed = seedInvoices[i];
    const invoiceId = randomUUID();
    await db.insert(invoices).values({
      id: invoiceId,
      userId: demoUser.id,
      clientId: seedClients[seed.client]!.id,
      number: `INV-${new Date().getFullYear()}-${String(i + 1).padStart(4, "0")}`,
      status: seed.status,
      issueDate: isoDate(seed.issueOffset),
      dueDate: isoDate(seed.dueOffset),
      taxBps: 0,
      notes: seed.status === "draft" ? "Thanks for your business!" : null,
      token: randomBytes(24).toString("hex"),
    });
    await db.insert(invoiceItems).values(
      seed.items.map((item, position) => ({
        id: randomUUID(),
        invoiceId,
        position,
        description: item.description,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
      })),
    );
  }

  console.log(`Seeded demo account: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  ${seedClients.length} clients, ${seedInvoices.length} invoices.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
