import { describe, expect, test } from "bun:test";
import { parseDay } from "./dates";
import { buildOverview, reserveNeeded, resolveTransfers, type PlanInput } from "./plan";

describe("reserveNeeded", () => {
  test("nothing needed when the next transfer comes before the charge", () => {
    expect(reserveNeeded([30], [{ day: 10, share: 100 }], 100)).toBe(0);
  });
  test("full amount needed when the charge comes before the next transfer", () => {
    expect(reserveNeeded([10, 40], [{ day: 30, share: 100 }], 100)).toBe(100);
  });
  test("a charge on a transfer day is paid before the transfer arrives", () => {
    expect(reserveNeeded([10], [{ day: 10, share: 100 }], 100)).toBe(100);
  });
});

const input: PlanInput = {
  incomes: [
    { id: 1, name: "Bijbaan", amount: 10000, cycle: { type: "monthly", day: 20 }, main: false },
    { name: "Salaris", amount: 50000, cycle: { type: "monthly", day: 24 }, main: true },
  ],
  transfers: [{ name: "Overboeking", cycle: { type: "monthly", day: 24 }, amount: "auto" }],
  expenses: [
    { name: "Telefoon", amount: 2000, cycle: { type: "monthly", day: 16 }, account: "fixed" },
    { name: "Domein", amount: 12000, cycle: { type: "yearly", month: 7, day: 1 }, account: "fixed" },
    { name: "Kapper", amount: 1000, cycle: { type: "monthly", day: 1 }, account: "current" },
  ],
};

describe("buildOverview", () => {
  const today = parseDay("2026-10-25");

  test("target is the sum of the envelopes", () => {
    const o = buildOverview(input, today, { window: 31 });
    const reserved = Object.fromEntries(o.expenses.map((line) => [line.name, line.reserved]));
    expect(reserved.Telefoon).toBe(2000);
    // 8 transfers of 10 euro left until 1 July (Nov..Jun), so 40 euro must already be there.
    expect(reserved.Domein).toBe(4000);
    expect(reserved.Kapper).toBe(1000);
    expect(o.target).toBe(7000);
    expect(o.transfers.map((t) => t.amount)).toEqual([4000]);
    expect(o.warnings).toEqual([]);
  });

  test("upcoming lists every kind of movement", () => {
    const o = buildOverview(input, today, { window: 31 });
    expect(o.upcoming.map((m) => `${m.kind}:${m.name}`)).toEqual([
      "refund:Kapper",
      "charge:Telefoon",
      "income:Bijbaan",
      "income:Salaris",
      "transfer:Overboeking",
    ]);
  });

  test("free money runs until the next main income", () => {
    const o = buildOverview(input, today, { window: 31, current: { amount: 30000, date: today } });
    expect(o.current?.periodEnd).toBe(parseDay("2026-11-24"));
    expect(o.current?.additions.map((m) => m.name)).toEqual(["Bijbaan"]);
    expect(o.current?.free).toBe(40000);
    expect(o.current?.daysLeft).toBe(30);
  });

  test("an older current balance counts the incomes and transfers since then", () => {
    const o = buildOverview(input, today, { window: 31, current: { amount: 1000, date: parseDay("2026-10-23") } });
    // + Salaris (24 Oct) + Bijbaan (20 Nov) − transfer (24 Oct)
    expect(o.current?.free).toBe(1000 + 50000 + 10000 - 4000);
  });

  test("an older fixed balance is projected to today", () => {
    const o = buildOverview(input, today, { window: 31, fixed: { amount: 3000, date: parseDay("2026-10-15") } });
    // − Telefoon (16 Oct) + transfer (24 Oct)
    expect(o.fixed?.expected).toBe(3000 - 2000 + 4000);
    expect(o.fixed?.difference).toBe(5000 - 7000);
  });

  test("a fixed transfer below the need warns", () => {
    const o = buildOverview(
      { ...input, transfers: [{ name: "Vast", cycle: { type: "monthly", day: 24 }, amount: 1000 }] },
      today,
      { window: 0 },
    );
    expect(o.warnings).toHaveLength(1);
  });

  test("works without anything defined", () => {
    const o = buildOverview({ ...input, incomes: [], expenses: [] }, today, {
      window: 31,
      current: { amount: 500, date: today },
    });
    expect(o.target).toBe(0);
    expect(o.transfers.map((t) => t.amount)).toEqual([0]);
    expect(o.upcoming).toEqual([]);
    expect(o.current?.free).toBe(500);
    expect(o.current?.periodEnd).toBeUndefined();
  });
});

describe("several transfers", () => {
  const today = parseDay("2026-10-25");
  const split: PlanInput = {
    ...input,
    transfers: [
      { name: "Na bijbaan", cycle: { type: "monthly", day: 21 }, amount: { income: 1 } },
      { name: "Na salaris", cycle: { type: "monthly", day: 25 }, amount: "auto" },
    ],
    // 160 euro per month: more than the side job alone.
    expenses: [{ name: "Huur", amount: 16000, cycle: { type: "monthly", day: 28 }, account: "current" }],
  };

  test("a linked income counts first, auto covers the rest", () => {
    expect(resolveTransfers(split, today).map((t) => [t.name, t.amount, t.source])).toEqual([
      ["Na bijbaan", 10000, "income"],
      ["Na salaris", 6000, "auto"],
    ]);
  });

  test("auto transfers split the rest and round up per transfer", () => {
    const transfers = resolveTransfers(
      {
        ...split,
        transfers: [
          { name: "A", cycle: { type: "monthly", day: 5 }, amount: "auto" },
          { name: "B", cycle: { type: "monthly", day: 25 }, amount: "auto" },
          { name: "C", cycle: { type: "monthly", day: 15 }, amount: 3050 },
        ],
      },
      today,
    );
    // (160 − 30.50) / 2 = 64.75 → 65
    expect(transfers.map((t) => t.amount)).toEqual([6500, 6500, 3050]);
  });

  test("envelopes get their share of every transfer", () => {
    const o = buildOverview(split, today, { window: 31 });
    // Next charge 28 Oct comes before any transfer: the full 160 must be there.
    expect(o.expenses[0]?.reserved).toBe(16000);
    expect(o.transfers.map((t) => t.name)).toEqual(["Na salaris", "Na bijbaan"]);
    expect(o.monthly.transfer).toBe(16000);
    expect(o.warnings).toEqual([]);
    expect(o.upcoming.filter((m) => m.kind === "transfer").map((m) => [m.name, m.amount])).toEqual([
      ["Na salaris", 6000],
      ["Na bijbaan", 10000],
      ["Na salaris", 6000],
    ]);
  });

  test("a charge between two transfers only needs what came in", () => {
    // Charge on the 23rd: the 21st transfer (100 of 160) is in, the 25th not yet.
    const o = buildOverview(
      { ...split, expenses: [{ ...split.expenses[0], cycle: { type: "monthly", day: 23 } }] },
      parseDay("2026-10-24"),
      { window: 0 },
    );
    // From 24 Oct: 25 Oct +60, 21 Nov +100, 23 Nov −160 → nothing needed up front.
    expect(o.expenses[0]?.reserved).toBe(0);
  });

  test("a linked income that is not active gives 0 and a warning", () => {
    const o = buildOverview({ ...split, incomes: split.incomes.filter((i) => i.id !== 1) }, today, { window: 0 });
    expect(o.transfers.find((t) => t.name === "Na bijbaan")?.amount).toBe(0);
    expect(o.transfers.find((t) => t.name === "Na salaris")?.amount).toBe(16000);
    expect(o.warnings).toHaveLength(1);
  });
});
