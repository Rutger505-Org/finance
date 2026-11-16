import type {
  Account,
  BalanceAccount,
  CounterpartyHandling,
  Cycle,
  PlanLinkKind,
  SavingsWithdrawal,
  Settings,
} from "@/lib/finance/schemas";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

/**
 * A situation to compare (e.g. after a move). Exactly one is real: the overview and transfers use it.
 * Incomes and expenses list the scenarios they belong to, or null for all.
 */
export const scenario = sqliteTable("scenario", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  real: integer("real", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
});

/** Null: in every scenario. */
const scenarioIds = () => text("scenario_ids", { mode: "json" }).$type<number[] | null>();

export const income = sqliteTable("income", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  amount: integer("amount").notNull(),
  cycle: text("cycle", { mode: "json" }).$type<Cycle>().notNull(),
  main: integer("main", { mode: "boolean" }).notNull().default(false),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  scenarioIds: scenarioIds(),
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
  scenarioIds: scenarioIds(),
  note: text("note"),
  ...timestamps,
});

/** A savings account. Its balance is its latest checkpoint in `balance`. */
export const savingsAccount = sqliteTable("savings_account", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  /** Uppercase without spaces; unique when set. */
  iban: text("iban").unique(),
  /** YYYY-MM, last month it has to last; what's free is spread until then. Null: not spread (a buffer). */
  until: text("until"),
  /** Planned payments from it, amounts in euros as in `savingsWithdrawal`. */
  withdrawals: text("withdrawals", { mode: "json" }).$type<SavingsWithdrawal[]>().notNull(),
  /** Scenarios whose monthly budget its spread counts in; null for all. */
  scenarioIds: scenarioIds(),
  note: text("note"),
  ...timestamps,
});

/**
 * Real money moved between a savings account and the current account (the only account it can move to or from).
 * Positive `amount`: savings → current; negative: current → savings.
 */
export const savingsTransfer = sqliteTable(
  "savings_transfer",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    savingsAccountId: integer("savings_account_id")
      .notNull()
      .references(() => savingsAccount.id, { onDelete: "cascade" }),
    /** YYYY-MM-DD */
    date: text("date").notNull(),
    /** HH:MM, as `spending.time`. */
    time: text("time"),
    amount: integer("amount").notNull(),
    description: text("description").notNull(),
    note: text("note"),
    ...timestamps,
  },
  (table) => [
    index("savings_transfer_account_date_idx").on(table.savingsAccountId, table.date),
    index("savings_transfer_date_idx").on(table.date),
  ],
);

/** A checkpoint: the real balance of an account at the end of `date`, or at `time` that day. */
export const balance = sqliteTable(
  "balance",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    account: text("account").$type<BalanceAccount>().notNull(),
    /** Set iff account is "savings". */
    savingsAccountId: integer("savings_account_id").references(() => savingsAccount.id, { onDelete: "cascade" }),
    /** YYYY-MM-DD */
    date: text("date").notNull(),
    /** HH:MM; spendings with a later time that day come after it. Null: end of the day. */
    time: text("time"),
    amount: integer("amount").notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [index("balance_account_date_idx").on(table.account, table.date)],
);

/** A single row (id 1). */
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  /** Amounts in euros, as in `settingsSchema`. */
  transfers: text("transfers", { mode: "json" }).$type<Settings["transfers"]>().notNull(),
  updatedAt: timestamps.updatedAt,
});

/** What a spending was on (Drinken, Eten, ...). */
export const category = sqliteTable("category", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  /** Its spendings don't count in spending insights and totals; balances keep them. */
  excluded: integer("excluded", { mode: "boolean" }).notNull().default(false),
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

/** A known bank counterparty: what Rocky knows about who is behind a statement line. */
export const counterparty = sqliteTable("counterparty", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Real name ("Concertzaal"), not the card terminal name. */
  name: text("name").notNull(),
  categoryId: integer("category_id").references(() => category.id, { onDelete: "set null" }),
  /** What its statement lines usually are, see `CounterpartyHandling`. */
  handling: text("handling").$type<CounterpartyHandling>().notNull().default("ask"),
  note: text("note"),
  ...timestamps,
});

/** How a statement line is recognised: an IBAN, or a case-insensitive part of the name on the line. */
export const counterpartyAlias = sqliteTable(
  "counterparty_alias",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    counterpartyId: integer("counterparty_id")
      .notNull()
      .references(() => counterparty.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"iban" | "name">().notNull(),
    /** IBAN uppercase without spaces; name lowercase. */
    value: text("value").notNull(),
  },
  (table) => [
    uniqueIndex("counterparty_alias_kind_value_unique").on(table.kind, table.value),
    index("counterparty_alias_counterparty_idx").on(table.counterpartyId),
  ],
);

/** A one-off spending from the current account. Negative = money back (Tikkie). */
export const spending = sqliteTable(
  "spending",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** YYYY-MM-DD */
    date: text("date").notNull(),
    /** HH:MM payment time, null when unknown (iDEAL/SEPA lines without one, manual entries). */
    time: text("time"),
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

/** Money in that isn't a regular income or a refund: something sold second-hand, a contribution from family. */
export const oneOffIncome = sqliteTable(
  "one_off_income",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** YYYY-MM-DD */
    date: text("date").notNull(),
    /** HH:MM, as `spending.time`. */
    time: text("time"),
    /** Always positive. */
    amount: integer("amount").notNull(),
    description: text("description").notNull(),
    counterpartyId: integer("counterparty_id").references(() => counterparty.id, { onDelete: "set null" }),
    note: text("note"),
    ...timestamps,
  },
  (table) => [index("one_off_income_date_idx").on(table.date)],
);

/**
 * A statement line that has been booked: as (part of) a spending, one-off income or savings transfer, linked to a
 * plan occurrence, or skipped (old data only). Exactly one of those per line. Lines themselves aren't stored.
 */
export const bookedLine = sqliteTable(
  "booked_line",
  {
    /** Identifies the line across overlapping exports: account|date|balance before|balance after|description. */
    key: text("key").primaryKey(),
    /** Booking date, YYYY-MM-DD. */
    date: text("date").notNull(),
    /** Bank sign: negative is money out. */
    amount: integer("amount").notNull(),
    spendingId: integer("spending_id").references(() => spending.id, {
      onDelete: "cascade",
    }),
    oneOffIncomeId: integer("one_off_income_id").references(
      () => oneOffIncome.id,
      { onDelete: "cascade" },
    ),
    savingsTransferId: integer("savings_transfer_id").references(
      () => savingsTransfer.id,
      { onDelete: "cascade" },
    ),
    /**
     * Linked to a plan occurrence (see `planLink`): `planIncomeId` for income, `planExpenseId` for expense and
     * refund, `planTransfer` (name in settings) for transfer, each with `planDate`; fixed has none of them.
     */
    planKind: text("plan_kind").$type<PlanLinkKind>(),
    planIncomeId: integer("plan_income_id"),
    planExpenseId: integer("plan_expense_id"),
    planTransfer: text("plan_transfer"),
    /** YYYY-MM-DD: the planned day of the occurrence (refund: the planned refund day). */
    planDate: text("plan_date"),
    /** Old bookings only: why it was neither. New bookings can't skip. */
    skipReason: text("skip_reason"),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    index("booked_line_date_idx").on(table.date),
    index("booked_line_spending_idx").on(table.spendingId),
    index("booked_line_one_off_income_idx").on(table.oneOffIncomeId),
    index("booked_line_savings_transfer_idx").on(table.savingsTransferId),
    index("booked_line_plan_idx").on(table.planKind),
  ],
);
