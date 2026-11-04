import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { parseDay } from "@/lib/finance/dates";
import { counterpartyCreate } from "@/lib/finance/schemas";
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

  test("default categories are seeded", () => {
    expect(repository.listCategories().map((c) => c.name)).toEqual([
      "Drinken",
      "Eten",
      "Overig",
      "Tech/opleiding",
      "Tickets",
      "Vervoer",
    ]);
  });

  test("spending takes the counterparty's category unless given", () => {
    const drinks = repository.listCategories().find((c) => c.name === "Drinken")!;
    const food = repository.listCategories().find((c) => c.name === "Eten")!;
    const doornroosje = repository.createCounterparty(
      counterpartyCreate.parse({ name: "Doornroosje", iban: "nl91 abna 0417 1643 00", categoryId: drinks.id }),
    );
    expect(doornroosje.iban).toBe("NL91ABNA0417164300");
    const wtf = repository.createOuting({ name: "WTF", date: "2026-11-07" });
    const beer = repository.createSpending(
      { description: "Bier", amount: 12.5, counterpartyId: doornroosje.id, outingId: wtf.id },
      today,
    );
    expect(beer).toMatchObject({ categoryId: drinks.id, date: "2026-10-25", amount: 12.5 });
    const fries = repository.createSpending(
      { description: "Friet", amount: 8, counterpartyId: doornroosje.id, categoryId: food.id, outingId: wtf.id },
      today,
    );
    expect(fries.categoryId).toBe(food.id);
    expect(repository.listSpendings({ outingId: wtf.id })).toHaveLength(2);
  });

  test("deleting an outing or category keeps its spendings", () => {
    const category = repository.createCategory({ name: "Tijdelijk" });
    const outing = repository.createOuting({ name: "Irish Tuesday" });
    const spending = repository.createSpending(
      { description: "Guinness", amount: 6, date: "2026-11-03", categoryId: category.id, outingId: outing.id },
      today,
    );
    repository.deleteOuting(outing.id);
    repository.deleteCategory(category.id);
    expect(repository.getSpending(spending.id)).toMatchObject({ outingId: null, categoryId: null });
  });

  test("unknown references and duplicates are rejected", () => {
    expect(() => repository.createSpending({ description: "X", amount: 1, outingId: 99 }, today)).toThrow("outingId");
    expect(() => repository.createCategory({ name: "Eten" })).toThrow("already exists");
    repository.createCounterparty({ name: "A", iban: "NL91ABNA0417164300" });
    expect(() => repository.createCounterparty({ name: "B", iban: "NL91ABNA0417164300" })).toThrow("already saved");
  });

  test("spending filter by date range", () => {
    for (const date of ["2026-10-31", "2026-11-01", "2026-11-30", "2026-12-01"]) {
      repository.createSpending({ description: date, amount: 1, date }, today);
    }
    expect(repository.listSpendings({ from: "2026-11-01", to: "2026-11-30" }).map((s) => s.date)).toEqual([
      "2026-11-30",
      "2026-11-01",
    ]);
  });
});
