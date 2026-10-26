import { isoDay, type Day } from "@/lib/finance/dates";
import { buildOverview, type Overview } from "@/lib/finance/plan";
import {
  defaultSettings,
  type Account,
  type BalanceCreate,
  type BalanceDto,
  type Config,
  type ExpenseCreate,
  type ExpenseDto,
  type ExpensePatch,
  type IncomeCreate,
  type IncomeDto,
  type IncomePatch,
  type Settings,
} from "@/lib/finance/schemas";
import { parseDay } from "@/lib/finance/dates";
import { HttpError } from "@/server/http-error";
import * as schema from "@/server/db/schema";
import { and, asc, desc, eq, lte, ne, notInArray } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

const { balance, expense, income, settings } = schema;

type Db = BunSQLiteDatabase<typeof schema>;
type IncomeRow = typeof income.$inferSelect;
type ExpenseRow = typeof expense.$inferSelect;
type BalanceRow = typeof balance.$inferSelect;

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

  return {
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
