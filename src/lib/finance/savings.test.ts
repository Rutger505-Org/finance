import { describe, expect, test } from "bun:test";
import { parseDay } from "./dates";
import { inScenario, savingsBalance, summarizeSavings } from "./savings";

describe("savings", () => {
  const savings = {
    balance: 5000,
    until: "2027-02",
    withdrawals: [
      { name: "Fee", amount: 1000, date: "2026-09-01" },
      { name: "Paid already", amount: 300, date: "2026-03-10" },
      { name: "After the end", amount: 700, date: "2027-03-01" },
      { name: "Laptop", amount: 600, date: "2026-05-01" },
    ],
  };

  test("spreads what's left after the withdrawals over the months after today", () => {
    const summary = summarizeSavings(savings, parseDay("2026-03-15"));
    expect(summary.withdrawals.map((w) => w.name)).toEqual(["Laptop", "Fee"]);
    expect(summary.reserved).toBe(1600);
    expect(summary.free).toBe(3400);
    expect(summary.months).toBe(11);
    expect(summary.firstMonth).toBe("2026-04");
    expect(summary.perMonth).toBe(309.09);
  });

  test("no months left", () => {
    const summary = summarizeSavings(savings, parseDay("2027-02-01"));
    expect(summary.months).toBe(0);
    expect(summary.perMonth).toBeNull();
    expect(summary.firstMonth).toBeNull();
  });

  test("short: negative free money; withdrawals up to today are history", () => {
    const summary = summarizeSavings({ ...savings, balance: 400 }, parseDay("2026-08-20"));
    expect(summary.withdrawals.map((w) => w.name)).toEqual(["Fee"]);
    expect(summary.free).toBe(-600);
    expect(summary.months).toBe(6);
    expect(summary.perMonth).toBe(-100);
  });

  test("balance: latest checkpoint plus the transfers after it", () => {
    const transfer = (date: string, time: string | null, amount: number) => ({
      id: 1,
      savingsAccountId: 1,
      date,
      time,
      amount,
      description: "Buffer",
      note: null,
    });
    const transfers = [
      transfer("2026-03-09", null, 100), // before the checkpoint
      transfer("2026-03-10", null, 100), // without a time: start of the day, before it
      transfer("2026-03-10", "09:00", 100), // before 10:00
      transfer("2026-03-10", "11:00", 40), // to current: out of savings
      transfer("2026-03-11", null, -25), // to savings
    ];
    expect(savingsBalance({ balance: { amount: 1000, date: "2026-03-10", time: "10:00" }, transfers })).toBe(985);
    // Without a time the checkpoint is the end of the day.
    expect(savingsBalance({ balance: { amount: 1000, date: "2026-03-10", time: null }, transfers })).toBe(1025);
    expect(savingsBalance({ balance: null, transfers })).toBeNull();
  });

  test("items without scenarios are in every scenario", () => {
    const items = [
      { name: "a", scenarioIds: null },
      { name: "b", scenarioIds: [1] },
      { name: "c", scenarioIds: [2, 3] },
    ];
    expect(inScenario(items, 2).map((i) => i.name)).toEqual(["a", "c"]);
    expect(inScenario(items, 1).map((i) => i.name)).toEqual(["a", "b"]);
  });
});
