import { z } from "zod";
import { daysInMonth, isValidIsoDate } from "./dates";

/**
 * Validation for everything that goes into the database: the REST API, the
 * forms and the raw JSON editor all use these schemas. Amounts are euros here;
 * the database stores cents.
 */

export const isoDate = z
  .string()
  .refine(isValidIsoDate, { message: "Expected a date as YYYY-MM-DD" });

export const euros = z
  .number()
  .min(0)
  .max(1_000_000)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
    message: "At most 2 decimals",
  });

/** Like {@link euros}, but a balance can be negative. */
export const signedEuros = z
  .number()
  .min(-1_000_000)
  .max(1_000_000)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
    message: "At most 2 decimals",
  });

export const cycleSchema = z.discriminatedUnion("type", [
  /** Every month on `day`, moved to the last day in shorter months. */
  z.strictObject({
    type: z.literal("monthly"),
    day: z.int().min(1).max(31),
  }),
  /** Every year on `month`-`day` (29 February becomes the 28th in other years). */
  z
    .strictObject({
      type: z.literal("yearly"),
      month: z.int().min(1).max(12),
      day: z.int().min(1).max(31),
    })
    .refine((cycle) => cycle.day <= daysInMonth(2024, cycle.month), {
      message: "Day does not exist in that month",
      path: ["day"],
    }),
  /** Every `days` days, counted from `anchor` (any known occurrence). */
  z.strictObject({
    type: z.literal("interval"),
    days: z.int().min(1).max(366),
    anchor: isoDate,
  }),
]);
export type Cycle = z.infer<typeof cycleSchema>;

/**
 * - fixed: direct debit from the fixed-costs account.
 * - current: paid from the current account; on the due date the reserved
 *   money moves back from the fixed-costs account to the current account.
 */
export const accountSchema = z.enum(["fixed", "current"]);
export type Account = z.infer<typeof accountSchema>;

const name = z.string().trim().min(1).max(100);
const note = z.string().max(1000).nullable();

const incomeFields = {
  name,
  amount: euros,
  cycle: cycleSchema,
  /** The main income sets the spending period: until its next payment. */
  main: z.boolean(),
  active: z.boolean(),
  note,
};

const expenseFields = {
  name,
  amount: euros,
  cycle: cycleSchema,
  account: accountSchema,
  active: z.boolean(),
  note,
};

const id = z.int().positive();

export const incomeCreate = z.strictObject({
  ...incomeFields,
  main: incomeFields.main.optional(),
  active: incomeFields.active.optional(),
  note: note.optional(),
});
export const incomePatch = z.strictObject(incomeFields).partial();
export const incomeDto = z.strictObject({ id, ...incomeFields });
export type IncomeCreate = z.infer<typeof incomeCreate>;
export type IncomePatch = z.infer<typeof incomePatch>;
export type IncomeDto = z.infer<typeof incomeDto>;

export const expenseCreate = z.strictObject({
  ...expenseFields,
  active: expenseFields.active.optional(),
  note: note.optional(),
});
export const expensePatch = z.strictObject(expenseFields).partial();
export const expenseDto = z.strictObject({ id, ...expenseFields });
export type ExpenseCreate = z.infer<typeof expenseCreate>;
export type ExpensePatch = z.infer<typeof expensePatch>;
export type ExpenseDto = z.infer<typeof expenseDto>;

export const settingsSchema = z.strictObject({
  /** Recurring transfer from the current account to the fixed-costs account. */
  transfer: z.strictObject({
    cycle: cycleSchema,
    /** "auto": the average need per transfer, rounded up to whole euros. */
    amount: z.union([z.literal("auto"), euros]),
  }),
});
export type Settings = z.infer<typeof settingsSchema>;

export const defaultSettings: Settings = {
  transfer: { cycle: { type: "monthly", day: 1 }, amount: "auto" },
};

export const balanceCreate = z.strictObject({
  account: accountSchema,
  amount: signedEuros,
  /** Defaults to today. */
  date: isoDate.optional(),
});
export const balanceDto = z.strictObject({
  id,
  account: accountSchema,
  amount: signedEuros,
  date: isoDate,
});
export type BalanceCreate = z.infer<typeof balanceCreate>;
export type BalanceDto = z.infer<typeof balanceDto>;

function uniqueIds(items: { id?: number }[], ctx: z.RefinementCtx, key: string) {
  const seen = new Set<number>();
  items.forEach((item, index) => {
    if (item.id === undefined) return;
    if (seen.has(item.id)) {
      ctx.addIssue({ code: "custom", message: `Duplicate id ${item.id}`, path: [key, index, "id"] });
    }
    seen.add(item.id);
  });
}

/**
 * Everything you define (not the balance history), as one document. Items
 * with an `id` update that record, items without one are created, and
 * records missing from the document are deleted.
 */
export const configSchema = z
  .strictObject({
    settings: settingsSchema,
    incomes: z.array(z.strictObject({ id: id.optional(), ...incomeCreate.shape })),
    expenses: z.array(z.strictObject({ id: id.optional(), ...expenseCreate.shape })),
  })
  .superRefine((config, ctx) => {
    uniqueIds(config.incomes, ctx, "incomes");
    uniqueIds(config.expenses, ctx, "expenses");
    if (config.incomes.filter((income) => income.main).length > 1) {
      ctx.addIssue({ code: "custom", message: "At most one income can be main", path: ["incomes"] });
    }
  });
export type Config = z.infer<typeof configSchema>;

export interface Issue {
  path: string;
  message: string;
}

export function formatIssues(error: z.ZodError): Issue[] {
  return error.issues.map((issue) => ({
    path: issue.path
      .map((part, index) =>
        typeof part === "number" ? `[${part}]` : `${index === 0 ? "" : "."}${String(part)}`,
      )
      .join(""),
    message: issue.message,
  }));
}
