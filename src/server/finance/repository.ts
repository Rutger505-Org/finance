import { isoDay, type Day } from "@/lib/finance/dates";
import { planChanges, reconcile, type Change, type PlanLine, type Reconciliation } from "@/lib/finance/balances";
import {
  buildOverview,
  outflowDays,
  resolveTransfers,
  type Overview,
  type PlanInput,
  type TransferLine,
} from "@/lib/finance/plan";
import { occurrencesBetween } from "@/lib/finance/schedule";
import {
  defaultSettings,
  linkedIncomeIds,
  type Account,
  type BalanceAccount,
  type BalanceCreate,
  type BookedLineDto,
  type BookedLineFilter,
  type Booking,
  type BalanceDto,
  type CategoryCreate,
  type CategoryDto,
  type CategoryPatch,
  type Config,
  type CounterpartyCreate,
  type CounterpartyDto,
  type CounterpartyPatch,
  type ExpenseCreate,
  type ExpenseDto,
  type ExpensePatch,
  type IncomeCreate,
  type IncomeDto,
  type IncomePatch,
  type OneOffIncomeCreate,
  type OneOffIncomeDto,
  type OneOffIncomeFilter,
  type OneOffIncomePatch,
  type OutingCreate,
  type OutingDto,
  type OutingPatch,
  type PlanBooking,
  type Rebook,
  type SavingsAccountCreate,
  type SavingsAccountDto,
  type SavingsAccountPatch,
  type SavingsAccountRef,
  type SavingsTransferCreate,
  type SavingsTransferDto,
  type SavingsTransferFilter,
  type ScenarioCreate,
  type ScenarioDto,
  type ScenarioPatch,
  type Settings,
  type SpendingCreate,
  type SpendingDto,
  type SpendingFilter,
  type SpendingPatch,
} from "@/lib/finance/schemas";
import { parseDay } from "@/lib/finance/dates";
import { inScenario } from "@/lib/finance/savings";
import { HttpError } from "@/server/http-error";
import * as schema from "@/server/db/schema";
import { and, asc, desc, eq, gte, inArray, isNotNull, lte, ne, notInArray, sql } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

const {
  balance,
  bookedLine,
  category,
  counterparty,
  counterpartyAlias,
  expense,
  income,
  oneOffIncome,
  outing,
  savingsAccount,
  savingsTransfer,
  scenario,
  settings,
  spending,
} = schema;

type Db = BunSQLiteDatabase<typeof schema>;
type IncomeRow = typeof income.$inferSelect;
type ExpenseRow = typeof expense.$inferSelect;
type BalanceRow = typeof balance.$inferSelect;
type OutingRow = typeof outing.$inferSelect;
type CounterpartyRow = typeof counterparty.$inferSelect;
type SpendingRow = typeof spending.$inferSelect;
type OneOffIncomeRow = typeof oneOffIncome.$inferSelect;
type SavingsTransferRow = typeof savingsTransfer.$inferSelect;

const toCents = (euros: number) => Math.round(euros * 100);
const toEuros = (cents: number) => cents / 100;

function incomeDto(row: IncomeRow): IncomeDto {
  return {
    id: row.id,
    name: row.name,
    amount: toEuros(row.amount),
    cycle: row.cycle,
    main: row.main,
    active: row.active,
    scenarioIds: row.scenarioIds,
    note: row.note,
  };
}

function expenseDto(row: ExpenseRow): ExpenseDto {
  return {
    id: row.id,
    name: row.name,
    amount: toEuros(row.amount),
    cycle: row.cycle,
    account: row.account,
    active: row.active,
    scenarioIds: row.scenarioIds,
    note: row.note,
  };
}

function balanceDto(row: BalanceRow): BalanceDto {
  return {
    id: row.id,
    account: row.account,
    savingsAccountId: row.savingsAccountId,
    amount: toEuros(row.amount),
    date: row.date,
    time: row.time,
  };
}

type SavingsAccountRow = typeof savingsAccount.$inferSelect;

function savingsTransferDto(row: SavingsTransferRow): SavingsTransferDto {
  return {
    id: row.id,
    savingsAccountId: row.savingsAccountId,
    date: row.date,
    time: row.time,
    amount: toEuros(row.amount),
    description: row.description,
    note: row.note,
  };
}

function savingsAccountDto(
  row: SavingsAccountRow,
  latest: BalanceRow | undefined,
  transfers: SavingsTransferRow[],
): SavingsAccountDto {
  return {
    id: row.id,
    name: row.name,
    iban: row.iban,
    until: row.until,
    withdrawals: row.withdrawals,
    scenarioIds: row.scenarioIds,
    note: row.note,
    balance: latest ? { amount: toEuros(latest.amount), date: latest.date, time: latest.time } : null,
    transfers: transfers.map(savingsTransferDto),
  };
}

function outingDto(row: OutingRow): OutingDto {
  return { id: row.id, name: row.name, date: row.date, note: row.note };
}

type AliasRow = typeof counterpartyAlias.$inferSelect;
type BookedLineRow = typeof bookedLine.$inferSelect;

function counterpartyDto(row: CounterpartyRow, aliases: AliasRow[]): CounterpartyDto {
  const values = (kind: AliasRow["kind"]) =>
    aliases.filter((alias) => alias.counterpartyId === row.id && alias.kind === kind).map((alias) => alias.value);
  return {
    id: row.id,
    name: row.name,
    categoryId: row.categoryId,
    handling: row.handling,
    ibans: values("iban"),
    names: values("name"),
    note: row.note,
  };
}

/** The plan link stored on a booked line, null when it has none. */
function planOf(row: BookedLineRow): PlanBooking | null {
  const date = row.planDate ?? "";
  switch (row.planKind) {
    case null:
      return null;
    case "income":
      return { kind: "income", incomeId: row.planIncomeId!, date };
    case "expense":
    case "refund":
      return { kind: row.planKind, expenseId: row.planExpenseId!, date };
    case "transfer":
      return { kind: "transfer", transfer: row.planTransfer!, date };
    case "fixed":
      return { kind: "fixed" };
  }
}

/** Columns of a booked line for a plan link. */
function planColumns(plan: PlanBooking | null) {
  return {
    planKind: plan?.kind ?? null,
    planIncomeId: plan?.kind === "income" ? plan.incomeId : null,
    planExpenseId:
      plan?.kind === "expense" || plan?.kind === "refund"
        ? plan.expenseId
        : null,
    planTransfer: plan?.kind === "transfer" ? plan.transfer : null,
    planDate: plan && plan.kind !== "fixed" ? plan.date : null,
  };
}

function bookedLineDto(row: BookedLineRow): BookedLineDto {
  return {
    key: row.key,
    date: row.date,
    amount: toEuros(row.amount),
    spendingId: row.spendingId,
    oneOffIncomeId: row.oneOffIncomeId,
    savingsTransferId: row.savingsTransferId,
    plan: planOf(row),
    skip: row.skipReason,
  };
}

type CategoryRow = typeof category.$inferSelect;
const categoryDto = (row: CategoryRow): CategoryDto => ({
  id: row.id,
  name: row.name,
  excluded: row.excluded,
});

function spendingDto(row: SpendingRow): SpendingDto {
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    amount: toEuros(row.amount),
    description: row.description,
    categoryId: row.categoryId,
    outingId: row.outingId,
    counterpartyId: row.counterpartyId,
    note: row.note,
  };
}

function oneOffIncomeDto(row: OneOffIncomeRow): OneOffIncomeDto {
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    amount: toEuros(row.amount),
    description: row.description,
    counterpartyId: row.counterpartyId,
    note: row.note,
  };
}

function oneOffIncomeValues(input: OneOffIncomePatch) {
  return {
    ...input,
    amount: input.amount === undefined ? undefined : toCents(input.amount),
  };
}

function spendingValues(input: SpendingPatch) {
  return {
    ...input,
    amount: input.amount === undefined ? undefined : toCents(input.amount),
  };
}

function incomeValues(input: IncomePatch) {
  return {
    ...input,
    amount: input.amount === undefined ? undefined : toCents(input.amount),
  };
}

function expenseValues(input: ExpensePatch) {
  return {
    ...input,
    amount: input.amount === undefined ? undefined : toCents(input.amount),
  };
}

/** Newest first; a checkpoint without a time is the end of its day, so after the timed ones. */
const newestCheckpointFirst = [
  desc(balance.date),
  desc(sql`${balance.time} is null`),
  desc(balance.time),
  desc(balance.id),
];

/** Newest first, as checkpoints: without a time is the start of the day for a transfer, so last that day. */
const newestTransferFirst = [
  desc(savingsTransfer.date),
  sql`${savingsTransfer.time} is null`,
  desc(savingsTransfer.time),
  desc(savingsTransfer.id),
];

const normalizeIban = (value: string) => value.replace(/\s+/g, "").toUpperCase();

function notFound(kind: string, id: number): never {
  throw new HttpError(404, `${kind} ${id} not found`);
}

/** SQLite unique constraint, e.g. a duplicate category name or IBAN. */
function conflict(error: unknown, message: string): never {
  if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) throw new HttpError(409, message);
  throw error;
}

export function createRepository(db: Db) {
  function getIncome(id: number): IncomeDto {
    const row = db.select().from(income).where(eq(income.id, id)).get();
    return row ? incomeDto(row) : notFound("Income", id);
  }

  function getExpense(id: number): ExpenseDto {
    const row = db.select().from(expense).where(eq(expense.id, id)).get();
    return row ? expenseDto(row) : notFound("Expense", id);
  }

  function getSettings(): Settings {
    const row = db.select().from(settings).where(eq(settings.id, 1)).get();
    return row ? { transfers: row.transfers } : defaultSettings;
  }

  /** A transfer may only take its amount from an income that exists. */
  function checkLinkedIncomes(value: Settings, known: Set<number>) {
    value.transfers.forEach((transfer, index) => {
      if (typeof transfer.amount === "object" && !known.has(transfer.amount.income)) {
        throw new HttpError(400, `transfers[${index}].amount.income: income ${transfer.amount.income} does not exist`);
      }
    });
  }

  function realScenarioId(): number {
    const row = db.select({ id: scenario.id }).from(scenario).where(eq(scenario.real, true)).get();
    if (!row) throw new Error("No real scenario; the migration creates one");
    return row.id;
  }

  function listScenarios(): ScenarioDto[] {
    return db
      .select({ id: scenario.id, name: scenario.name, real: scenario.real })
      .from(scenario)
      .orderBy(desc(scenario.real), sql`${scenario.name} collate nocase`)
      .all();
  }

  /** Scenario ids must exist (foreign keys can't check a JSON list). */
  function assertScenarios(ids: number[] | null | undefined, path = "scenarioIds") {
    if (!ids) return;
    const known = new Set(listScenarios().map((row) => row.id));
    const missing = ids.filter((value) => !known.has(value));
    if (missing.length) throw new HttpError(400, `${path}: scenario ${missing.join(", ")} does not exist`);
  }

  /** Active incomes and expenses of the real scenario, in cents. */
  function planInput(): PlanInput {
    const real = realScenarioId();
    return {
      incomes: inScenario(
        db.select().from(income).where(eq(income.active, true)).orderBy(asc(income.id)).all(),
        real,
      ),
      expenses: inScenario(
        db.select().from(expense).where(eq(expense.active, true)).orderBy(asc(expense.id)).all(),
        real,
      ),
      transfers: getSettings().transfers.map((transfer) => ({
        ...transfer,
        amount: typeof transfer.amount === "number" ? toCents(transfer.amount) : transfer.amount,
      })),
    };
  }

  function latestBalance(account: Account, onOrBefore: Day) {
    return db
      .select()
      .from(balance)
      .where(and(eq(balance.account, account), lte(balance.date, isoDay(onOrBefore))))
      .orderBy(...newestCheckpointFirst)
      .limit(1)
      .get();
  }

  function latestCheckpoint(account: BalanceAccount, savingsAccountId?: number) {
    return db
      .select()
      .from(balance)
      .where(
        and(
          eq(balance.account, account),
          savingsAccountId === undefined ? undefined : eq(balance.savingsAccountId, savingsAccountId),
        ),
      )
      .orderBy(...newestCheckpointFirst)
      .limit(1)
      .get();
  }

  function transfersOf(savingsAccountId: number) {
    return db
      .select()
      .from(savingsTransfer)
      .where(eq(savingsTransfer.savingsAccountId, savingsAccountId))
      .orderBy(...newestTransferFirst)
      .all();
  }

  function toSavingsAccountDto(row: SavingsAccountRow): SavingsAccountDto {
    return savingsAccountDto(row, latestCheckpoint("savings", row.id), transfersOf(row.id));
  }

  function getSavingsAccount(id: number): SavingsAccountDto {
    const row = db.select().from(savingsAccount).where(eq(savingsAccount.id, id)).get();
    return row ? toSavingsAccountDto(row) : notFound("Savings account", id);
  }

  /** By id, IBAN or name (case-insensitive); 400 when unknown or when the name isn't unique. */
  function resolveSavingsAccount(ref: SavingsAccountRef, path = "account"): SavingsAccountRow {
    const rows = db.select().from(savingsAccount).all();
    if (typeof ref === "number") {
      const row = rows.find((r) => r.id === ref);
      if (!row) throw new HttpError(400, `${path}: savings account ${ref} does not exist`);
      return row;
    }
    const byIban = rows.find((r) => r.iban !== null && r.iban === normalizeIban(ref));
    if (byIban) return byIban;
    const byName = rows.filter((r) => r.name.localeCompare(ref, "nl", { sensitivity: "accent" }) === 0);
    if (byName.length === 1) return byName[0];
    throw new HttpError(
      400,
      byName.length ? `${path}: more than one savings account is called "${ref}"; use its id` : `${path}: no savings account "${ref}"`,
    );
  }

  /** A transfer is real money that moved: not in the future. */
  function insertSavingsTransfer(target: Db | Tx, input: SavingsTransferCreate, today: Day): SavingsTransferDto {
    const date = input.date ?? isoDay(today);
    if (date > isoDay(today)) throw new HttpError(400, "date: a savings transfer can't be in the future");
    const row = target
      .insert(savingsTransfer)
      .values({
        savingsAccountId: input.savingsAccountId,
        date,
        time: input.time ?? null,
        amount: toCents(input.amount),
        description: input.description,
        note: input.note ?? null,
      })
      .returning()
      .get();
    return savingsTransferDto(row);
  }

  function assertNotFuture(date: string, today: Day) {
    if (date > isoDay(today)) throw new HttpError(400, "date: a checkpoint can't be in the future");
  }

  /** Foreign keys aren't enforced (bun:sqlite has them off), so check references here. */
  function assertRefs(refs: { categoryId?: number | null; outingId?: number | null; counterpartyId?: number | null }) {
    const missing = (table: typeof category | typeof outing | typeof counterparty, id: number) =>
      !db.select({ id: table.id }).from(table).where(eq(table.id, id)).get();
    if (refs.categoryId != null && missing(category, refs.categoryId)) {
      throw new HttpError(400, `categoryId: category ${refs.categoryId} does not exist`);
    }
    if (refs.outingId != null && missing(outing, refs.outingId)) {
      throw new HttpError(400, `outingId: outing ${refs.outingId} does not exist`);
    }
    if (refs.counterpartyId != null && missing(counterparty, refs.counterpartyId)) {
      throw new HttpError(400, `counterpartyId: counterparty ${refs.counterpartyId} does not exist`);
    }
  }

  function getOuting(id: number): OutingDto {
    const row = db.select().from(outing).where(eq(outing.id, id)).get();
    return row ? outingDto(row) : notFound("Outing", id);
  }

  function getCounterparty(id: number): CounterpartyDto {
    const row = db.select().from(counterparty).where(eq(counterparty.id, id)).get();
    if (!row) notFound("Counterparty", id);
    return counterpartyDto(row, db.select().from(counterpartyAlias).where(eq(counterpartyAlias.counterpartyId, id)).all());
  }

  type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

  /** Without a categoryId the counterparty's default category is used. */
  function insertSpending(target: Db | Tx, input: SpendingCreate, today: Day): SpendingDto {
    assertRefs(input);
    const categoryId =
      input.categoryId !== undefined
        ? input.categoryId
        : input.counterpartyId
          ? getCounterparty(input.counterpartyId).categoryId
          : null;
    const row = target
      .insert(spending)
      .values({
        date: input.date ?? isoDay(today),
        time: input.time ?? null,
        amount: toCents(input.amount),
        description: input.description,
        categoryId,
        outingId: input.outingId ?? null,
        counterpartyId: input.counterpartyId ?? null,
        note: input.note ?? null,
      })
      .returning()
      .get();
    return spendingDto(row);
  }

  function insertOneOffIncome(target: Db | Tx, input: OneOffIncomeCreate, today: Day): OneOffIncomeDto {
    assertRefs(input);
    const row = target
      .insert(oneOffIncome)
      .values({
        date: input.date ?? isoDay(today),
        time: input.time ?? null,
        amount: toCents(input.amount),
        description: input.description,
        counterpartyId: input.counterpartyId ?? null,
        note: input.note ?? null,
      })
      .returning()
      .get();
    return oneOffIncomeDto(row);
  }

  function getOneOffIncome(id: number): OneOffIncomeDto {
    const row = db.select().from(oneOffIncome).where(eq(oneOffIncome.id, id)).get();
    return row ? oneOffIncomeDto(row) : notFound("One-off income", id);
  }

  /** Replaces the aliases of one kind; an alias of another counterparty is a 409. */
  function setAliases(tx: Tx, counterpartyId: number, kind: AliasRow["kind"], values: string[] | undefined) {
    if (values === undefined) return;
    tx.delete(counterpartyAlias)
      .where(and(eq(counterpartyAlias.counterpartyId, counterpartyId), eq(counterpartyAlias.kind, kind)))
      .run();
    for (const value of values) {
      const taken = tx
        .select({ name: counterparty.name })
        .from(counterpartyAlias)
        .innerJoin(counterparty, eq(counterparty.id, counterpartyAlias.counterpartyId))
        .where(and(eq(counterpartyAlias.kind, kind), eq(counterpartyAlias.value, value)))
        .get();
      if (taken) throw new HttpError(409, `${kind === "iban" ? "IBAN" : "Naam"} ${value} hoort al bij ${taken.name}`);
      tx.insert(counterpartyAlias).values({ counterpartyId, kind, value }).run();
    }
  }

  function getSpending(id: number): SpendingDto {
    const row = db.select().from(spending).where(eq(spending.id, id)).get();
    return row ? spendingDto(row) : notFound("Spending", id);
  }

  /** "does not exist" or why it isn't in the plan. */
  function notInPlan(
    table: typeof income | typeof expense,
    kind: string,
    id: number,
  ): string {
    const row = db
      .select({ id: table.id, active: table.active })
      .from(table)
      .where(eq(table.id, id))
      .get();
    if (!row) return `${kind} ${id} does not exist`;
    return row.active
      ? `${kind} ${id} is not in the real scenario`
      : `${kind} ${id} is inactive`;
  }

  /**
   * A plan link must point at an active item of the real scenario and at a real occurrence of it (the error lists
   * the nearest ones). Incomes and refunds are money in, expenses and transfers money out.
   */
  function assertPlan(
    plan: PlanBooking,
    lines: { key: string; amount: number }[],
    path: string,
    input: PlanInput,
  ) {
    if (plan.kind === "fixed") return;
    const day = parseDay(plan.date);
    let label: string;
    let occurrences: (after: Day, until: Day) => Day[];
    let moneyIn: boolean;
    switch (plan.kind) {
      case "income": {
        const item = input.incomes.find((row) => row.id === plan.incomeId);
        if (!item)
          throw new HttpError(
            400,
            `${path}.incomeId: ${notInPlan(income, "income", plan.incomeId)}`,
          );
        label = `a day of income ${plan.incomeId} (${item.name})`;
        occurrences = (after, until) =>
          occurrencesBetween(item.cycle, after, until);
        moneyIn = true;
        break;
      }
      case "expense":
      case "refund": {
        const item = input.expenses.find((row) => row.id === plan.expenseId);
        if (!item)
          throw new HttpError(
            400,
            `${path}.expenseId: ${notInPlan(expense, "expense", plan.expenseId)}`,
          );
        if (item.account !== "current") {
          throw new HttpError(
            400,
            `${path}.expenseId: expense ${plan.expenseId} (${item.name}) is charged to the fixed-costs account, not the current account`,
          );
        }
        if (plan.kind === "expense") {
          label = `a due day of expense ${plan.expenseId} (${item.name})`;
          occurrences = (after, until) =>
            occurrencesBetween(item.cycle, after, until);
          moneyIn = false;
        } else {
          label = `a refund day (the day before a due day) of expense ${plan.expenseId} (${item.name})`;
          occurrences = (after, until) => outflowDays(item, after, until);
          moneyIn = true;
        }
        break;
      }
      case "transfer": {
        const item = input.transfers.find((row) => row.name === plan.transfer);
        if (!item) {
          const names = input.transfers
            .map((row) => `"${row.name}"`)
            .join(", ");
          throw new HttpError(
            400,
            `${path}.transfer: no transfer "${plan.transfer}" in the settings; there are ${names}`,
          );
        }
        label = `a day of transfer "${item.name}"`;
        occurrences = (after, until) =>
          occurrencesBetween(item.cycle, after, until);
        moneyIn = false;
        break;
      }
    }
    const around = occurrences(day - 400, day + 400);
    if (!around.includes(day)) {
      const nearest = [...around]
        .sort((a, b) => Math.abs(a - day) - Math.abs(b - day) || a - b)
        .slice(0, 3)
        .sort((a, b) => a - b);
      throw new HttpError(
        400,
        `${path}.date: ${plan.date} is not ${label}; nearest: ${nearest.map(isoDay).join(", ") || "none"}`,
      );
    }
    // A line against the direction (a refunded incasso) is fine as long as the occurrence, together with the
    // lines already linked to it, still goes the planned way.
    const fits = (cents: number) => (moneyIn ? cents > 0 : cents < 0);
    const keys = new Set(lines.map((line) => line.key));
    const columns = planColumns(plan);
    const linked = db
      .select({ key: bookedLine.key, amount: bookedLine.amount })
      .from(bookedLine)
      .where(
        and(
          eq(bookedLine.planKind, plan.kind),
          eq(bookedLine.planDate, plan.date),
          plan.kind === "income"
            ? eq(bookedLine.planIncomeId, plan.incomeId)
            : plan.kind === "transfer"
              ? eq(bookedLine.planTransfer, plan.transfer)
              : eq(bookedLine.planExpenseId, columns.planExpenseId!),
        ),
      )
      .all()
      .filter((row) => !keys.has(row.key))
      .map((row) => row.amount);
    const amounts = [...lines.map((line) => toCents(line.amount)), ...linked];
    if (!amounts.some(fits)) {
      const index = lines.findIndex((line) => !fits(toCents(line.amount)));
      throw new HttpError(
        400,
        `lines[${index}].amount: ${lines[index].amount} doesn't fit ${plan.kind}, which is money ${moneyIn ? "in (positive)" : "out (negative)"}`,
      );
    }
    const total = amounts.reduce((sum, cents) => sum + cents, 0);
    if (moneyIn ? total < 0 : total > 0) {
      throw new HttpError(
        400,
        `lines: with the lines already linked this ${plan.kind} adds up to ${toEuros(total)}, but it is money ${moneyIn ? "in (positive)" : "out (negative)"}`,
      );
    }
  }

  type BookingLine = Booking["lines"][number];
  /** A booking item, validated and resolved, ready to insert. */
  type Prepared = {
    lines: BookingLine[];
    spending?: SpendingCreate;
    income?: OneOffIncomeCreate;
    savings?: SavingsTransferCreate;
    plan?: PlanBooking;
  };

  const skipGone =
    "skipping is no longer possible: book the lines as a spending, income (one-off income), savings (savings transfer) or plan (income, expense, refund, transfer or fixed)";

  /** Validates a booking item; errors start with `path`. */
  function prepareBooking(
    item: Booking,
    path: string,
    input: () => PlanInput,
  ): Prepared {
    const prefixed = (field: string, check: () => void) => {
      try {
        check();
      } catch (error) {
        if (error instanceof HttpError)
          throw new HttpError(error.status, `${path}.${field}${error.message}`);
        throw error;
      }
    };
    if ("skip" in item) throw new HttpError(400, `${path}.skip: ${skipGone}`);
    if ("spending" in item) {
      prefixed("spending.", () => assertRefs(item.spending));
      return { lines: item.lines, spending: item.spending };
    }
    if ("income" in item) {
      prefixed("income.", () => assertRefs(item.income));
      return { lines: item.lines, income: item.income };
    }
    if ("plan" in item) {
      prefixed("", () => assertPlan(item.plan, item.lines, "plan", input()));
      return { lines: item.lines, plan: item.plan };
    }
    const { account, amount, date, ...rest } = item.savings;
    const total = item.lines.reduce(
      (sum, line) => sum + toCents(line.amount),
      0,
    );
    if (amount === undefined && total === 0) {
      throw new HttpError(
        400,
        `${path}.savings.amount: the lines add up to 0; give an amount`,
      );
    }
    return {
      lines: item.lines,
      savings: {
        ...rest,
        savingsAccountId: resolveSavingsAccount(
          account,
          `${path}.savings.account`,
        ).id,
        date: date ?? item.lines[0].date,
        amount: amount ?? toEuros(total),
      },
    };
  }

  function insertBooking(
    tx: Tx,
    item: Prepared,
    today: Day,
  ): SpendingDto | OneOffIncomeDto | SavingsTransferDto | null {
    const spent = item.spending
      ? insertSpending(tx, item.spending, today)
      : null;
    const received = item.income
      ? insertOneOffIncome(tx, item.income, today)
      : null;
    const transfer = item.savings
      ? insertSavingsTransfer(tx, item.savings, today)
      : null;
    for (const line of item.lines) {
      tx.insert(bookedLine)
        .values({
          key: line.key,
          date: line.date,
          amount: toCents(line.amount),
          spendingId: spent?.id ?? null,
          oneOffIncomeId: received?.id ?? null,
          savingsTransferId: transfer?.id ?? null,
          ...planColumns(item.plan ?? null),
          skipReason: null,
        })
        .run();
    }
    return spent ?? received ?? transfer;
  }

  /** Every booked line linked to the plan, named after its item, for reconciling. */
  function planLines(account: "current" | "fixed"): PlanLine[] {
    const incomeNames = new Map(
      db
        .select({ id: income.id, name: income.name })
        .from(income)
        .all()
        .map((r) => [r.id, r.name]),
    );
    const expenseNames = new Map(
      db
        .select({ id: expense.id, name: expense.name })
        .from(expense)
        .all()
        .map((r) => [r.id, r.name]),
    );
    return db
      .select()
      .from(bookedLine)
      .where(isNotNull(bookedLine.planKind))
      .all()
      .map((row): PlanLine => {
        const plan = planOf(row)!;
        const base = { day: parseDay(row.date), amount: row.amount };
        switch (plan.kind) {
          case "income":
            return {
              ...base,
              name:
                incomeNames.get(plan.incomeId) ?? `Inkomen ${plan.incomeId}`,
              link: {
                kind: "income",
                incomeId: plan.incomeId,
                day: parseDay(plan.date),
              },
            };
          case "expense":
          case "refund":
            return {
              ...base,
              name:
                expenseNames.get(plan.expenseId) ??
                `Vaste last ${plan.expenseId}`,
              link: {
                kind: plan.kind,
                expenseId: plan.expenseId,
                day: parseDay(plan.date),
              },
            };
          case "transfer":
            return {
              ...base,
              name: plan.transfer,
              link: {
                kind: "transfer",
                transfer: plan.transfer,
                day: parseDay(plan.date),
              },
            };
          case "fixed":
            return {
              ...base,
              name:
                account === "current"
                  ? "Vaste lastenrekening"
                  : "Lopende rekening",
              link: { kind: "fixed" },
            };
        }
      });
  }

  /** Lazily, once: the real scenario's plan, for validating plan links. */
  function lazyPlanInput(): () => PlanInput {
    let cached: PlanInput | undefined;
    return () => (cached ??= planInput());
  }

  /** Items with booked lines linked to them can't go: their lines would lose their meaning. */
  function assertNotLinked(
    target: Db | Tx,
    incomeIds: number[],
    expenseIds: number[],
    transfers: string[],
  ) {
    const linked = (
      column:
        | typeof bookedLine.planIncomeId
        | typeof bookedLine.planExpenseId
        | typeof bookedLine.planTransfer,
      values: (number | string)[],
    ) =>
      values.length
        ? target
            .select({ value: column, key: bookedLine.key })
            .from(bookedLine)
            .where(inArray(column, values))
            .all()
        : [];
    const income = linked(bookedLine.planIncomeId, incomeIds)[0];
    if (income) {
      throw new HttpError(
        409,
        `Income ${income.value} has booked lines linked to it; deactivate it instead or rebook ${income.key}`,
      );
    }
    const expenseLine = linked(bookedLine.planExpenseId, expenseIds)[0];
    if (expenseLine) {
      throw new HttpError(
        409,
        `Expense ${expenseLine.value} has booked lines linked to it; deactivate it instead or rebook ${expenseLine.key}`,
      );
    }
    const transfer = linked(bookedLine.planTransfer, transfers)[0];
    if (transfer) {
      throw new HttpError(
        409,
        `Transfer "${transfer.value}" has booked lines linked to it by name; keep the name or rebook ${transfer.key}`,
      );
    }
  }

  /** Transfers in the settings now that `next` no longer has. */
  const droppedTransfers = (next: Settings) =>
    getSettings()
      .transfers.map((transfer) => transfer.name)
      .filter(
        (name) => !next.transfers.some((transfer) => transfer.name === name),
      );

  return {
    listCategories(): CategoryDto[] {
      return db
        .select()
        .from(category)
        .orderBy(sql`${category.name} collate nocase`)
        .all()
        .map(categoryDto);
    },
    createCategory(input: CategoryCreate): CategoryDto {
      try {
        const row = db
          .insert(category)
          .values({ name: input.name, excluded: input.excluded ?? false })
          .returning()
          .get();
        return categoryDto(row);
      } catch (error) {
        conflict(error, `Category "${input.name}" already exists`);
      }
    },
    updateCategory(id: number, patch: CategoryPatch): CategoryDto {
      if (patch.name === undefined && patch.excluded === undefined) {
        const row = db.select().from(category).where(eq(category.id, id)).get();
        return row ? categoryDto(row) : notFound("Category", id);
      }
      try {
        const row = db
          .update(category)
          .set(patch)
          .where(eq(category.id, id))
          .returning()
          .get();
        return row ? categoryDto(row) : notFound("Category", id);
      } catch (error) {
        conflict(error, `Category "${patch.name}" already exists`);
      }
    },
    /** Spendings and counterparties keep existing, without category. */
    deleteCategory(id: number): void {
      db.transaction((tx) => {
        tx.update(spending).set({ categoryId: null }).where(eq(spending.categoryId, id)).run();
        tx.update(counterparty).set({ categoryId: null }).where(eq(counterparty.categoryId, id)).run();
        const row = tx.delete(category).where(eq(category.id, id)).returning().get();
        if (!row) notFound("Category", id);
      });
    },

    listOutings(): OutingDto[] {
      return db
        .select()
        .from(outing)
        .orderBy(sql`${outing.date} is null`, desc(outing.date), desc(outing.id))
        .all()
        .map(outingDto);
    },
    getOuting,
    createOuting(input: OutingCreate): OutingDto {
      const row = db
        .insert(outing)
        .values({ name: input.name, date: input.date ?? null, note: input.note ?? null })
        .returning()
        .get();
      return outingDto(row);
    },
    updateOuting(id: number, patch: OutingPatch): OutingDto {
      const row = db.update(outing).set(patch).where(eq(outing.id, id)).returning().get();
      return row ? outingDto(row) : notFound("Outing", id);
    },
    /** Its spendings stay, without outing. */
    deleteOuting(id: number): void {
      db.transaction((tx) => {
        tx.update(spending).set({ outingId: null }).where(eq(spending.outingId, id)).run();
        const row = tx.delete(outing).where(eq(outing.id, id)).returning().get();
        if (!row) notFound("Outing", id);
      });
    },

    listCounterparties(): CounterpartyDto[] {
      const aliases = db.select().from(counterpartyAlias).orderBy(asc(counterpartyAlias.id)).all();
      return db
        .select()
        .from(counterparty)
        .orderBy(sql`${counterparty.name} collate nocase`)
        .all()
        .map((row) => counterpartyDto(row, aliases));
    },
    getCounterparty,
    createCounterparty(input: CounterpartyCreate): CounterpartyDto {
      assertRefs(input);
      const id = db.transaction((tx) => {
        const row = tx
          .insert(counterparty)
          .values({
            name: input.name,
            categoryId: input.categoryId ?? null,
            handling: input.handling ?? "ask",
            note: input.note ?? null,
          })
          .returning()
          .get();
        setAliases(tx, row.id, "iban", input.ibans ?? []);
        setAliases(tx, row.id, "name", input.names ?? []);
        return row.id;
      });
      return getCounterparty(id);
    },
    updateCounterparty(id: number, patch: CounterpartyPatch): CounterpartyDto {
      assertRefs(patch);
      const { ibans, names, ...fields } = patch;
      db.transaction((tx) => {
        const row = Object.keys(fields).length
          ? tx.update(counterparty).set(fields).where(eq(counterparty.id, id)).returning().get()
          : tx.select().from(counterparty).where(eq(counterparty.id, id)).get();
        if (!row) notFound("Counterparty", id);
        setAliases(tx, id, "iban", ibans);
        setAliases(tx, id, "name", names);
      });
      return getCounterparty(id);
    },
    /** Its spendings and one-off incomes stay, without counterparty. */
    deleteCounterparty(id: number): void {
      db.transaction((tx) => {
        tx.update(spending).set({ counterpartyId: null }).where(eq(spending.counterpartyId, id)).run();
        tx.update(oneOffIncome).set({ counterpartyId: null }).where(eq(oneOffIncome.counterpartyId, id)).run();
        tx.delete(counterpartyAlias).where(eq(counterpartyAlias.counterpartyId, id)).run();
        const row = tx.delete(counterparty).where(eq(counterparty.id, id)).returning().get();
        if (!row) notFound("Counterparty", id);
      });
    },

    /** Newest first; within a day by time, unknown time last. */
    listSpendings(filter: SpendingFilter = {}): SpendingDto[] {
      return db
        .select()
        .from(spending)
        .where(
          and(
            filter.from ? gte(spending.date, filter.from) : undefined,
            filter.to ? lte(spending.date, filter.to) : undefined,
            filter.categoryId ? eq(spending.categoryId, filter.categoryId) : undefined,
            filter.outingId ? eq(spending.outingId, filter.outingId) : undefined,
            filter.counterpartyId ? eq(spending.counterpartyId, filter.counterpartyId) : undefined,
          ),
        )
        .orderBy(desc(spending.date), sql`${spending.time} is null`, desc(spending.time), desc(spending.id))
        .all()
        .map(spendingDto);
    },
    getSpending,
    /** Without a categoryId the counterparty's default category is used. */
    createSpending(input: SpendingCreate, today: Day): SpendingDto {
      return insertSpending(db, input, today);
    },
    updateSpending(id: number, patch: SpendingPatch): SpendingDto {
      assertRefs(patch);
      const row = db.update(spending).set(spendingValues(patch)).where(eq(spending.id, id)).returning().get();
      return row ? spendingDto(row) : notFound("Spending", id);
    },
    /** Its statement lines count as not booked again. */
    deleteSpending(id: number): void {
      db.transaction((tx) => {
        tx.delete(bookedLine).where(eq(bookedLine.spendingId, id)).run();
        const row = tx.delete(spending).where(eq(spending.id, id)).returning().get();
        if (!row) notFound("Spending", id);
      });
    },

    /** Newest first; within a day by time, unknown time last. */
    listOneOffIncomes(filter: OneOffIncomeFilter = {}): OneOffIncomeDto[] {
      return db
        .select()
        .from(oneOffIncome)
        .where(
          and(
            filter.from ? gte(oneOffIncome.date, filter.from) : undefined,
            filter.to ? lte(oneOffIncome.date, filter.to) : undefined,
            filter.counterpartyId ? eq(oneOffIncome.counterpartyId, filter.counterpartyId) : undefined,
          ),
        )
        .orderBy(
          desc(oneOffIncome.date),
          sql`${oneOffIncome.time} is null`,
          desc(oneOffIncome.time),
          desc(oneOffIncome.id),
        )
        .all()
        .map(oneOffIncomeDto);
    },
    getOneOffIncome,
    createOneOffIncome(input: OneOffIncomeCreate, today: Day): OneOffIncomeDto {
      return insertOneOffIncome(db, input, today);
    },
    updateOneOffIncome(id: number, patch: OneOffIncomePatch): OneOffIncomeDto {
      assertRefs(patch);
      const row = db
        .update(oneOffIncome)
        .set(oneOffIncomeValues(patch))
        .where(eq(oneOffIncome.id, id))
        .returning()
        .get();
      return row ? oneOffIncomeDto(row) : notFound("One-off income", id);
    },
    /** Its statement lines count as not booked again. */
    deleteOneOffIncome(id: number): void {
      db.transaction((tx) => {
        tx.delete(bookedLine).where(eq(bookedLine.oneOffIncomeId, id)).run();
        const row = tx.delete(oneOffIncome).where(eq(oneOffIncome.id, id)).returning().get();
        if (!row) notFound("One-off income", id);
      });
    },

    listBookedLines(filter: BookedLineFilter = {}): BookedLineDto[] {
      return db
        .select()
        .from(bookedLine)
        .where(
          and(
            filter.from ? gte(bookedLine.date, filter.from) : undefined,
            filter.to ? lte(bookedLine.date, filter.to) : undefined,
          ),
        )
        .orderBy(asc(bookedLine.date), asc(bookedLine.key))
        .all()
        .map(bookedLineDto);
    },
    /**
     * All or nothing: an already booked line is a 409 and nothing is saved. Returns the created spending,
     * one-off income or savings transfer per booking (null for a plan item).
     */
    book(
      items: Booking[],
      today: Day,
    ): (SpendingDto | OneOffIncomeDto | SavingsTransferDto | null)[] {
      const keys = items.flatMap((item) => item.lines.map((line) => line.key));
      const booked = db
        .select({ key: bookedLine.key })
        .from(bookedLine)
        .where(inArray(bookedLine.key, keys))
        .all();
      if (booked.length > 0) {
        throw new HttpError(409, `Al geboekt: ${booked.map((row) => row.key).join("; ")}`);
      }
      const input = lazyPlanInput();
      const prepared = items.map((item, index) =>
        prepareBooking(item, `[${index}]`, input),
      );
      return db.transaction((tx) =>
        prepared.map((item) => insertBooking(tx, item, today)),
      );
    },
    /**
     * Book lines anew, atomically: their current booking goes (its spending, one-off income or savings transfer
     * is deleted; 400 when another line not in `keys` belongs to it too) and `booking` is made from the lines'
     * saved key, date and amount, in the order of `keys`.
     */
    rebook(
      input: Rebook,
      today: Day,
    ): SpendingDto | OneOffIncomeDto | SavingsTransferDto | null {
      return db.transaction((tx) => {
        const rows = tx
          .select()
          .from(bookedLine)
          .where(inArray(bookedLine.key, input.keys))
          .all();
        const byKey = new Map(rows.map((row) => [row.key, row]));
        const missing = input.keys.filter((key) => !byKey.has(key));
        if (missing.length)
          throw new HttpError(400, `keys: not booked: ${missing.join("; ")}`);
        const owners = [
          { field: "spendingId", table: spending, label: "spending" },
          {
            field: "oneOffIncomeId",
            table: oneOffIncome,
            label: "one-off income",
          },
          {
            field: "savingsTransferId",
            table: savingsTransfer,
            label: "savings transfer",
          },
        ] as const;
        for (const { field, table, label } of owners) {
          const column = bookedLine[field];
          const ids = [...new Set(rows.flatMap((row) => row[field] ?? []))];
          if (!ids.length) continue;
          const other = tx
            .select({ key: bookedLine.key, id: column })
            .from(bookedLine)
            .where(
              and(inArray(column, ids), notInArray(bookedLine.key, input.keys)),
            )
            .get();
          if (other) {
            throw new HttpError(
              400,
              `keys: line ${other.key} also belongs to ${label} ${other.id}; add its key too`,
            );
          }
          tx.delete(bookedLine).where(inArray(column, ids)).run();
          tx.delete(table).where(inArray(table.id, ids)).run();
        }
        tx.delete(bookedLine).where(inArray(bookedLine.key, input.keys)).run();
        const lines = input.keys.map((key) => {
          const row = byKey.get(key)!;
          return { key, date: row.date, amount: toEuros(row.amount) };
        });
        const item = prepareBooking(
          { ...input.booking, lines },
          "booking",
          lazyPlanInput(),
        );
        return insertBooking(tx, item, today);
      });
    },
    /** Skipped lines (old bookings): they count nowhere. */
    countSkippedLines(): number {
      return db
        .select({ count: sql<number>`count(*)` })
        .from(bookedLine)
        .where(isNotNull(bookedLine.skipReason))
        .get()!.count;
    },
    /** Unbook a skipped or plan-linked line; lines of a spending, one-off income or savings transfer go with it. */
    deleteBookedLine(key: string): void {
      const row = db.select().from(bookedLine).where(eq(bookedLine.key, key)).get();
      if (!row) throw new HttpError(404, "Line not booked");
      if (row.spendingId !== null) {
        throw new HttpError(409, `Line belongs to spending ${row.spendingId}; delete that spending instead`);
      }
      if (row.oneOffIncomeId !== null) {
        throw new HttpError(
          409,
          `Line belongs to one-off income ${row.oneOffIncomeId}; delete that one-off income instead`,
        );
      }
      if (row.savingsTransferId !== null) {
        throw new HttpError(409, `Line belongs to savings transfer ${row.savingsTransferId}; delete that transfer instead`);
      }
      db.delete(bookedLine).where(eq(bookedLine.key, key)).run();
    },

    listIncomes(): IncomeDto[] {
      return db.select().from(income).orderBy(asc(income.name)).all().map(incomeDto);
    },
    getIncome,
    createIncome(input: IncomeCreate): IncomeDto {
      assertScenarios(input.scenarioIds);
      return db.transaction((tx) => {
        const row = tx
          .insert(income)
          .values({ ...incomeValues(input), name: input.name, amount: toCents(input.amount), cycle: input.cycle })
          .returning()
          .get();
        if (row.main) tx.update(income).set({ main: false }).where(ne(income.id, row.id)).run();
        return incomeDto(row);
      });
    },
    updateIncome(id: number, patch: IncomePatch): IncomeDto {
      assertScenarios(patch.scenarioIds);
      return db.transaction((tx) => {
        const row = tx.update(income).set(incomeValues(patch)).where(eq(income.id, id)).returning().get();
        if (!row) notFound("Income", id);
        if (patch.main) tx.update(income).set({ main: false }).where(ne(income.id, id)).run();
        return incomeDto(row);
      });
    },
    deleteIncome(id: number): void {
      if (linkedIncomeIds(getSettings()).includes(id)) {
        throw new HttpError(409, `Income ${id} is linked to a transfer; change that transfer first`);
      }
      assertNotLinked(db, [id], [], []);
      const row = db.delete(income).where(eq(income.id, id)).returning().get();
      if (!row) notFound("Income", id);
    },

    listExpenses(): ExpenseDto[] {
      return db.select().from(expense).orderBy(asc(expense.name)).all().map(expenseDto);
    },
    getExpense,
    createExpense(input: ExpenseCreate): ExpenseDto {
      assertScenarios(input.scenarioIds);
      const row = db
        .insert(expense)
        .values({
          ...expenseValues(input),
          name: input.name,
          amount: toCents(input.amount),
          cycle: input.cycle,
          account: input.account,
        })
        .returning()
        .get();
      return expenseDto(row);
    },
    updateExpense(id: number, patch: ExpensePatch): ExpenseDto {
      assertScenarios(patch.scenarioIds);
      const row = db.update(expense).set(expenseValues(patch)).where(eq(expense.id, id)).returning().get();
      return row ? expenseDto(row) : notFound("Expense", id);
    },
    deleteExpense(id: number): void {
      assertNotLinked(db, [], [id], []);
      const row = db
        .delete(expense)
        .where(eq(expense.id, id))
        .returning()
        .get();
      if (!row) notFound("Expense", id);
    },

    listScenarios,
    realScenarioId,
    createScenario(input: ScenarioCreate): ScenarioDto {
      try {
        return db.transaction((tx) => {
          if (input.real) tx.update(scenario).set({ real: false }).run();
          return tx
            .insert(scenario)
            .values({ name: input.name, real: input.real ?? false })
            .returning({ id: scenario.id, name: scenario.name, real: scenario.real })
            .get();
        });
      } catch (error) {
        conflict(error, `Scenario "${input.name}" already exists`);
      }
    },
    updateScenario(id: number, patch: ScenarioPatch): ScenarioDto {
      const current = listScenarios().find((row) => row.id === id) ?? notFound("Scenario", id);
      if (patch.real === false && current.real) {
        throw new HttpError(400, "real: make another scenario real instead");
      }
      try {
        return db.transaction((tx) => {
          if (patch.real && !current.real) tx.update(scenario).set({ real: false }).run();
          const row = tx
            .update(scenario)
            .set(patch)
            .where(eq(scenario.id, id))
            .returning({ id: scenario.id, name: scenario.name, real: scenario.real })
            .get();
          return row ?? notFound("Scenario", id);
        });
      } catch (error) {
        conflict(error, `Scenario "${patch.name}" already exists`);
      }
    },
    /** Not the real one. Items only in this scenario go with it; others just lose it. */
    deleteScenario(id: number): void {
      const current = listScenarios().find((row) => row.id === id) ?? notFound("Scenario", id);
      if (current.real) throw new HttpError(409, "The real scenario can't be deleted; make another one real first");
      const linked = new Set(linkedIncomeIds(getSettings()));
      db.transaction((tx) => {
        for (const table of [income, expense] as const) {
          for (const row of tx.select({ id: table.id, name: table.name, scenarioIds: table.scenarioIds }).from(table).all()) {
            if (!row.scenarioIds?.includes(id)) continue;
            const rest = row.scenarioIds.filter((value) => value !== id);
            if (rest.length === 0 && table === income && linked.has(row.id)) {
              throw new HttpError(409, `Income ${row.name} is linked to a transfer; change that transfer first`);
            }
            if (rest.length === 0) tx.delete(table).where(eq(table.id, row.id)).run();
            else tx.update(table).set({ scenarioIds: rest }).where(eq(table.id, row.id)).run();
          }
        }
        tx.delete(scenario).where(eq(scenario.id, id)).run();
      });
    },

    listSavingsAccounts(): SavingsAccountDto[] {
      return db
        .select()
        .from(savingsAccount)
        .orderBy(sql`${savingsAccount.name} collate nocase`)
        .all()
        .map(toSavingsAccountDto);
    },
    getSavingsAccount,
    /** With `balance`, its first checkpoint is saved too. */
    createSavingsAccount(input: SavingsAccountCreate, today: Day): SavingsAccountDto {
      assertScenarios(input.scenarioIds);
      if (input.balance) assertNotFuture(input.balance.date, today);
      const id = db.transaction((tx) => {
        let row: SavingsAccountRow;
        try {
          row = tx
          .insert(savingsAccount)
          .values({
            name: input.name,
            iban: input.iban ?? null,
            until: input.until ?? null,
            withdrawals: input.withdrawals ?? [],
            scenarioIds: input.scenarioIds ?? null,
            note: input.note ?? null,
          })
          .returning()
          .get();
        } catch (error) {
          conflict(error, "iban: another savings account has this IBAN");
        }
        if (input.balance) {
          tx.insert(balance)
            .values({
              account: "savings",
              savingsAccountId: row.id,
              date: input.balance.date,
              amount: toCents(input.balance.amount),
            })
            .run();
        }
        return row.id;
      });
      return getSavingsAccount(id);
    },
    updateSavingsAccount(id: number, patch: SavingsAccountPatch): SavingsAccountDto {
      assertScenarios(patch.scenarioIds);
      let row: SavingsAccountRow | undefined;
      try {
        row = Object.keys(patch).length
          ? db.update(savingsAccount).set(patch).where(eq(savingsAccount.id, id)).returning().get()
          : db.select().from(savingsAccount).where(eq(savingsAccount.id, id)).get();
      } catch (error) {
        conflict(error, "iban: another savings account has this IBAN");
      }
      if (!row) notFound("Savings account", id);
      return getSavingsAccount(id);
    },
    /** Its checkpoints and transfers go with it; the transfers' statement lines are freed. */
    deleteSavingsAccount(id: number): void {
      db.transaction((tx) => {
        tx.delete(balance).where(eq(balance.savingsAccountId, id)).run();
        const transferIds = tx
          .select({ id: savingsTransfer.id })
          .from(savingsTransfer)
          .where(eq(savingsTransfer.savingsAccountId, id))
          .all()
          .map((r) => r.id);
        if (transferIds.length) tx.delete(bookedLine).where(inArray(bookedLine.savingsTransferId, transferIds)).run();
        tx.delete(savingsTransfer).where(eq(savingsTransfer.savingsAccountId, id)).run();
        const row = tx.delete(savingsAccount).where(eq(savingsAccount.id, id)).returning().get();
        if (!row) notFound("Savings account", id);
      });
    },

    listSavingsTransfers(filter: SavingsTransferFilter = {}): SavingsTransferDto[] {
      return db
        .select()
        .from(savingsTransfer)
        .where(
          and(
            filter.savingsAccountId ? eq(savingsTransfer.savingsAccountId, filter.savingsAccountId) : undefined,
            filter.from ? gte(savingsTransfer.date, filter.from) : undefined,
            filter.to ? lte(savingsTransfer.date, filter.to) : undefined,
          ),
        )
        .orderBy(...newestTransferFirst)
        .all()
        .map(savingsTransferDto);
    },
    createSavingsTransfer(input: SavingsTransferCreate, today: Day): SavingsTransferDto {
      resolveSavingsAccount(input.savingsAccountId, "savingsAccountId");
      return insertSavingsTransfer(db, input, today);
    },
    /** Its statement lines count as not booked again. */
    deleteSavingsTransfer(id: number): void {
      db.transaction((tx) => {
        tx.delete(bookedLine).where(eq(bookedLine.savingsTransferId, id)).run();
        const row = tx.delete(savingsTransfer).where(eq(savingsTransfer.id, id)).returning().get();
        if (!row) notFound("Savings transfer", id);
      });
    },

    getSettings,
    putSettings(value: Settings): Settings {
      checkLinkedIncomes(
        value,
        new Set(
          db
            .select({ id: income.id })
            .from(income)
            .all()
            .map((r) => r.id),
        ),
      );
      assertNotLinked(db, [], [], droppedTransfers(value));
      db.insert(settings)
        .values({ id: 1, transfers: value.transfers })
        .onConflictDoUpdate({ target: settings.id, set: { transfers: value.transfers } })
        .run();
      return getSettings();
    },

    listBalances(filter: { account?: BalanceAccount; savingsAccountId?: number; limit?: number } = {}): BalanceDto[] {
      return db
        .select()
        .from(balance)
        .where(
          and(
            filter.account ? eq(balance.account, filter.account) : undefined,
            filter.savingsAccountId ? eq(balance.savingsAccountId, filter.savingsAccountId) : undefined,
          ),
        )
        .orderBy(...newestCheckpointFirst)
        .limit(filter.limit ?? 100)
        .all()
        .map(balanceDto);
    },
    /** Not in the future: a checkpoint is a balance seen on the bank. */
    createBalance(input: BalanceCreate, today: Day): BalanceDto {
      const date = input.date ?? isoDay(today);
      assertNotFuture(date, today);
      if (input.savingsAccountId !== undefined) getSavingsAccount(input.savingsAccountId);
      const row = db
        .insert(balance)
        .values({
          account: input.account,
          savingsAccountId: input.savingsAccountId ?? null,
          amount: toCents(input.amount),
          date,
          time: input.time ?? null,
        })
        .returning()
        .get();
      return balanceDto(row);
    },
    deleteBalance(id: number): void {
      const row = db.delete(balance).where(eq(balance.id, id)).returning().get();
      if (!row) notFound("Balance", id);
    },
    /**
     * An account's checkpoints, each compared with what it should have been, and its expected balance per day
     * from `from` through `until`: the real scenario's incomes, expenses and transfers, the spendings and
     * one-off incomes (current account), the savings transfers (both sides) and the planned withdrawals after
     * `today` (savings; earlier ones are history, the real ones are transfers).
     */
    reconcile(
      account: BalanceAccount,
      savingsAccountId: number | null,
      from: Day,
      until: Day,
      today: Day,
    ): Reconciliation {
      const rows = db
        .select()
        .from(balance)
        .where(
          and(
            eq(balance.account, account),
            savingsAccountId === null ? undefined : eq(balance.savingsAccountId, savingsAccountId),
          ),
        )
        .all();
      const checkpoints = rows.map((row) => ({ id: row.id, day: parseDay(row.date), time: row.time, amount: row.amount }));
      const first = Math.min(from, ...checkpoints.map((checkpoint) => checkpoint.day));
      const after = first - 1;
      let changes: Change[];
      const transfers = db
        .select({ transfer: savingsTransfer, account: savingsAccount.name })
        .from(savingsTransfer)
        .innerJoin(savingsAccount, eq(savingsAccount.id, savingsTransfer.savingsAccountId))
        .where(
          and(
            gte(savingsTransfer.date, isoDay(after + 1)),
            lte(savingsTransfer.date, isoDay(until)),
            account === "savings" ? eq(savingsTransfer.savingsAccountId, savingsAccountId ?? -1) : undefined,
          ),
        )
        .all();
      if (account === "savings") {
        const withdrawals = savingsAccountId === null ? [] : getSavingsAccount(savingsAccountId).withdrawals;
        changes = withdrawals
          .map((w): Change => ({ day: parseDay(w.date), time: null, name: w.name, amount: -toCents(w.amount), kind: "withdrawal" }))
          .filter((change) => change.day > Math.max(after, today) && change.day <= until);
        for (const { transfer } of transfers) {
          changes.push({
            day: parseDay(transfer.date),
            time: transfer.time,
            name: transfer.description,
            amount: -transfer.amount,
            kind: transfer.amount > 0 ? "toCurrent" : "fromCurrent",
          });
        }
      } else {
        changes = planChanges(
          planInput(),
          account,
          after,
          until,
          planLines(account),
        );
        if (account === "current") {
          const rows = db
            .select()
            .from(spending)
            .where(and(gte(spending.date, isoDay(after + 1)), lte(spending.date, isoDay(until))))
            .all();
          for (const row of rows) {
            changes.push({ day: parseDay(row.date), time: row.time, name: row.description, amount: -row.amount, kind: "spending" });
          }
          const incomes = db
            .select()
            .from(oneOffIncome)
            .where(and(gte(oneOffIncome.date, isoDay(after + 1)), lte(oneOffIncome.date, isoDay(until))))
            .all();
          for (const row of incomes) {
            changes.push({ day: parseDay(row.date), time: row.time, name: row.description, amount: row.amount, kind: "oneOffIncome" });
          }
          for (const { transfer, account: name } of transfers) {
            changes.push({
              day: parseDay(transfer.date),
              time: transfer.time,
              name: `${name}: ${transfer.description}`,
              amount: transfer.amount,
              kind: transfer.amount > 0 ? "fromSavings" : "toSavings",
            });
          }
        }
      }
      return reconcile(checkpoints, changes, from, until);
    },

    getConfig(): Config {
      return {
        settings: getSettings(),
        incomes: db.select().from(income).orderBy(asc(income.id)).all().map(incomeDto),
        expenses: db.select().from(expense).orderBy(asc(expense.id)).all().map(expenseDto),
      };
    },
    /** Replace every income, expense and the settings in one transaction. */
    replaceConfig(config: Config): void {
      db.transaction((tx) => {
        const knownIncomes = new Set(tx.select({ id: income.id }).from(income).all().map((r) => r.id));
        const knownExpenses = new Set(tx.select({ id: expense.id }).from(expense).all().map((r) => r.id));
        config.incomes.forEach((item, index) => {
          assertScenarios(item.scenarioIds, `incomes[${index}].scenarioIds`);
          if (item.id !== undefined && !knownIncomes.has(item.id)) {
            throw new HttpError(400, `incomes[${index}].id: income ${item.id} does not exist`);
          }
        });
        config.expenses.forEach((item, index) => {
          assertScenarios(item.scenarioIds, `expenses[${index}].scenarioIds`);
          if (item.id !== undefined && !knownExpenses.has(item.id)) {
            throw new HttpError(400, `expenses[${index}].id: expense ${item.id} does not exist`);
          }
        });

        const keepIncomes = config.incomes.flatMap((item) => item.id ?? []);
        const keepExpenses = config.expenses.flatMap((item) => item.id ?? []);
        assertNotLinked(
          tx,
          [...knownIncomes].filter((id) => !keepIncomes.includes(id)),
          [...knownExpenses].filter((id) => !keepExpenses.includes(id)),
          droppedTransfers(config.settings),
        );
        tx.delete(income)
          .where(
            keepIncomes.length ? notInArray(income.id, keepIncomes) : undefined,
          )
          .run();
        tx.delete(expense)
          .where(
            keepExpenses.length
              ? notInArray(expense.id, keepExpenses)
              : undefined,
          )
          .run();

        for (const { id, ...item } of config.incomes) {
          const values = {
            name: item.name,
            amount: toCents(item.amount),
            cycle: item.cycle,
            main: item.main ?? false,
            active: item.active ?? true,
            scenarioIds: item.scenarioIds ?? null,
            note: item.note ?? null,
          };
          if (id === undefined) tx.insert(income).values(values).run();
          else tx.update(income).set(values).where(eq(income.id, id)).run();
        }
        for (const { id, ...item } of config.expenses) {
          const values = {
            name: item.name,
            amount: toCents(item.amount),
            cycle: item.cycle,
            account: item.account,
            active: item.active ?? true,
            scenarioIds: item.scenarioIds ?? null,
            note: item.note ?? null,
          };
          if (id === undefined) tx.insert(expense).values(values).run();
          else tx.update(expense).set(values).where(eq(expense.id, id)).run();
        }

        tx.insert(settings)
          .values({ id: 1, transfers: config.settings.transfers })
          .onConflictDoUpdate({ target: settings.id, set: { transfers: config.settings.transfers } })
          .run();
      });
    },

    overview(today: Day, window = 31): Overview {
      const fixedBalance = latestBalance("fixed", today);
      const currentBalance = latestBalance("current", today);
      return buildOverview(planInput(), today, {
        window,
        fixed: fixedBalance && { amount: fixedBalance.amount, date: parseDay(fixedBalance.date) },
        current: currentBalance && { amount: currentBalance.amount, date: parseDay(currentBalance.date) },
      });
    },
    /** Resolved transfers in their saved order. */
    transfers(today: Day): TransferLine[] {
      return resolveTransfers(planInput(), today);
    },
  };
}

export type Repository = ReturnType<typeof createRepository>;
