import { isoDay, type Day } from "@/lib/finance/dates";
import { buildOverview, resolveTransfers, type Overview, type PlanInput, type TransferLine } from "@/lib/finance/plan";
import {
  defaultSettings,
  linkedIncomeIds,
  type Account,
  type BalanceCreate,
  type BalanceDto,
  type CategoryCreate,
  type CategoryDto,
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
  type OutingCreate,
  type OutingDto,
  type OutingPatch,
  type ImportResult,
  type Settings,
  type SpendingCreate,
  type SpendingDto,
  type SpendingFilter,
  type SpendingPatch,
  type StatementImport,
  type StatementLineDto,
  type StatementLineFilter,
  type StatementLinePatch,
  type StatementLineSpending,
} from "@/lib/finance/schemas";
import { balanceGaps, lineKey, matchCounterparty, parseStatement, spendingDescription, StatementError } from "@/lib/finance/statement";
import { parseDay } from "@/lib/finance/dates";
import { HttpError } from "@/server/http-error";
import * as schema from "@/server/db/schema";
import { and, asc, desc, eq, gte, isNotNull, isNull, lte, ne, notInArray, sql } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

const { balance, category, counterparty, expense, income, outing, settings, spending, statementLine } = schema;

type Db = BunSQLiteDatabase<typeof schema>;
/** The database or a transaction on it. */
type Tx = Pick<Db, "select" | "insert" | "update" | "delete">;
type IncomeRow = typeof income.$inferSelect;
type ExpenseRow = typeof expense.$inferSelect;
type BalanceRow = typeof balance.$inferSelect;
type OutingRow = typeof outing.$inferSelect;
type CounterpartyRow = typeof counterparty.$inferSelect;
type SpendingRow = typeof spending.$inferSelect;
type StatementLineRow = typeof statementLine.$inferSelect;

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
    note: row.note,
  };
}

function balanceDto(row: BalanceRow): BalanceDto {
  return { id: row.id, account: row.account, amount: toEuros(row.amount), date: row.date };
}

function outingDto(row: OutingRow): OutingDto {
  return { id: row.id, name: row.name, date: row.date, note: row.note };
}

function counterpartyDto(row: CounterpartyRow): CounterpartyDto {
  return {
    id: row.id,
    name: row.name,
    iban: row.iban,
    categoryId: row.categoryId,
    match: row.match,
    mode: row.mode,
    note: row.note,
  };
}

function spendingDto(row: SpendingRow): SpendingDto {
  return {
    id: row.id,
    date: row.date,
    amount: toEuros(row.amount),
    description: row.description,
    categoryId: row.categoryId,
    outingId: row.outingId,
    counterpartyId: row.counterpartyId,
    note: row.note,
  };
}

function statementLineDto(row: StatementLineRow): StatementLineDto {
  return {
    id: row.id,
    account: row.account,
    date: row.date,
    paidAt: row.paidAt,
    amount: toEuros(row.amount),
    balanceAfter: toEuros(row.balanceAfter),
    type: row.type,
    name: row.name,
    iban: row.iban,
    remittance: row.remittance,
    description: row.description,
    counterpartyId: row.counterpartyId,
    spendingId: row.spendingId,
    status: row.spendingId !== null ? "spending" : row.skipped ? "skipped" : "open",
  };
}

const statusWhere = {
  open: and(isNull(statementLine.spendingId), eq(statementLine.skipped, false)),
  spending: isNotNull(statementLine.spendingId),
  skipped: eq(statementLine.skipped, true),
};

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

  /** Active incomes and expenses in cents. */
  function planInput(): PlanInput {
    return {
      incomes: db.select().from(income).where(eq(income.active, true)).orderBy(asc(income.id)).all(),
      expenses: db.select().from(expense).where(eq(expense.active, true)).orderBy(asc(expense.id)).all(),
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
      .orderBy(desc(balance.date), desc(balance.id))
      .limit(1)
      .get();
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
    return row ? counterpartyDto(row) : notFound("Counterparty", id);
  }

  /** Without a categoryId the counterparty's default category is used. */
  function createSpendingIn(tx: Tx, input: SpendingCreate, today: Day): SpendingDto {
    assertRefs(input);
    const categoryId =
      input.categoryId !== undefined
        ? input.categoryId
        : input.counterpartyId
          ? getCounterparty(input.counterpartyId).categoryId
          : null;
    const row = tx
      .insert(spending)
      .values({
        date: input.date ?? isoDay(today),
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

  /** The day it was paid, not booked: a card payment at 00:30 is booked a day later. */
  const spendingDate = (row: StatementLineRow) => row.paidAt?.slice(0, 10) ?? row.date;

  /** Matches every open line to a counterparty and applies its mode. */
  function processOpenLines(tx: Tx): Pick<ImportResult, "spendings" | "skipped" | "open"> {
    const counterparties = tx.select().from(counterparty).all();
    const open = tx.select().from(statementLine).where(statusWhere.open).orderBy(asc(statementLine.id)).all();
    let spendings = 0;
    let skipped = 0;
    for (const row of open) {
      const match = matchCounterparty(row, counterparties);
      if (match?.id !== row.counterpartyId) {
        tx.update(statementLine).set({ counterpartyId: match?.id ?? null }).where(eq(statementLine.id, row.id)).run();
      }
      if (!match || match.mode === "review") continue;
      if (match.mode === "skip") {
        tx.update(statementLine).set({ skipped: true }).where(eq(statementLine.id, row.id)).run();
        skipped++;
        continue;
      }
      const created = tx
        .insert(spending)
        .values({
          date: spendingDate(row),
          amount: -row.amount,
          description: spendingDescription(row),
          categoryId: match.categoryId,
          counterpartyId: match.id,
        })
        .returning({ id: spending.id })
        .get();
      tx.update(statementLine).set({ spendingId: created.id }).where(eq(statementLine.id, row.id)).run();
      spendings++;
    }
    return { spendings, skipped, open: open.length - spendings - skipped };
  }

  function getStatementLine(id: number): StatementLineDto {
    const row = db.select().from(statementLine).where(eq(statementLine.id, id)).get();
    return row ? statementLineDto(row) : notFound("Statement line", id);
  }

  function getSpending(id: number): SpendingDto {
    const row = db.select().from(spending).where(eq(spending.id, id)).get();
    return row ? spendingDto(row) : notFound("Spending", id);
  }

  return {
    listCategories(): CategoryDto[] {
      return db
        .select({ id: category.id, name: category.name })
        .from(category)
        .orderBy(sql`${category.name} collate nocase`)
        .all();
    },
    createCategory(input: CategoryCreate): CategoryDto {
      try {
        const row = db.insert(category).values({ name: input.name }).returning().get();
        return { id: row.id, name: row.name };
      } catch (error) {
        conflict(error, `Category "${input.name}" already exists`);
      }
    },
    renameCategory(id: number, input: CategoryCreate): CategoryDto {
      try {
        const row = db.update(category).set({ name: input.name }).where(eq(category.id, id)).returning().get();
        return row ? { id: row.id, name: row.name } : notFound("Category", id);
      } catch (error) {
        conflict(error, `Category "${input.name}" already exists`);
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
      return db
        .select()
        .from(counterparty)
        .orderBy(sql`${counterparty.name} collate nocase`)
        .all()
        .map(counterpartyDto);
    },
    getCounterparty,
    createCounterparty(input: CounterpartyCreate): CounterpartyDto {
      assertRefs(input);
      try {
        const row = db
          .insert(counterparty)
          .values({
            name: input.name,
            iban: input.iban ?? null,
            categoryId: input.categoryId ?? null,
            match: input.match ?? null,
            mode: input.mode ?? "spending",
            note: input.note ?? null,
          })
          .returning()
          .get();
        return counterpartyDto(row);
      } catch (error) {
        conflict(error, `IBAN ${input.iban} is already saved`);
      }
    },
    updateCounterparty(id: number, patch: CounterpartyPatch): CounterpartyDto {
      assertRefs(patch);
      try {
        const row = db.update(counterparty).set(patch).where(eq(counterparty.id, id)).returning().get();
        return row ? counterpartyDto(row) : notFound("Counterparty", id);
      } catch (error) {
        conflict(error, `IBAN ${patch.iban} is already saved`);
      }
    },
    /** Its spendings stay, without counterparty. */
    deleteCounterparty(id: number): void {
      db.transaction((tx) => {
        tx.update(spending).set({ counterpartyId: null }).where(eq(spending.counterpartyId, id)).run();
        tx.update(statementLine).set({ counterpartyId: null }).where(eq(statementLine.counterpartyId, id)).run();
        const row = tx.delete(counterparty).where(eq(counterparty.id, id)).returning().get();
        if (!row) notFound("Counterparty", id);
      });
    },

    /** Newest first. */
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
        .orderBy(desc(spending.date), desc(spending.id))
        .all()
        .map(spendingDto);
    },
    getSpending,
    /** Without a categoryId the counterparty's default category is used. */
    createSpending(input: SpendingCreate, today: Day): SpendingDto {
      return createSpendingIn(db, input, today);
    },
    updateSpending(id: number, patch: SpendingPatch): SpendingDto {
      assertRefs(patch);
      const row = db.update(spending).set(spendingValues(patch)).where(eq(spending.id, id)).returning().get();
      return row ? spendingDto(row) : notFound("Spending", id);
    },
    /** A statement line it came from becomes skipped, so a later import doesn't bring it back. */
    deleteSpending(id: number): void {
      db.transaction((tx) => {
        tx.update(statementLine).set({ spendingId: null, skipped: true }).where(eq(statementLine.spendingId, id)).run();
        const row = tx.delete(spending).where(eq(spending.id, id)).returning().get();
        if (!row) notFound("Spending", id);
      });
    },

    /**
     * Stores new lines (overlapping exports are fine), records the latest
     * balance and processes every open line. All or nothing.
     */
    importStatement(input: StatementImport): ImportResult {
      let lines;
      try {
        lines = parseStatement(input.text);
      } catch (error) {
        if (error instanceof StatementError) throw new HttpError(400, error.message);
        throw error;
      }
      return db.transaction((tx) => {
        let added = 0;
        for (const line of lines) {
          const inserted = tx
            .insert(statementLine)
            .values({
              account: input.account,
              key: lineKey(line),
              date: line.date,
              paidAt: line.details.paidAt,
              amount: line.amount,
              balanceAfter: line.balanceAfter,
              type: line.details.type,
              name: line.details.name,
              iban: line.details.iban,
              remittance: line.details.remittance,
              description: line.description,
              // Only the current account has one-off spendings.
              skipped: input.account !== "current",
            })
            .onConflictDoNothing({ target: statementLine.key })
            .returning({ id: statementLine.id })
            .get();
          if (inserted) added++;
        }

        const last = lines.reduce((latest, line) => (line.date >= latest.date ? line : latest));
        const known = tx
          .select()
          .from(balance)
          .where(and(eq(balance.account, input.account), eq(balance.date, last.date), eq(balance.amount, last.balanceAfter)))
          .get();
        const balanceRow =
          known ??
          tx.insert(balance).values({ account: input.account, date: last.date, amount: last.balanceAfter }).returning().get();

        const processed = processOpenLines(tx);
        return {
          lines: lines.length,
          added,
          duplicates: lines.length - added,
          ...processed,
          balance: balanceDto(balanceRow),
          warnings: balanceGaps(lines),
        };
      });
    },

    /** After adding or changing counterparties: open lines with a matching counterparty become spendings or skipped. */
    processStatementLines(): Pick<ImportResult, "spendings" | "skipped" | "open"> {
      return db.transaction((tx) => processOpenLines(tx));
    },

    /** Newest first. */
    listStatementLines(filter: StatementLineFilter = {}): StatementLineDto[] {
      return db
        .select()
        .from(statementLine)
        .where(
          and(
            filter.status ? statusWhere[filter.status] : undefined,
            filter.account ? eq(statementLine.account, filter.account) : undefined,
            filter.from ? gte(statementLine.date, filter.from) : undefined,
            filter.to ? lte(statementLine.date, filter.to) : undefined,
          ),
        )
        .orderBy(desc(statementLine.date), desc(statementLine.id))
        .all()
        .map(statementLineDto);
    },
    getStatementLine,
    /** skipped: true removes its spending, false reopens it (an open line is processed again on the next import). */
    patchStatementLine(id: number, patch: StatementLinePatch): StatementLineDto {
      return db.transaction((tx) => {
        const row = tx.select().from(statementLine).where(eq(statementLine.id, id)).get() ?? notFound("Statement line", id);
        if (row.spendingId !== null) tx.delete(spending).where(eq(spending.id, row.spendingId)).run();
        const updated = tx
          .update(statementLine)
          .set({ skipped: patch.skipped, spendingId: null })
          .where(eq(statementLine.id, id))
          .returning()
          .get();
        return statementLineDto(updated);
      });
    },
    /** Line → spending. Fields not given come from the line and its counterparty. */
    statementLineToSpending(id: number, input: StatementLineSpending, today: Day): SpendingDto {
      return db.transaction((tx) => {
        const row = tx.select().from(statementLine).where(eq(statementLine.id, id)).get() ?? notFound("Statement line", id);
        if (row.spendingId !== null) throw new HttpError(409, `Statement line ${id} already has spending ${row.spendingId}`);
        if (row.account !== "current") throw new HttpError(409, "Only current-account lines can become spendings");
        const created = createSpendingIn(
          tx,
          {
            date: input.date ?? spendingDate(row),
            amount: input.amount ?? -toEuros(row.amount),
            description: input.description ?? spendingDescription(row),
            counterpartyId: input.counterpartyId !== undefined ? input.counterpartyId : row.counterpartyId,
            ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
            outingId: input.outingId,
            note: input.note,
          },
          today,
        );
        tx.update(statementLine).set({ spendingId: created.id, skipped: false }).where(eq(statementLine.id, id)).run();
        return created;
      });
    },

    listIncomes(): IncomeDto[] {
      return db.select().from(income).orderBy(asc(income.name)).all().map(incomeDto);
    },
    getIncome,
    createIncome(input: IncomeCreate): IncomeDto {
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
      const row = db.delete(income).where(eq(income.id, id)).returning().get();
      if (!row) notFound("Income", id);
    },

    listExpenses(): ExpenseDto[] {
      return db.select().from(expense).orderBy(asc(expense.name)).all().map(expenseDto);
    },
    getExpense,
    createExpense(input: ExpenseCreate): ExpenseDto {
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
      const row = db.update(expense).set(expenseValues(patch)).where(eq(expense.id, id)).returning().get();
      return row ? expenseDto(row) : notFound("Expense", id);
    },
    deleteExpense(id: number): void {
      const row = db.delete(expense).where(eq(expense.id, id)).returning().get();
      if (!row) notFound("Expense", id);
    },

    getSettings,
    putSettings(value: Settings): Settings {
      checkLinkedIncomes(value, new Set(db.select({ id: income.id }).from(income).all().map((r) => r.id)));
      db.insert(settings)
        .values({ id: 1, transfers: value.transfers })
        .onConflictDoUpdate({ target: settings.id, set: { transfers: value.transfers } })
        .run();
      return getSettings();
    },

    listBalances(filter: { account?: Account; limit?: number } = {}): BalanceDto[] {
      return db
        .select()
        .from(balance)
        .where(filter.account ? eq(balance.account, filter.account) : undefined)
        .orderBy(desc(balance.date), desc(balance.id))
        .limit(filter.limit ?? 100)
        .all()
        .map(balanceDto);
    },
    createBalance(input: BalanceCreate, today: Day): BalanceDto {
      const row = db
        .insert(balance)
        .values({ account: input.account, amount: toCents(input.amount), date: input.date ?? isoDay(today) })
        .returning()
        .get();
      return balanceDto(row);
    },
    deleteBalance(id: number): void {
      const row = db.delete(balance).where(eq(balance.id, id)).returning().get();
      if (!row) notFound("Balance", id);
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
          if (item.id !== undefined && !knownIncomes.has(item.id)) {
            throw new HttpError(400, `incomes[${index}].id: income ${item.id} does not exist`);
          }
        });
        config.expenses.forEach((item, index) => {
          if (item.id !== undefined && !knownExpenses.has(item.id)) {
            throw new HttpError(400, `expenses[${index}].id: expense ${item.id} does not exist`);
          }
        });

        const keepIncomes = config.incomes.flatMap((item) => item.id ?? []);
        const keepExpenses = config.expenses.flatMap((item) => item.id ?? []);
        tx.delete(income).where(keepIncomes.length ? notInArray(income.id, keepIncomes) : undefined).run();
        tx.delete(expense).where(keepExpenses.length ? notInArray(expense.id, keepExpenses) : undefined).run();

        for (const { id, ...item } of config.incomes) {
          const values = {
            name: item.name,
            amount: toCents(item.amount),
            cycle: item.cycle,
            main: item.main ?? false,
            active: item.active ?? true,
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
