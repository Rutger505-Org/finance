import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { parseDay } from "@/lib/finance/dates";
import * as schema from "@/server/db/schema";
import { HttpError } from "@/server/http-error";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { createRepository, type Repository } from "./repository";

let repository: Repository;
const today = parseDay("2026-10-25");

beforeEach(() => {
  const db = drizzle(new Database(":memory:"), { schema });
  migrate(db, { migrationsFolder: "./drizzle" });
  repository = createRepository(db);
});

const monthly = (day: number) => ({ type: "monthly", day }) as const;

describe("repository", () => {
  test("only one main income", () => {
    const a = repository.createIncome({ name: "DUO", amount: 587, cycle: monthly(24), main: true });
    const b = repository.createIncome({ name: "Toeslag", amount: 129, cycle: monthly(20), main: true });
    expect(repository.getIncome(a.id).main).toBe(false);
    expect(repository.getIncome(b.id).main).toBe(true);
    repository.updateIncome(a.id, { main: true });
    expect(repository.getIncome(b.id).main).toBe(false);
  });

  test("amounts survive the round trip through cents", () => {
    const expense = repository.createExpense({ name: "Vodafone", amount: 19.49, cycle: monthly(16), account: "fixed" });
    expect(expense).toEqual({
      id: expense.id,
      name: "Vodafone",
      amount: 19.49,
      cycle: monthly(16),
      account: "fixed",
      active: true,
      note: null,
    });
  });

  test("missing records give 404", () => {
    expect(() => repository.updateExpense(42, { amount: 1 })).toThrow(HttpError);
    expect(() => repository.deleteIncome(42)).toThrow(HttpError);
  });

  test("replaceConfig updates by id, inserts new and deletes missing", () => {
    const keep = repository.createExpense({ name: "Gym", amount: 32.2, cycle: monthly(1), account: "fixed" });
    repository.createExpense({ name: "Weg", amount: 1, cycle: monthly(1), account: "fixed" });
    repository.replaceConfig({
      settings: { transfer: { cycle: monthly(24), amount: 400 } },
      incomes: [{ name: "DUO", amount: 587, cycle: monthly(24), main: true }],
      expenses: [
        { id: keep.id, name: "Big gym", amount: 34, cycle: monthly(1), account: "fixed" },
        { name: "Claude", amount: 22, cycle: monthly(1), account: "fixed" },
      ],
    });
    const config = repository.getConfig();
    expect(config.settings.transfer.amount).toBe(400);
    expect(config.expenses.map((e) => [e.id === keep.id, e.name])).toEqual([
      [true, "Big gym"],
      [false, "Claude"],
    ]);
    expect(config.incomes).toHaveLength(1);
  });

  test("replaceConfig with an unknown id changes nothing", () => {
    repository.createExpense({ name: "Gym", amount: 32.2, cycle: monthly(1), account: "fixed" });
    expect(() =>
      repository.replaceConfig({
        settings: { transfer: { cycle: monthly(24), amount: "auto" } },
        incomes: [],
        expenses: [{ id: 999, name: "X", amount: 1, cycle: monthly(1), account: "fixed" }],
      }),
    ).toThrow("expenses[0].id");
    expect(repository.listExpenses().map((e) => e.name)).toEqual(["Gym"]);
  });

  test("overview uses active items and the latest balance up to that day", () => {
    repository.createIncome({ name: "DUO", amount: 500, cycle: monthly(24), main: true });
    repository.createExpense({ name: "Telefoon", amount: 20, cycle: monthly(16), account: "fixed" });
    repository.createExpense({ name: "Oud", amount: 99, cycle: monthly(16), account: "fixed", active: false });
    repository.createBalance({ account: "current", amount: 100, date: "2026-10-25" }, today);
    repository.createBalance({ account: "current", amount: 999, date: "2026-10-30" }, today);
    const o = repository.overview(today);
    expect(o.expenses.map((line) => line.name)).toEqual(["Telefoon"]);
    expect(o.current?.balance).toBe(10000);
    expect(o.fixed).toBeUndefined();
  });
});
