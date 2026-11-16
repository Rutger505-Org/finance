import { describe, expect, test } from "bun:test";
import {
  bookings,
  categoryPatch,
  configSchema,
  cycleSchema,
  euros,
  formatIssues,
  oneOffIncomeCreate,
  rebook,
  settingsSchema,
} from "./schemas";

describe("schemas", () => {
  test("amounts allow at most 2 decimals", () => {
    expect(euros.safeParse(19.49).success).toBe(true);
    expect(euros.safeParse(0.1 + 0.2).success).toBe(true);
    expect(euros.safeParse(19.495).success).toBe(false);
    expect(euros.safeParse(-1).success).toBe(false);
  });

  test("yearly cycle rejects days that never exist", () => {
    expect(cycleSchema.safeParse({ type: "yearly", month: 2, day: 29 }).success).toBe(true);
    expect(cycleSchema.safeParse({ type: "yearly", month: 2, day: 30 }).success).toBe(false);
    expect(cycleSchema.safeParse({ type: "interval", days: 28, anchor: "2026-02-30" }).success).toBe(false);
  });

  test("issues name the broken field", () => {
    const result = configSchema.safeParse({
      settings: { transfers: [{ name: "T", cycle: { type: "monthly", day: 1 }, amount: "auto" }] },
      incomes: [],
      expenses: [{ name: "X", amount: 1, cycle: { type: "weekly" }, account: "fixed" }],
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(formatIssues(result.error)[0]?.path).toBe("expenses[0].cycle.type");
  });

  test("config rejects two main incomes and duplicate ids", () => {
    const income = { name: "A", amount: 1, cycle: { type: "monthly", day: 1 }, main: true };
    const result = configSchema.safeParse({
      settings: { transfers: [{ name: "T", cycle: { type: "monthly", day: 1 }, amount: "auto" }] },
      incomes: [
        { ...income, id: 1 },
        { ...income, id: 1 },
      ],
      expenses: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatIssues(result.error).map((issue) => issue.path)).toEqual(["incomes[1].id", "incomes"]);
    }
  });

  test("a transfer can only link an income in the same config", () => {
    const income = { id: 1, name: "A", amount: 1, cycle: { type: "monthly", day: 1 } };
    const config = (incomeId: number) => ({
      settings: { transfers: [{ name: "T", cycle: { type: "monthly", day: 2 }, amount: { income: incomeId } }] },
      incomes: [income],
      expenses: [],
    });
    expect(configSchema.safeParse(config(1)).success).toBe(true);
    const result = configSchema.safeParse(config(2));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatIssues(result.error)[0]?.path).toBe("settings.transfers[0].amount.income");
    }
  });

  test("one-off incomes are positive; a booking takes one instead of a spending", () => {
    expect(oneOffIncomeCreate.safeParse({ description: "Oude fiets verkocht", amount: 40 }).success).toBe(true);
    expect(oneOffIncomeCreate.safeParse({ description: "Oude fiets verkocht", amount: 0 }).success).toBe(false);
    expect(oneOffIncomeCreate.safeParse({ description: "Oude fiets verkocht", amount: -40 }).success).toBe(false);
    const line = { key: "k", date: "2026-11-02", amount: 25 };
    const income = { description: "Bijdrage boodschappen", amount: 25 };
    expect(bookings.safeParse([{ lines: [line], income }]).success).toBe(true);
    expect(bookings.safeParse([{ lines: [line], income, skip: "x" }]).success).toBe(false);
  });

  test("plan bookings, rebook without lines, unique transfer names, category excluded", () => {
    const line = { key: "k", date: "2026-11-02", amount: -20 };
    expect(
      bookings.safeParse([
        {
          lines: [line],
          plan: { kind: "expense", expenseId: 1, date: "2026-11-02" },
        },
      ]).success,
    ).toBe(true);
    expect(
      bookings.safeParse([{ lines: [line], plan: { kind: "fixed" } }]).success,
    ).toBe(true);
    expect(
      bookings.safeParse([
        { lines: [line], plan: { kind: "fixed", date: "2026-11-02" } },
      ]).success,
    ).toBe(false);
    expect(
      bookings.safeParse([
        { lines: [line], plan: { kind: "transfer", date: "2026-11-02" } },
      ]).success,
    ).toBe(false);
    expect(
      rebook.safeParse({ keys: ["k"], booking: { plan: { kind: "fixed" } } })
        .success,
    ).toBe(true);
    expect(
      rebook.safeParse({
        keys: ["k"],
        booking: { lines: [line], plan: { kind: "fixed" } },
      }).success,
    ).toBe(false);
    expect(
      rebook.safeParse({
        keys: ["k", "k"],
        booking: { plan: { kind: "fixed" } },
      }).success,
    ).toBe(false);
    expect(
      rebook.safeParse({ keys: ["k"], booking: { skip: "x" } }).success,
    ).toBe(false);
    const transfer = {
      name: "T",
      cycle: { type: "monthly", day: 1 },
      amount: "auto",
    };
    expect(
      settingsSchema.safeParse({ transfers: [transfer, transfer] }).success,
    ).toBe(false);
    expect(categoryPatch.safeParse({ excluded: true }).success).toBe(true);
  });
});
