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
      scenarioIds: null,
      note: null,
    });
  });

  test("scenarios: the overview only uses items of the real one", () => {
    const [real] = repository.listScenarios();
    expect(real).toMatchObject({ name: "Huidig", real: true });
    const other = repository.createScenario({ name: "Ander huis" });
    repository.createIncome({ name: "Salaris", amount: 500, cycle: monthly(25), main: true });
    repository.createExpense({ name: "Sport", amount: 30, cycle: monthly(1), account: "current" });
    repository.createExpense({ name: "Hier", amount: 50, cycle: monthly(1), account: "current", scenarioIds: [real.id] });
    repository.createExpense({ name: "Daar", amount: 400, cycle: monthly(1), account: "current", scenarioIds: [other.id] });
    expect(repository.overview(today).expenses.map((line) => line.name).sort()).toEqual(["Hier", "Sport"]);

    repository.updateScenario(other.id, { real: true });
    expect(repository.realScenarioId()).toBe(other.id);
    expect(repository.overview(today).expenses.map((line) => line.name).sort()).toEqual(["Daar", "Sport"]);
    expect(() => repository.updateScenario(other.id, { real: false })).toThrow(HttpError);
    expect(() => repository.deleteScenario(other.id)).toThrow(HttpError);
  });

  test("deleting a scenario deletes its own items, others lose it", () => {
    const [real] = repository.listScenarios();
    const other = repository.createScenario({ name: "Ander huis" });
    const only = repository.createExpense({ name: "Daar", amount: 400, cycle: monthly(1), account: "current", scenarioIds: [other.id] });
    const both = repository.createExpense({
      name: "Beide",
      amount: 10,
      cycle: monthly(1),
      account: "current",
      scenarioIds: [real.id, other.id],
    });
    expect(() => repository.createExpense({ name: "X", amount: 1, cycle: monthly(1), account: "current", scenarioIds: [99] })).toThrow(
      HttpError,
    );
    repository.deleteScenario(other.id);
    expect(() => repository.getExpense(only.id)).toThrow(HttpError);
    expect(repository.getExpense(both.id).scenarioIds).toEqual([real.id]);
    expect(repository.listScenarios()).toHaveLength(1);
  });

  test("savings accounts: first checkpoint, latest one is the balance, deleted with the account", () => {
    const [real] = repository.listScenarios();
    const account = repository.createSavingsAccount(
      {
        name: "Studie",
        until: "2027-06",
        withdrawals: [{ name: "Fee", amount: 200, date: "2027-01-01" }],
        scenarioIds: [real.id],
        balance: { amount: 1000, date: "2026-10-01" },
      },
      today,
    );
    expect(account).toMatchObject({ name: "Studie", until: "2027-06", balance: { amount: 1000, date: "2026-10-01", time: null } });
    repository.createBalance({ account: "savings", savingsAccountId: account.id, amount: 900, date: "2026-10-20" }, today);
    expect(repository.getSavingsAccount(account.id).balance?.amount).toBe(900);
    expect(() =>
      repository.createBalance({ account: "savings", savingsAccountId: 99, amount: 1 }, today),
    ).toThrow(HttpError);
    repository.deleteSavingsAccount(account.id);
    expect(repository.listSavingsAccounts()).toEqual([]);
    expect(repository.listBalances({ account: "savings" })).toEqual([]);
  });

  test("checkpoints can't be in the future", () => {
    expect(() => repository.createBalance({ account: "current", amount: 1, date: "2026-10-26" }, today)).toThrow(HttpError);
  });

  test("reconcile the current account: plan, spendings and the checkpoint before", () => {
    repository.createIncome({ name: "Salaris", amount: 500, cycle: monthly(20), main: true });
    repository.createSpending({ date: "2026-10-21", time: "13:00", amount: 30, description: "Lunch" }, today);
    repository.createSpending({ date: "2026-10-21", time: "20:00", amount: 10, description: "Drinken" }, today);
    repository.createBalance({ account: "current", amount: 100, date: "2026-10-19" }, today);
    repository.createBalance({ account: "current", amount: 560, date: "2026-10-21", time: "18:00" }, today);
    const result = repository.reconcile("current", null, parseDay("2026-10-18"), today);
    expect(result.checkpoints.map((c) => [c.amount, c.expected])).toEqual([
      [10000, null],
      [56000, 57000],
    ]);
    expect(result.expected).toBe(55000);
    expect(result.days[0]?.balance).toBeNull();
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
    repository.createBalance({ account: "current", amount: 999, date: "2026-10-30" }, parseDay("2026-10-30"));
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
      { key: "a", date: "2026-11-01", amount: -3.5, spendingId: beer!.id, oneOffIncomeId: null, skip: null },
      { key: "b", date: "2026-11-01", amount: -2, spendingId: beer!.id, oneOffIncomeId: null, skip: null },
      { key: "c", date: "2026-11-01", amount: -30, spendingId: null, oneOffIncomeId: null, skip: "Vaste lasten" },
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

  test("bookings: lines can become a one-off income; deleting it frees them", () => {
    const buyer = repository.createCounterparty({ name: "Koper", handling: "income" });
    const line = (key: string, amount: number) => ({ key, date: "2026-11-02", amount });
    const [bike, beer] = repository.book(
      [
        {
          lines: [line("a", 40)],
          income: { description: "Oude fiets verkocht", amount: 40, date: "2026-11-02", time: "10:15", counterpartyId: buyer.id },
        },
        { lines: [line("b", -4)], spending: { description: "Bier", amount: 4 } },
      ],
      today,
    );
    expect(bike).toEqual({
      id: bike!.id,
      date: "2026-11-02",
      time: "10:15",
      amount: 40,
      description: "Oude fiets verkocht",
      counterpartyId: buyer.id,
      note: null,
    });
    expect(beer).toMatchObject({ amount: 4, description: "Bier" });
    expect(repository.listSpendings()).toHaveLength(1);
    expect(repository.listBookedLines()[0]).toEqual({
      key: "a",
      date: "2026-11-02",
      amount: 40,
      spendingId: null,
      oneOffIncomeId: bike!.id,
      skip: null,
    });

    // All or nothing: a bad reference in an income rejects the whole batch.
    expect(() =>
      repository.book(
        [
          { lines: [line("c", 1)], skip: "x" },
          { lines: [line("d", 25)], income: { description: "Bijdrage boodschappen", amount: 25, counterpartyId: 99 } },
        ],
        today,
      ),
    ).toThrow("[1].income.counterpartyId");
    expect(repository.listBookedLines().map((l) => l.key)).toEqual(["a", "b"]);

    expect(() => repository.deleteBookedLine("a")).toThrow("one-off income");
    repository.deleteOneOffIncome(bike!.id);
    expect(repository.listBookedLines().map((l) => l.key)).toEqual(["b"]);
    expect(() => repository.getOneOffIncome(bike!.id)).toThrow(HttpError);
  });

  test("one-off incomes: crud, filters, order and counterparty delete", () => {
    const family = repository.createCounterparty({ name: "Familie" });
    const a = repository.createOneOffIncome({ description: "Bijdrage boodschappen", amount: 25, counterpartyId: family.id }, today);
    expect(a).toMatchObject({ date: "2026-10-25", time: null, amount: 25, note: null });
    repository.createOneOffIncome({ description: "Oude fiets verkocht", amount: 40.5, date: "2026-10-25", time: "09:00" }, today);
    repository.createOneOffIncome({ description: "Boek verkocht", amount: 7, date: "2026-11-01" }, today);
    expect(repository.listOneOffIncomes({ to: "2026-10-31" }).map((i) => i.description)).toEqual([
      "Oude fiets verkocht",
      "Bijdrage boodschappen",
    ]);
    expect(repository.listOneOffIncomes({ counterpartyId: family.id }).map((i) => i.id)).toEqual([a.id]);
    expect(repository.updateOneOffIncome(a.id, { amount: 30, note: "Voor de week" })).toMatchObject({ amount: 30, note: "Voor de week" });
    expect(() => repository.updateOneOffIncome(a.id, { counterpartyId: 99 })).toThrow("counterpartyId");
    repository.deleteCounterparty(family.id);
    expect(repository.getOneOffIncome(a.id).counterpartyId).toBeNull();
    expect(() => repository.deleteOneOffIncome(999)).toThrow(HttpError);
  });

  test("reconcile the current account: one-off incomes before and after a checkpoint", () => {
    repository.createBalance({ account: "current", amount: 100, date: "2026-10-19" }, today);
    repository.createOneOffIncome({ date: "2026-10-20", amount: 40, description: "Oude fiets verkocht" }, today);
    repository.createSpending({ date: "2026-10-21", time: "12:00", amount: 10, description: "Lunch" }, today);
    repository.createOneOffIncome({ date: "2026-10-21", time: "17:00", amount: 5, description: "Boek verkocht" }, today);
    repository.createBalance({ account: "current", amount: 135, date: "2026-10-21", time: "18:00" }, today);
    repository.createOneOffIncome({ date: "2026-10-21", time: "19:00", amount: 25, description: "Bijdrage boodschappen" }, today);
    const result = repository.reconcile("current", null, parseDay("2026-10-19"), today);
    expect(result.checkpoints.map((c) => [c.amount, c.expected])).toEqual([
      [10000, null],
      [13500, 13500],
    ]);
    expect(result.since).toEqual([
      { day: parseDay("2026-10-21"), time: "19:00", name: "Bijdrage boodschappen", amount: 2500, kind: "oneOffIncome" },
    ]);
    expect(result.expected).toBe(16000);
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
