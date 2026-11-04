import type { Account, Cycle, Settings } from "@/lib/finance/schemas";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Amounts are cents. Cycles are JSON, validated by `cycleSchema` on the way in. */

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
};

export const income = sqliteTable("income", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  amount: integer("amount").notNull(),
  cycle: text("cycle", { mode: "json" }).$type<Cycle>().notNull(),
  main: integer("main", { mode: "boolean" }).notNull().default(false),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  note: text("note"),
  ...timestamps,
});

export const expense = sqliteTable("expense", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  amount: integer("amount").notNull(),
  cycle: text("cycle", { mode: "json" }).$type<Cycle>().notNull(),
  account: text("account").$type<Account>().notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  note: text("note"),
  ...timestamps,
});

export const balance = sqliteTable(
  "balance",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    account: text("account").$type<Account>().notNull(),
    /** YYYY-MM-DD */
    date: text("date").notNull(),
    amount: integer("amount").notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [index("balance_account_date_idx").on(table.account, table.date)],
);

/** A single row (id 1). */
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  transfer: text("transfer", { mode: "json" }).$type<Settings["transfer"]>().notNull(),
  updatedAt: timestamps.updatedAt,
});

/** What a spending was on (Drinken, Eten, ...). */
export const category = sqliteTable("category", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  ...timestamps,
});

/** What a spending was for: a party or night out. Spendings on other days can belong to it (the ticket). */
export const outing = sqliteTable("outing", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  /** YYYY-MM-DD, the day it happens. */
  date: text("date"),
  note: text("note"),
  ...timestamps,
});

/** A known bank counterparty, to recognise statement lines. */
export const counterparty = sqliteTable("counterparty", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  /** Normalised: uppercase, no spaces. */
  iban: text("iban").unique(),
  categoryId: integer("category_id").references(() => category.id, { onDelete: "set null" }),
  note: text("note"),
  ...timestamps,
});

/** A one-off spending from the current account. Negative = money back (Tikkie). */
export const spending = sqliteTable(
  "spending",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** YYYY-MM-DD */
    date: text("date").notNull(),
    amount: integer("amount").notNull(),
    description: text("description").notNull(),
    categoryId: integer("category_id").references(() => category.id, { onDelete: "set null" }),
    outingId: integer("outing_id").references(() => outing.id, { onDelete: "set null" }),
    counterpartyId: integer("counterparty_id").references(() => counterparty.id, { onDelete: "set null" }),
    note: text("note"),
    ...timestamps,
  },
  (table) => [
    index("spending_date_idx").on(table.date),
    index("spending_outing_idx").on(table.outingId),
  ],
);
