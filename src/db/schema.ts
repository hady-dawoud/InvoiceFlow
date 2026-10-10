import { relations } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
};

// ---------------------------------------------------------------------------
// better-auth core tables (required by the drizzle adapter, provider: "sqlite")
// ---------------------------------------------------------------------------

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),

  // --- InvoiceFlow application fields (better-auth user.additionalFields) ---
  businessName: text("business_name"),
  currency: text("currency").notNull().default("usd"),
  isPro: integer("is_pro", { mode: "boolean" }).notNull().default(false),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  proSince: integer("pro_since", { mode: "timestamp" }),
}, (table) => [uniqueIndex("user_stripe_customer_id_idx").on(table.stripeCustomerId)]);

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// ---------------------------------------------------------------------------
// InvoiceFlow tables
// ---------------------------------------------------------------------------

export const clients = sqliteTable(
  "clients",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    address: text("address"),
    ...timestamps,
  },
  (table) => [index("clients_user_id_idx").on(table.userId)],
);

export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    /** Human identifier like INV-2026-0001, unique per user. */
    number: text("number").notNull(),
    /** draft | sent | paid */
    status: text("status", { enum: ["draft", "sent", "paid"] })
      .notNull()
      .default("draft"),
    /** ISO calendar dates, e.g. "2026-09-21". */
    issueDate: text("issue_date").notNull(),
    dueDate: text("due_date").notNull(),
    /** Tax in basis points: 8.5% → 850. */
    taxBps: integer("tax_bps").notNull().default(0),
    notes: text("notes"),
    /** Sheet, print, public invoice, and PDF language: en | ar. */
    documentLocale: text("document_locale").notNull().default("en"),
    /** Opaque public token for the shareable client-facing invoice link. */
    token: text("token").notNull().unique(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("invoices_user_number_idx").on(table.userId, table.number),
    index("invoices_user_id_idx").on(table.userId),
    index("invoices_user_issue_idx").on(table.userId, table.issueDate),
    index("invoices_client_id_idx").on(table.clientId),
  ],
);

export const invoiceItems = sqliteTable(
  "invoice_items",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    /** Unit price in integer cents. */
    unitPriceCents: integer("unit_price_cents").notNull().default(0),
  },
  (table) => [index("invoice_items_invoice_id_idx").on(table.invoiceId)],
);

export const invoiceMonthlyUsage = sqliteTable("invoice_monthly_usage", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  month: text("month").notNull(),
  count: integer("count").notNull().default(0),
}, (table) => [primaryKey({ columns: [table.userId, table.month] })]);

export const productEvents = sqliteTable(
  "product_events",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    userId: text("user_id"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("product_events_name_idx").on(table.name)],
);

export const invoiceSequences = sqliteTable("invoice_sequences", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  sequence: integer("sequence").notNull().default(0),
}, (table) => [primaryKey({ columns: [table.userId, table.year] })]);

export const invoiceRelations = relations(invoices, ({ one, many }) => ({
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id],
  }),
  items: many(invoiceItems),
}));

export const invoiceItemRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
}));

export const clientRelations = relations(clients, ({ many }) => ({
  invoices: many(invoices),
}));

export type User = typeof user.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
