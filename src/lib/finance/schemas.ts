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
const id = z.int().positive();

/** The scenarios an income or expense belongs to; null = all of them. */
export const scenarioIdsSchema = z
  .array(id)
  .min(1)
  .max(50)
  .refine((ids) => new Set(ids).size === ids.length, { message: "Dubbele situatie" })
  .nullable();

const incomeFields = {
  name,
  amount: euros,
  cycle: cycleSchema,
  /** The main income sets the spending period: until its next payment. */
  main: z.boolean(),
  active: z.boolean(),
  scenarioIds: scenarioIdsSchema,
  note,
};

const expenseFields = {
  name,
  amount: euros,
  cycle: cycleSchema,
  account: accountSchema,
  from: isoDate
    .nullable()
    .describe(
      "First day (inclusive) the expense runs; null = unbounded. Every planned movement whose own day is before it is left out: for an expense paid from the current account the refund the day before `from` is out, the payment on `from` in.",
    ),
  until: isoDate
    .nullable()
    .describe(
      "Last day (inclusive) the expense runs; null = unbounded. Movements after it are left out; once it is before today the expense no longer counts in the monthly costs and auto transfers.",
    ),
  active: z.boolean(),
  scenarioIds: scenarioIdsSchema,
  note,
};

export const incomeCreate = z.strictObject({
  ...incomeFields,
  main: incomeFields.main.optional(),
  active: incomeFields.active.optional(),
  scenarioIds: scenarioIdsSchema.optional(),
  note: note.optional(),
});
export const incomePatch = z.strictObject(incomeFields).partial();
export const incomeDto = z.strictObject({ id, ...incomeFields });
export type IncomeCreate = z.infer<typeof incomeCreate>;
export type IncomePatch = z.infer<typeof incomePatch>;
export type IncomeDto = z.infer<typeof incomeDto>;

/** `from` must not be after `until` (ISO dates compare as strings). */
const boundsInOrder = (value: { from?: string | null; until?: string | null }, ctx: z.RefinementCtx) => {
  if (value.from && value.until && value.from > value.until) {
    ctx.addIssue({ code: "custom", message: "Vanaf moet op of voor tot en met liggen", path: ["until"] });
  }
};

const expenseCreateFields = {
  ...expenseFields,
  from: expenseFields.from.optional(),
  until: expenseFields.until.optional(),
  active: expenseFields.active.optional(),
  scenarioIds: scenarioIdsSchema.optional(),
  note: note.optional(),
};
export const expenseCreate = z.strictObject(expenseCreateFields).superRefine(boundsInOrder);
export const expensePatch = z.strictObject(expenseFields).partial().superRefine(boundsInOrder);
export const expenseDto = z.strictObject({ id, ...expenseFields });
export type ExpenseCreate = z.infer<typeof expenseCreate>;
export type ExpensePatch = z.infer<typeof expensePatch>;
export type ExpenseDto = z.infer<typeof expenseDto>;

/** A situation to compare. The real one is what the overview and transfers use; there is always exactly one. */
const scenarioFields = { name: z.string().trim().min(1).max(50), real: z.boolean() };
export const scenarioCreate = z.strictObject({ ...scenarioFields, real: scenarioFields.real.optional() });
/** `real: true` makes this the real scenario; the real flag can't be switched off directly. */
export const scenarioPatch = z.strictObject(scenarioFields).partial();
export const scenarioDto = z.strictObject({ id, ...scenarioFields });
export type ScenarioCreate = z.infer<typeof scenarioCreate>;
export type ScenarioPatch = z.infer<typeof scenarioPatch>;
export type ScenarioDto = z.infer<typeof scenarioDto>;

/** YYYY-MM */
export const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "Expected a month as YYYY-MM" });

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

/** A one-off payment the savings must still cover (e.g. a yearly fee). */
export const savingsWithdrawal = z.strictObject({ name, amount: euros, date: isoDate, note: note.optional() });
export type SavingsWithdrawal = z.infer<typeof savingsWithdrawal>;

/**
 * A savings account. What's free after the planned withdrawals is spread over the months through `until`
 * (inclusive); without `until` it isn't (a buffer). Its balance is its latest checkpoint.
 */
const savingsAccountFields = {
  name,
  /** Its own IBAN, to recognise transfers in the current account's statement. */
  iban: iban.nullable(),
  until: yearMonth.nullable(),
  withdrawals: z.array(savingsWithdrawal).max(100),
  /** Scenarios whose monthly budget the spread counts in; null for all. */
  scenarioIds: scenarioIdsSchema,
  note,
};
export const savingsAccountCreate = z.strictObject({
  ...savingsAccountFields,
  iban: savingsAccountFields.iban.optional(),
  until: savingsAccountFields.until.optional(),
  withdrawals: savingsAccountFields.withdrawals.optional(),
  scenarioIds: scenarioIdsSchema.optional(),
  note: note.optional(),
  /** First checkpoint. */
  balance: z.strictObject({ amount: signedEuros, date: isoDate }).optional(),
});
export const savingsAccountPatch = z.strictObject(savingsAccountFields).partial();
export type SavingsAccountCreate = z.infer<typeof savingsAccountCreate>;
export type SavingsAccountPatch = z.infer<typeof savingsAccountPatch>;

/** A savings account by id, name (case-insensitive) or IBAN. */
export const savingsAccountRef = z.union([id, z.string().trim().min(1).max(100)]);
export type SavingsAccountRef = z.infer<typeof savingsAccountRef>;

const transferDescription = z.string().trim().min(1).max(200);
/** Positive: savings → current, negative: current → savings. */
const transferAmount = signedEuros.refine((value) => value !== 0, { message: "Bedrag mag geen 0 zijn" });

/** Real money moved between a savings account and the current account, as on the current account's statement. */
const savingsTransferFields = {
  savingsAccountId: id,
  date: isoDate,
  /** Time on `date`, null when unknown; ordered against checkpoints like a spending's. */
  time: clockTime.nullable(),
  amount: transferAmount,
  description: transferDescription,
  note,
};
export const savingsTransferCreate = z.strictObject({
  ...savingsTransferFields,
  /** Defaults to today. */
  date: isoDate.optional(),
  time: clockTime.nullable().optional(),
  note: note.optional(),
});
export const savingsTransferDto = z.strictObject({ id, ...savingsTransferFields });
export const savingsTransferFilter = z.strictObject({
  savingsAccountId: z.coerce.number().pipe(id).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export type SavingsTransferCreate = z.infer<typeof savingsTransferCreate>;
export type SavingsTransferDto = z.infer<typeof savingsTransferDto>;
export type SavingsTransferFilter = z.infer<typeof savingsTransferFilter>;

/** What the summary of a savings account needs: its current balance, the withdrawals and `until`. */
export interface Savings {
  balance: number;
  until: string;
  withdrawals: SavingsWithdrawal[];
}

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
  /** Names are unique: booked lines link a transfer by name. */
  transfers: z
    .array(transferSchema)
    .min(1)
    .max(10)
    .superRefine((transfers, ctx) => uniqueValues(transfers.map((transfer) => transfer.name), ctx)),
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

/** Accounts with checkpoints: the two of `accountSchema` and the savings accounts. */
export const balanceAccountSchema = z.enum(["current", "fixed", "savings"]);
export type BalanceAccount = z.infer<typeof balanceAccountSchema>;

/** A checkpoint: the real balance at the end of `date`, or at `time` that day. */
export const balanceCreate = z
  .strictObject({
    account: balanceAccountSchema,
    /** Required for, and only for, account "savings". */
    savingsAccountId: id.optional(),
    amount: signedEuros,
    /** Defaults to today. */
    date: isoDate.optional(),
    /** HH:MM; spendings later that day come after it. Default: end of the day. */
    time: clockTime.optional(),
  })
  .refine((value) => (value.account === "savings") === (value.savingsAccountId !== undefined), {
    message: "savingsAccountId is required for, and only for, account savings",
    path: ["savingsAccountId"],
  });
export const balanceDto = z.strictObject({
  id,
  account: balanceAccountSchema,
  savingsAccountId: id.nullable(),
  amount: signedEuros,
  date: isoDate,
  time: clockTime.nullable(),
});
export type BalanceCreate = z.infer<typeof balanceCreate>;
export type BalanceDto = z.infer<typeof balanceDto>;

export const savingsAccountDto = z.strictObject({
  id,
  ...savingsAccountFields,
  /** Latest checkpoint, null without one. */
  balance: z.strictObject({ amount: signedEuros, date: isoDate, time: clockTime.nullable() }).nullable(),
  /** All its transfers, newest first. */
  transfers: z.array(savingsTransferDto),
});
export type SavingsAccountDto = z.infer<typeof savingsAccountDto>;

const optionalId = id.nullable();

const categoryFields = {
  name: z.string().trim().min(1).max(50),
  /** Its spendings don't count in spending insights, charts and totals; balances keep them. */
  excluded: z.boolean(),
};
export const categoryCreate = z.strictObject({
  ...categoryFields,
  excluded: categoryFields.excluded.optional(),
});
export const categoryPatch = z.strictObject(categoryFields).partial();
export const categoryDto = z.strictObject({ id, ...categoryFields });
export type CategoryCreate = z.infer<typeof categoryCreate>;
export type CategoryPatch = z.infer<typeof categoryPatch>;
export type CategoryDto = z.infer<typeof categoryDto>;

const outingFields = {
  name,
  date: isoDate
    .nullable()
    .describe(
      "The day it happens, the first day of a multi-day outing; null = no date. Spendings on other days (the ticket) can still belong to it.",
    ),
  endDate: isoDate
    .nullable()
    .describe(
      "Last day (inclusive) of a multi-day outing (a trip, a camp); null = a single day. Needs `date` and must be after it; equal to `date` is stored as null. Clearing `date` needs `endDate` cleared too.",
    ),
  note,
};

/**
 * `endDate` needs a `date` on or before it (ISO dates compare as strings). `requireDate`: a missing `date` counts as
 * none (create); on PATCH the repository checks the merge with the stored row.
 */
const outingRangeInOrder =
  (requireDate: boolean) => (value: { date?: string | null; endDate?: string | null }, ctx: z.RefinementCtx) => {
    if (!value.endDate) return;
    if (value.date === null || (requireDate && value.date === undefined)) {
      ctx.addIssue({ code: "custom", message: "T/m kan alleen met een datum", path: ["endDate"] });
    } else if (value.date && value.endDate < value.date) {
      ctx.addIssue({ code: "custom", message: "T/m mag niet voor de datum liggen", path: ["endDate"] });
    }
  };

export const outingCreate = z
  .strictObject({
    ...outingFields,
    date: outingFields.date.optional(),
    endDate: outingFields.endDate.optional(),
    note: note.optional(),
  })
  .superRefine(outingRangeInOrder(true));
export const outingPatch = z.strictObject(outingFields).partial().superRefine(outingRangeInOrder(false));
export const outingDto = z.strictObject({ id, ...outingFields });
export type OutingCreate = z.infer<typeof outingCreate>;
export type OutingPatch = z.infer<typeof outingPatch>;
export type OutingDto = z.infer<typeof outingDto>;

/**
 * What a counterparty's statement lines usually are: `spending` (always a spending, default category),
 * `income` (a one-off income: a second-hand buyer, family), `plan` (plan items: regular income, fixed costs paid
 * from the current account, transfers to and from the fixed-costs account) or `ask` (depends on the line: Tikkies).
 */
export const counterpartyHandling = z.enum(["spending", "income", "plan", "ask"]);
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

/** Money in that isn't a regular income or a refund (those are negative spendings): something sold, a gift. */
const oneOffIncomeFields = {
  date: isoDate,
  /** Time on `date`, null when unknown; ordered against checkpoints like a spending's. */
  time: clockTime.nullable(),
  amount: euros.refine((value) => value > 0, { message: "Bedrag moet groter dan 0 zijn" }),
  description: z.string().trim().min(1).max(200),
  counterpartyId: optionalId,
  note,
};
export const oneOffIncomeCreate = z.strictObject({
  ...oneOffIncomeFields,
  /** Defaults to today. */
  date: isoDate.optional(),
  time: clockTime.nullable().optional(),
  counterpartyId: optionalId.optional(),
  note: note.optional(),
});
export const oneOffIncomePatch = z.strictObject(oneOffIncomeFields).partial();
export const oneOffIncomeDto = z.strictObject({ id, ...oneOffIncomeFields });
export const oneOffIncomeFilter = z.strictObject({
  from: isoDate.optional(),
  to: isoDate.optional(),
  counterpartyId: z.coerce.number().pipe(id).optional(),
});
export type OneOffIncomeCreate = z.infer<typeof oneOffIncomeCreate>;
export type OneOffIncomePatch = z.infer<typeof oneOffIncomePatch>;
export type OneOffIncomeDto = z.infer<typeof oneOffIncomeDto>;
export type OneOffIncomeFilter = z.infer<typeof oneOffIncomeFilter>;

/** A statement line as the booking client sends it: key from the export, booking date, bank sign. */
const bookedLineInput = z.strictObject({
  key: z.string().min(1).max(2000),
  date: isoDate,
  amount: signedEuros,
});

/**
 * Current-account lines that are a transfer to or from a savings account. `amount` defaults to the sum of the
 * lines (bank sign: money in = from savings), `date` to the first line's.
 */
export const savingsBooking = z.strictObject({
  account: savingsAccountRef,
  description: transferDescription,
  note: note.optional(),
  date: isoDate.optional(),
  time: clockTime.nullable().optional(),
  amount: transferAmount.optional(),
});
export type SavingsBooking = z.infer<typeof savingsBooking>;

export const planLinkKind = z.enum(["income", "expense", "refund", "transfer", "fixed"]);
export type PlanLinkKind = z.infer<typeof planLinkKind>;

/**
 * Lines that are a plan item, linked to one occurrence: an income or an expense paid from the current account
 * (`date` = its due day), the refund of such an expense from the fixed-costs account (`date` = the refund day,
 * the day before the due day), a transfer to the fixed-costs account from the settings, by name (`date` = its
 * day), or `fixed`: money between the current and fixed-costs account outside the plan.
 */
export const planBooking = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("income"), incomeId: id, date: isoDate }),
  z.strictObject({ kind: z.literal("expense"), expenseId: id, date: isoDate }),
  z.strictObject({ kind: z.literal("refund"), expenseId: id, date: isoDate }),
  z.strictObject({
    kind: z.literal("transfer"),
    transfer: name,
    date: isoDate,
  }),
  z.strictObject({ kind: z.literal("fixed") }),
]);
export type PlanBooking = z.infer<typeof planBooking>;

/** Old bookings could skip lines; new ones get a 400 that names the alternatives. */
const skipBooking = z.string().max(200);

const lines = z.array(bookedLineInput).min(1);
/** One or more statement lines that become one spending, one-off income or savings transfer, or a plan item. */
export const booking = z.union([
  z.strictObject({ lines, spending: spendingCreate }),
  z.strictObject({ lines, income: oneOffIncomeCreate }),
  z.strictObject({ lines, savings: savingsBooking }),
  z.strictObject({ lines, plan: planBooking }),
  z.strictObject({ lines, skip: skipBooking }),
]);
/** A booking item without `lines`, for rebooking. */
const bookingTarget = z.union([
  z.strictObject({ spending: spendingCreate }),
  z.strictObject({ income: oneOffIncomeCreate }),
  z.strictObject({ savings: savingsBooking }),
  z.strictObject({ plan: planBooking }),
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

const lineKey = z.string().min(1).max(2000);
/**
 * Book already booked lines anew, atomically: their current booking is removed (its spending, one-off income or
 * savings transfer deleted) and `booking` (a booking item without `lines`) is made from their key, date and amount.
 */
export const rebook = z.strictObject({
  keys: z.array(lineKey).min(1).max(1000).superRefine(uniqueValues),
  booking: bookingTarget,
});
export type Rebook = z.infer<typeof rebook>;

export const bookedLineDto = z.strictObject({
  key: z.string(),
  date: isoDate,
  amount: signedEuros,
  spendingId: id.nullable(),
  oneOffIncomeId: id.nullable(),
  savingsTransferId: id.nullable(),
  plan: planBooking.nullable(),
  /** Old bookings only. */
  skip: z.string().nullable(),
});
export const bookedLineFilter = z.strictObject({
  from: isoDate.optional(),
  to: isoDate.optional(),
});
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
    expenses: z.array(
      z.strictObject({ id: id.optional(), ...expenseCreateFields }).superRefine(boundsInOrder),
    ),
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
