import { describe, expect, test } from "bun:test";
import { planChanges, reconcile, type Change, type PlanLine } from "./balances";
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

const oneOffIncome = (date: string, time: string | null, amount: number): Change => ({
  day: d(date),
  time,
  name: "Oude fiets verkocht",
  amount,
  kind: "oneOffIncome",
});

describe("reconcile", () => {
  test("one-off incomes add to the balance, ordered by time against a checkpoint that day", () => {
    const result = reconcile(
      [
        { id: 1, day: d("2026-10-01"), time: null, amount: 10000 },
        { id: 2, day: d("2026-10-02"), time: "12:00", amount: 13500 },
      ],
      [
        oneOffIncome("2026-10-01", "23:00", 999),
        oneOffIncome("2026-10-02", null, 4000),
        spending("2026-10-02", "11:00", 500),
        oneOffIncome("2026-10-02", "11:30", 1000),
        oneOffIncome("2026-10-02", "12:30", 2500),
      ],
      d("2026-10-01"),
      d("2026-10-02"),
    );
    // The income at 23:00 on the day of the first checkpoint (end of day) is before it, so already in it.
    expect(result.checkpoints.map((c) => [c.expected, c.difference])).toEqual([
      [null, null],
      [14500, -1000],
    ]);
    expect(result.since.map((c) => [c.time, c.amount, c.kind])).toEqual([["12:30", 2500, "oneOffIncome"]]);
    expect(result.expected).toBe(16000);
  });


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

  test("bounds: the refund before from is left out, the payment on from counts, nothing after until", () => {
    const bounded: PlanInput = {
      ...input,
      expenses: [{ ...input.expenses[0], from: d("2026-10-10"), until: d("2026-11-09") }],
    };
    const current = (after: string, until: string) =>
      planChanges(bounded, "current", d(after), d(until))
        .filter((c) => c.kind === "refund" || c.kind === "expense")
        .map((c) => [c.kind, c.day]);
    expect(current("2026-10-01", "2026-10-31")).toEqual([["expense", d("2026-10-10")]]);
    expect(current("2026-11-01", "2026-12-31")).toEqual([["refund", d("2026-11-09")]]);
    expect(
      planChanges(bounded, "fixed", d("2026-10-01"), d("2026-12-31"))
        .filter((c) => c.kind === "refund")
        .map((c) => c.day),
    ).toEqual([d("2026-11-09")]);
  });

  test("fixed-costs account: transfer in, money back out", () => {
    const changes = planChanges(input, "fixed", after, until);
    expect(changes.map((c) => [c.kind, c.amount]).sort()).toEqual([
      ["refund", -2000],
      ["transfer", 2000],
    ]);
  });

  const line = (
    date: string,
    amount: number,
    link: PlanLine["link"],
    name = "Regel",
  ): PlanLine => ({
    day: d(date),
    amount,
    name,
    link,
  });

  test("a linked occurrence is replaced by its lines: real day and amount, planned ones stay", () => {
    const lines = [
      // Telefoon due 10-10, paid in two lines (one on another day).
      line(
        "2026-10-11",
        -1900,
        { kind: "expense", expenseId: 1, day: d("2026-10-10") },
        "Telefoon",
      ),
      line(
        "2026-10-12",
        -80,
        { kind: "expense", expenseId: 1, day: d("2026-10-10") },
        "Telefoon",
      ),
      // Salaris of 25-09 (outside the range) arrived late: counts at its real day.
      line(
        "2026-10-02",
        50000,
        { kind: "income", incomeId: 7, day: d("2026-09-25") },
        "Salaris",
      ),
      // Salaris of 25-10 paid after the range: the planned one still goes.
      line(
        "2026-11-02",
        50100,
        { kind: "income", incomeId: 7, day: d("2026-10-25") },
        "Salaris",
      ),
      line("2026-10-15", -500, { kind: "fixed" }, "Vaste lastenrekening"),
    ];
    const changes = planChanges(
      { ...input, incomes: [{ ...input.incomes[0], id: 7 }] },
      "current",
      after,
      until,
      lines,
    );
    expect(
      changes.map((c) => [
        c.kind,
        c.day,
        c.amount,
        c.planned ?? false,
        c.plan ?? null,
      ]),
    ).toEqual([
      ["refund", d("2026-10-09"), 2000, true, null],
      ["transfer", d("2026-10-26"), -2000, true, null],
      [
        "expense",
        d("2026-10-11"),
        -1900,
        false,
        { day: d("2026-10-10"), amount: -2000, real: -1980 },
      ],
      [
        "expense",
        d("2026-10-12"),
        -80,
        false,
        { day: d("2026-10-10"), amount: -2000, real: -1980 },
      ],
      [
        "income",
        d("2026-10-02"),
        50000,
        false,
        { day: d("2026-09-25"), amount: 50000, real: 50000 },
      ],
      ["unplannedTransfer", d("2026-10-15"), -500, false, null],
    ]);
  });

  test("fixed-costs account: linked transfers and refunds the other way round, charges stay planned", () => {
    const fixedInput: PlanInput = {
      ...input,
      expenses: [
        ...input.expenses,
        {
          id: 2,
          name: "Verzekering",
          amount: 3000,
          cycle: { type: "monthly", day: 5 },
          account: "fixed",
        },
      ],
    };
    const lines = [
      line("2026-10-27", -2000, {
        kind: "transfer",
        transfer: "Naar vaste lasten",
        day: d("2026-10-26"),
      }),
      line("2026-10-09", 2000, {
        kind: "refund",
        expenseId: 1,
        day: d("2026-10-09"),
      }),
      line("2026-10-20", 700, { kind: "fixed" }),
      line("2026-10-10", -2000, {
        kind: "expense",
        expenseId: 1,
        day: d("2026-10-10"),
      }),
    ];
    const changes = planChanges(fixedInput, "fixed", after, until, lines);
    expect(
      changes.map((c) => [c.kind, c.day, c.amount, c.planned ?? false]),
    ).toEqual([
      ["charge", d("2026-10-05"), -3000, true],
      ["transfer", d("2026-10-27"), 2000, false],
      ["refund", d("2026-10-09"), -2000, false],
      ["unplannedTransfer", d("2026-10-20"), -700, false],
    ]);
    expect(changes[1].plan).toEqual({
      day: d("2026-10-26"),
      amount: 2000,
      real: 2000,
    });
  });

  test("each checkpoint lists the changes since the one before", () => {
    const result = reconcile(
      [
        { id: 1, day: d("2026-10-01"), time: null, amount: 10000 },
        { id: 2, day: d("2026-10-31"), time: null, amount: 0 },
      ],
      planChanges(input, "current", d("2026-09-30"), until),
      d("2026-10-01"),
      until,
    );
    expect(result.checkpoints[0].changes).toEqual([]);
    expect(
      result.checkpoints[1].changes.map((c) => [c.kind, c.planned]),
    ).toEqual([
      ["refund", true],
      ["expense", true],
      ["income", true],
      ["transfer", true],
    ]);
    expect(result.checkpoints[1].difference).toBe(
      -10000 - 2000 - 50000 + 2000 + 2000,
    );
  });
});
