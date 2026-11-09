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
    const a = repository.createIncome({ name: "Salaris", amount: 500, cycle: monthly(25), main: true });
    const b = repository.createIncome({ name: "Bijbaan", amount: 100, cycle: monthly(10), main: true });
    expect(repository.getIncome(a.id).main).toBe(false);
    expect(repository.getIncome(b.id).main).toBe(true);
    repository.updateIncome(a.id, { main: true });
    expect(repository.getIncome(b.id).main).toBe(false);
  });

  test("amounts survive the round trip through cents", () => {
    const expense = repository.createExpense({ name: "Telefoon", amount: 12.34, cycle: monthly(5), account: "fixed" });
    expect(expense).toEqual({
      id: expense.id,
      name: "Telefoon",
      amount: 12.34,
      cycle: monthly(5),
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
    const keep = repository.createExpense({ name: "Sport", amount: 30.5, cycle: monthly(1), account: "fixed" });
    repository.createExpense({ name: "Weg", amount: 1, cycle: monthly(1), account: "fixed" });
    repository.replaceConfig({
      settings: { transfers: [{ name: "T", cycle: monthly(25), amount: 300 }] },
      incomes: [{ name: "Salaris", amount: 500, cycle: monthly(25), main: true }],
      expenses: [
        { id: keep.id, name: "Sport plus", amount: 35, cycle: monthly(1), account: "fixed" },
        { name: "Streaming", amount: 10, cycle: monthly(1), account: "fixed" },
      ],
    });
    const config = repository.getConfig();
    expect(config.settings.transfers[0]?.amount).toBe(300);
    expect(config.expenses.map((e) => [e.id === keep.id, e.name])).toEqual([
      [true, "Sport plus"],
      [false, "Streaming"],
    ]);
    expect(config.incomes).toHaveLength(1);
  });

  test("replaceConfig with an unknown id changes nothing", () => {
    repository.createExpense({ name: "Sport", amount: 30.5, cycle: monthly(1), account: "fixed" });
    expect(() =>
      repository.replaceConfig({
        settings: { transfers: [{ name: "T", cycle: monthly(25), amount: "auto" }] },
        incomes: [],
        expenses: [{ id: 999, name: "X", amount: 1, cycle: monthly(1), account: "fixed" }],
      }),
    ).toThrow("expenses[0].id");
    expect(repository.listExpenses().map((e) => e.name)).toEqual(["Sport"]);
  });

  test("overview uses active items and the latest balance up to that day", () => {
    repository.createIncome({ name: "Salaris", amount: 500, cycle: monthly(25), main: true });
    repository.createExpense({ name: "Telefoon", amount: 20, cycle: monthly(16), account: "fixed" });
    repository.createExpense({ name: "Oud", amount: 99, cycle: monthly(16), account: "fixed", active: false });
    repository.createBalance({ account: "current", amount: 100, date: "2026-10-25" }, today);
    repository.createBalance({ account: "current", amount: 999, date: "2026-10-30" }, today);
    const o = repository.overview(today);
    expect(o.expenses.map((line) => line.name)).toEqual(["Telefoon"]);
    expect(o.current?.balance).toBe(10000);
    expect(o.fixed).toBeUndefined();
  });

  test("a transfer takes a whole income; that income can't be deleted", () => {
    const bijbaan = repository.createIncome({ name: "Bijbaan", amount: 100, cycle: monthly(20) });
    repository.createExpense({ name: "Huur", amount: 150, cycle: monthly(28), account: "current" });
    expect(() =>
      repository.putSettings({ transfers: [{ name: "X", cycle: monthly(21), amount: { income: 999 } }] }),
    ).toThrow("income 999 does not exist");
    repository.putSettings({
      transfers: [
        { name: "Na bijbaan", cycle: monthly(21), amount: { income: bijbaan.id } },
        { name: "Rest", cycle: monthly(25), amount: "auto" },
      ],
    });
    expect(repository.transfers(today).map((t) => [t.name, t.amount])).toEqual([
      ["Na bijbaan", 10000],
      ["Rest", 5000],
    ]);
    expect(() => repository.deleteIncome(bijbaan.id)).toThrow("linked to a transfer");
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
    const cafe = repository.createCounterparty(
      counterpartyCreate.parse({
        name: "Café",
        ibans: ["nl91 abna 0417 1643 00"],
        names: ["Café Centrum"],
        categoryId: drinks.id,
      }),
    );
    expect(cafe).toMatchObject({ ibans: ["NL91ABNA0417164300"], names: ["café centrum"], handling: "ask" });
    const party = repository.createOuting({ name: "Verjaardag", date: "2026-11-07" });
    const beer = repository.createSpending(
      { description: "Bier", amount: 12.5, counterpartyId: cafe.id, outingId: party.id },
      today,
    );
    expect(beer).toMatchObject({ categoryId: drinks.id, date: "2026-10-25", amount: 12.5 });
    const fries = repository.createSpending(
      { description: "Friet", amount: 8, counterpartyId: cafe.id, categoryId: food.id, outingId: party.id },
      today,
    );
    expect(fries.categoryId).toBe(food.id);
    expect(repository.listSpendings({ outingId: party.id })).toHaveLength(2);
  });

  test("deleting an outing or category keeps its spendings", () => {
    const category = repository.createCategory({ name: "Tijdelijk" });
    const outing = repository.createOuting({ name: "Kroegavond" });
    const spending = repository.createSpending(
      { description: "Bier", amount: 6, date: "2026-11-03", categoryId: category.id, outingId: outing.id },
      today,
    );
    repository.deleteOuting(outing.id);
    repository.deleteCategory(category.id);
    expect(repository.getSpending(spending.id)).toMatchObject({ outingId: null, categoryId: null });
  });

  test("unknown references and duplicates are rejected", () => {
    expect(() => repository.createSpending({ description: "X", amount: 1, outingId: 99 }, today)).toThrow("outingId");
    expect(() => repository.createCategory({ name: "Eten" })).toThrow("already exists");
    const a = repository.createCounterparty({ name: "A", ibans: ["NL91ABNA0417164300"], names: ["shop"] });
    expect(() => repository.createCounterparty({ name: "B", ibans: ["NL91ABNA0417164300"] })).toThrow("hoort al bij A");
    expect(() => repository.createCounterparty({ name: "B", names: ["shop"] })).toThrow("hoort al bij A");
    expect(repository.listCounterparties().map((c) => c.name)).toEqual(["A"]);
    // Replacing its own aliases is fine; omitted kinds stay.
    expect(repository.updateCounterparty(a.id, { names: ["shop", "shop 2"] })).toMatchObject({
      ibans: ["NL91ABNA0417164300"],
      names: ["shop", "shop 2"],
    });
    repository.deleteCounterparty(a.id);
    expect(repository.createCounterparty({ name: "B", names: ["shop"] }).names).toEqual(["shop"]);
  });

  test("bookings: lines become a spending or are skipped, once", () => {
    const line = (key: string, amount: number) => ({ key, date: "2026-11-01", amount });
    const [beer, gym] = repository.book(
      [
        { lines: [line("a", -3.5), line("b", -2)], spending: { description: "Bier", amount: 5.5, date: "2026-10-31" } },
        { lines: [line("c", -30)], skip: "Vaste lasten" },
      ],
      today,
    );
    expect(beer).toMatchObject({ amount: 5.5, date: "2026-10-31" });
    expect(gym).toBeNull();
    expect(repository.listBookedLines({ from: "2026-11-01" })).toEqual([
      { key: "a", date: "2026-11-01", amount: -3.5, spendingId: beer!.id, skip: null },
      { key: "b", date: "2026-11-01", amount: -2, spendingId: beer!.id, skip: null },
      { key: "c", date: "2026-11-01", amount: -30, spendingId: null, skip: "Vaste lasten" },
    ]);

    // All or nothing: one booked line rejects the whole batch.
    expect(() =>
      repository.book(
        [
          { lines: [line("d", -1)], skip: "x" },
          { lines: [line("a", -3.5)], skip: "x" },
        ],
        today,
      ),
    ).toThrow("Al geboekt: a");
    expect(() => repository.book([{ lines: [line("d", -1)], spending: { description: "X", amount: 1, outingId: 99 } }], today)).toThrow(
      "outingId",
    );
    expect(repository.listBookedLines().map((l) => l.key)).toEqual(["a", "b", "c"]);

    // Deleting the spending frees its lines; a skip is undone directly.
    expect(() => repository.deleteBookedLine("a")).toThrow("spending");
    repository.deleteSpending(beer!.id);
    repository.deleteBookedLine("c");
    expect(repository.listBookedLines()).toEqual([]);
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

  test("spendings keep their time, latest first within a day, unknown time last", () => {
    for (const time of ["19:47", null, "23:02", undefined]) {
      repository.createSpending({ description: String(time), amount: 1, date: "2026-11-01", time }, today);
    }
    const created = repository.createSpending({ description: "x", amount: 1, date: "2026-11-02", time: "08:15" }, today);
    expect(repository.updateSpending(created.id, { time: null }).time).toBeNull();
    expect(repository.listSpendings({ to: "2026-11-01" }).map((s) => s.time)).toEqual(["23:02", "19:47", null, null]);
  });
});
