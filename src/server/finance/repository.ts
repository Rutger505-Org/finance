import { isoDay, type Day } from "@/lib/finance/dates";
import { buildOverview, type Overview } from "@/lib/finance/plan";
import {
  defaultSettings,
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
  type Settings,
  type SpendingCreate,
  type SpendingDto,
  type SpendingFilter,
  type SpendingPatch,
} from "@/lib/finance/schemas";
import { parseDay } from "@/lib/finance/dates";
import { HttpError } from "@/server/http-error";
import * as schema from "@/server/db/schema";
import { and, asc, desc, eq, gte, lte, ne, notInArray, sql } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

const { balance, category, counterparty, expense, income, outing, settings, spending } = schema;

type Db = BunSQLiteDatabase<typeof schema>;
type IncomeRow = typeof income.$inferSelect;
type ExpenseRow = typeof expense.$inferSelect;
type BalanceRow = typeof balance.$inferSelect;
type OutingRow = typeof outing.$inferSelect;
type CounterpartyRow = typeof counterparty.$inferSelect;
type SpendingRow = typeof spending.$inferSelect;

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
  return { id: row.id, name: row.name, iban: row.iban, categoryId: row.categoryId, note: row.note };
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
    return row ? { transfer: row.transfer } : defaultSettings;
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
      assertRefs(input);
      const categoryId =
        input.categoryId !== undefined
          ? input.categoryId
          : input.counterpartyId
            ? getCounterparty(input.counterpartyId).categoryId
            : null;
      const row = db
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
    },
    updateSpending(id: number, patch: SpendingPatch): SpendingDto {
      assertRefs(patch);
      const row = db.update(spending).set(spendingValues(patch)).where(eq(spending.id, id)).returning().get();
      return row ? spendingDto(row) : notFound("Spending", id);
    },
    deleteSpending(id: number): void {
      const row = db.delete(spending).where(eq(spending.id, id)).returning().get();
      if (!row) notFound("Spending", id);
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
      db.insert(settings)
        .values({ id: 1, transfer: value.transfer })
        .onConflictDoUpdate({ target: settings.id, set: { transfer: value.transfer } })
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
          .values({ id: 1, transfer: config.settings.transfer })
          .onConflictDoUpdate({ target: settings.id, set: { transfer: config.settings.transfer } })
          .run();
      });
    },

    overview(today: Day, window = 31): Overview {
      const transfer = getSettings().transfer;
      const fixedBalance = latestBalance("fixed", today);
      const currentBalance = latestBalance("current", today);
      return buildOverview(
        {
          incomes: db
            .select()
            .from(income)
            .where(eq(income.active, true))
            .orderBy(asc(income.id))
            .all(),
          expenses: db
            .select()
            .from(expense)
            .where(eq(expense.active, true))
            .orderBy(asc(expense.id))
            .all(),
          transfer: {
            cycle: transfer.cycle,
            amount: transfer.amount === "auto" ? "auto" : toCents(transfer.amount),
          },
        },
        today,
        {
          window,
          fixed: fixedBalance && { amount: fixedBalance.amount, date: parseDay(fixedBalance.date) },
          current: currentBalance && { amount: currentBalance.amount, date: parseDay(currentBalance.date) },
        },
      );
    },
  };
}

export type Repository = ReturnType<typeof createRepository>;
