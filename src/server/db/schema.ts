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
