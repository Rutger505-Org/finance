import { describe, expect, test } from "bun:test";
import { planChanges, reconcile, type Change } from "./balances";
import { parseDay } from "./dates";
import type { PlanInput } from "./plan";

const d = parseDay;
const spending = (date: string, time: string | null, amount: number): Change => ({
  day: d(date),
  time,
  name: "Snack",
  amount: -amount,
  kind: "spending",
});

describe("reconcile", () => {
  test("compares each checkpoint with the one before plus the changes in between", () => {
    const result = reconcile(
      [
        { id: 1, day: d("2026-10-01"), time: null, amount: 10000 },
        { id: 2, day: d("2026-10-03"), time: null, amount: 8000 },
      ],
      [spending("2026-10-01", "12:00", 500), spending("2026-10-02", null, 1500), spending("2026-10-04", null, 1000)],
      d("2026-09-30"),
      d("2026-10-04"),
    );
    expect(result.checkpoints.map((c) => [c.expected, c.difference])).toEqual([
      [null, null],
      [8500, -500],
    ]);
    expect(result.days.map((day) => day.balance)).toEqual([null, 10000, 8500, 8000, 7000]);
    expect(result.expected).toBe(7000);
    expect(result.since).toHaveLength(1);
  });

  test("a checkpoint with a time comes before later spendings that day", () => {
    const result = reconcile(
      [{ id: 1, day: d("2026-10-01"), time: "18:00", amount: 10000 }],
      [spending("2026-10-01", "12:00", 100), spending("2026-10-01", null, 200), spending("2026-10-01", "21:30", 300)],
      d("2026-10-01"),
      d("2026-10-01"),
    );
    expect(result.expected).toBe(9700);
    expect(result.since.map((c) => c.amount)).toEqual([-300]);
  });

  test("checkpoints after `until` are ignored", () => {
    const result = reconcile(
      [{ id: 1, day: d("2026-10-05"), time: null, amount: 100 }],
      [],
      d("2026-10-01"),
      d("2026-10-02"),
    );
    expect(result.expected).toBeNull();
    expect(result.checkpoints).toEqual([]);
  });
});

describe("planChanges", () => {
  const input: PlanInput = {
    incomes: [{ id: 1, name: "Salaris", amount: 50000, cycle: { type: "monthly", day: 25 }, main: true }],
    expenses: [{ id: 1, name: "Telefoon", amount: 2000, cycle: { type: "monthly", day: 10 }, account: "current" }],
    transfers: [{ name: "Naar vaste lasten", cycle: { type: "monthly", day: 26 }, amount: 2000 }],
  };
  const after = d("2026-10-01");
  const until = d("2026-10-31");

  test("current account: income, transfer out, money back the day before and the payment itself", () => {
    expect(planChanges(input, "current", after, until).map((c) => [c.kind, c.amount])).toEqual([
      ["refund", 2000],
      ["income", 50000],
      ["transfer", -2000],
      ["expense", -2000],
    ]);
  });

  test("fixed-costs account: transfer in, money back out", () => {
    const changes = planChanges(input, "fixed", after, until);
    expect(changes.map((c) => [c.kind, c.amount]).sort()).toEqual([
      ["refund", -2000],
      ["transfer", 2000],
    ]);
  });
});
