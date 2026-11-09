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

/** HH:MM, 24h. */
export const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "Expected a time as HH:MM" });

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
 * - current: paid from the current account; the day before the due date the
 *   reserved money moves back from the fixed-costs account to the current account.
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

/**
 * How much a transfer moves:
 * - "auto": what the fixed amounts and incomes don't cover yet, spread over
 *   the auto transfers, rounded up to the cent per transfer.
 * - euros: always this amount.
 * - { income }: the whole amount of that income, e.g. the day after it arrives.
 */
export const transferAmountSchema = z.union([z.literal("auto"), euros, z.strictObject({ income: id })]);
export type TransferAmount = z.infer<typeof transferAmountSchema>;

/** Recurring transfer from the current account to the fixed-costs account. */
export const transferSchema = z.strictObject({ name, cycle: cycleSchema, amount: transferAmountSchema });
export type Transfer = z.infer<typeof transferSchema>;

export const settingsSchema = z.strictObject({
  transfers: z.array(transferSchema).min(1).max(10),
});
export type Settings = z.infer<typeof settingsSchema>;

export const defaultSettings: Settings = {
  transfers: [{ name: "Overboeking naar vaste lasten", cycle: { type: "monthly", day: 1 }, amount: "auto" }],
};

/** Income ids the transfers take their amount from. */
export function linkedIncomeIds(settings: Settings): number[] {
  return settings.transfers.flatMap((transfer) =>
    typeof transfer.amount === "object" ? [transfer.amount.income] : [],
  );
}

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

const optionalId = id.nullable();

export const categoryCreate = z.strictObject({ name: z.string().trim().min(1).max(50) });
export const categoryDto = z.strictObject({ id, ...categoryCreate.shape });
export type CategoryCreate = z.infer<typeof categoryCreate>;
export type CategoryDto = z.infer<typeof categoryDto>;

const outingFields = {
  name,
  /** The day it happens; spendings on other days (the ticket) can still belong to it. */
  date: isoDate.nullable(),
  note,
};
export const outingCreate = z.strictObject({
  ...outingFields,
  date: outingFields.date.optional(),
  note: note.optional(),
});
export const outingPatch = z.strictObject(outingFields).partial();
export const outingDto = z.strictObject({ id, ...outingFields });
export type OutingCreate = z.infer<typeof outingCreate>;
export type OutingPatch = z.infer<typeof outingPatch>;
export type OutingDto = z.infer<typeof outingDto>;

/** Uppercase without spaces; Dutch and other IBANs, checked with the mod-97 checksum. */
export const iban = z
  .string()
  .transform((value) => value.replace(/\s+/g, "").toUpperCase())
  .refine(isValidIban, { message: "Geen geldig IBAN" });

export function isValidIban(value: string): boolean {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(value)) return false;
  const digits = (value.slice(4) + value.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1;
}

/**
 * What a counterparty's statement lines usually are: `spending` (always a spending, default category),
 * `skip` (never: fixed costs, own accounts, income) or `ask` (depends on the line: Tikkies, family).
 */
export const counterpartyHandling = z.enum(["spending", "skip", "ask"]);
export type CounterpartyHandling = z.infer<typeof counterpartyHandling>;

/** Case-insensitive part of the name on a statement line ("albert heijn" matches "Albert Heijn 1178"). */
const nameAlias = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .transform((value) => value.toLowerCase());

function uniqueValues(values: string[], ctx: z.RefinementCtx) {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value)) ctx.addIssue({ code: "custom", path: [index], message: `Dubbel: ${value}` });
    seen.add(value);
  });
}

const counterpartyFields = {
  name,
  /** Default category for spendings to this counterparty. */
  categoryId: optionalId,
  handling: counterpartyHandling,
  /** Recognised by any of these IBANs ... */
  ibans: z.array(iban).max(50).superRefine(uniqueValues),
  /** ... or names on the line. */
  names: z.array(nameAlias).max(50).superRefine(uniqueValues),
  note,
};
export const counterpartyCreate = z.strictObject({
  ...counterpartyFields,
  categoryId: optionalId.optional(),
  handling: counterpartyHandling.optional(),
  ibans: counterpartyFields.ibans.optional(),
  names: counterpartyFields.names.optional(),
  note: note.optional(),
});
/** `ibans` and `names` replace the saved ones. */
export const counterpartyPatch = z.strictObject(counterpartyFields).partial();
export const counterpartyDto = z.strictObject({ id, ...counterpartyFields, ibans: z.array(z.string()), names: z.array(z.string()) });
export type CounterpartyCreate = z.infer<typeof counterpartyCreate>;
export type CounterpartyPatch = z.infer<typeof counterpartyPatch>;
export type CounterpartyDto = z.infer<typeof counterpartyDto>;

const spendingFields = {
  date: isoDate,
  /** Payment time on `date`, null when unknown. */
  time: clockTime.nullable(),
  /** Negative is money back, e.g. a Tikkie from a friend. */
  amount: signedEuros.refine((value) => value !== 0, { message: "Bedrag mag niet 0 zijn" }),
  description: z.string().trim().min(1).max(200),
  categoryId: optionalId,
  outingId: optionalId,
  counterpartyId: optionalId,
  note,
};
export const spendingCreate = z.strictObject({
  ...spendingFields,
  /** Defaults to today. */
  date: isoDate.optional(),
  time: clockTime.nullable().optional(),
  /** Omitted: the counterparty's default category. */
  categoryId: optionalId.optional(),
  outingId: optionalId.optional(),
  counterpartyId: optionalId.optional(),
  note: note.optional(),
});
export const spendingPatch = z.strictObject(spendingFields).partial();
export const spendingDto = z.strictObject({ id, ...spendingFields });
export const spendingFilter = z.strictObject({
  from: isoDate.optional(),
  to: isoDate.optional(),
  categoryId: z.coerce.number().pipe(id).optional(),
  outingId: z.coerce.number().pipe(id).optional(),
  counterpartyId: z.coerce.number().pipe(id).optional(),
});
export type SpendingCreate = z.infer<typeof spendingCreate>;
export type SpendingPatch = z.infer<typeof spendingPatch>;
export type SpendingDto = z.infer<typeof spendingDto>;
export type SpendingFilter = z.infer<typeof spendingFilter>;

/** A statement line as the booking client sends it: key from the export, booking date, bank sign. */
const bookedLineInput = z.strictObject({
  key: z.string().min(1).max(2000),
  date: isoDate,
  amount: signedEuros,
});

/** One or more statement lines that become one spending, or are skipped with a reason. */
export const booking = z.union([
  z.strictObject({ lines: z.array(bookedLineInput).min(1), spending: spendingCreate }),
  z.strictObject({ lines: z.array(bookedLineInput).min(1), skip: z.string().trim().min(1).max(200) }),
]);
export const bookings = z
  .array(booking)
  .min(1)
  .max(1000)
  .superRefine((items, ctx) =>
    uniqueValues(
      items.flatMap((item) => item.lines.map((line) => line.key)),
      ctx,
    ),
  );
export const bookedLineDto = z.strictObject({
  key: z.string(),
  date: isoDate,
  amount: signedEuros,
  spendingId: id.nullable(),
  skip: z.string().nullable(),
});
export const bookedLineFilter = z.strictObject({ from: isoDate.optional(), to: isoDate.optional() });
export type Booking = z.infer<typeof booking>;
export type BookedLineDto = z.infer<typeof bookedLineDto>;
export type BookedLineFilter = z.infer<typeof bookedLineFilter>;

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
    const incomeIds = new Set(config.incomes.flatMap((income) => income.id ?? []));
    config.settings.transfers.forEach((transfer, index) => {
      if (typeof transfer.amount === "object" && !incomeIds.has(transfer.amount.income)) {
        ctx.addIssue({
          code: "custom",
          message: `Income ${transfer.amount.income} is not in this config`,
          path: ["settings", "transfers", index, "amount", "income"],
        });
      }
    });
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
