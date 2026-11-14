import { describe, expect, test } from "bun:test";
import { parseDay } from "./dates";
import { inScenario, summarizeSavings } from "./savings";

describe("savings", () => {
  const savings = {
    balance: 5000,
    date: "2026-03-10",
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

  test("short: negative free money", () => {
    const summary = summarizeSavings({ ...savings, balance: 1000 }, parseDay("2026-12-20"));
    expect(summary.free).toBe(-600);
    expect(summary.months).toBe(2);
    expect(summary.perMonth).toBe(-300);
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
