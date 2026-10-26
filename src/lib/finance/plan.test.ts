import { describe, expect, test } from "bun:test";
import { parseDay } from "./dates";
import { buildOverview, reserveNeeded, type PlanInput } from "./plan";

describe("reserveNeeded", () => {
  test("nothing needed when the next transfer comes before the charge", () => {
    expect(reserveNeeded([30], [10], 100, 100)).toBe(0);
  });
  test("full amount needed when the charge comes before the next transfer", () => {
    expect(reserveNeeded([10, 40], [30], 100, 100)).toBe(100);
  });
  test("a charge on a transfer day is paid before the transfer arrives", () => {
    expect(reserveNeeded([10], [10], 100, 100)).toBe(100);
  });
});

const input: PlanInput = {
  incomes: [
    { name: "Toeslag", amount: 10000, cycle: { type: "monthly", day: 20 }, main: false },
    { name: "DUO", amount: 50000, cycle: { type: "monthly", day: 24 }, main: true },
  ],
  transfer: { cycle: { type: "monthly", day: 24 }, amount: "auto" },
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
    expect(o.transfer.amount).toBe(4000);
    expect(o.warnings).toEqual([]);
  });

  test("upcoming lists every kind of movement", () => {
    const o = buildOverview(input, today, { window: 31 });
    expect(o.upcoming.map((m) => `${m.kind}:${m.name}`)).toEqual([
      "refund:Kapper",
      "charge:Telefoon",
      "income:Toeslag",
      "income:DUO",
      "transfer:Overboeking naar vaste lasten",
    ]);
  });

  test("free money runs until the next main income", () => {
    const o = buildOverview(input, today, { window: 31, current: { amount: 30000, date: today } });
    expect(o.current?.periodEnd).toBe(parseDay("2026-11-24"));
    expect(o.current?.additions.map((m) => m.name)).toEqual(["Toeslag"]);
    expect(o.current?.free).toBe(40000);
    expect(o.current?.daysLeft).toBe(30);
  });

  test("an older current balance counts the incomes and transfers since then", () => {
    const o = buildOverview(input, today, { window: 31, current: { amount: 1000, date: parseDay("2026-10-23") } });
    // + DUO (24 Oct) + Toeslag (20 Nov) − transfer (24 Oct)
    expect(o.current?.free).toBe(1000 + 50000 + 10000 - 4000);
  });

  test("an older fixed balance is projected to today", () => {
    const o = buildOverview(input, today, { window: 31, fixed: { amount: 3000, date: parseDay("2026-10-15") } });
    // − Telefoon (16 Oct) + transfer (24 Oct)
    expect(o.fixed?.expected).toBe(3000 - 2000 + 4000);
    expect(o.fixed?.difference).toBe(5000 - 7000);
  });

  test("a fixed transfer below the need warns", () => {
    const o = buildOverview({ ...input, transfer: { ...input.transfer, amount: 1000 } }, today, { window: 0 });
    expect(o.warnings).toHaveLength(1);
  });

  test("works without anything defined", () => {
    const o = buildOverview({ ...input, incomes: [], expenses: [] }, today, {
      window: 31,
      current: { amount: 500, date: today },
    });
    expect(o.target).toBe(0);
    expect(o.transfer.amount).toBe(0);
    expect(o.current?.free).toBe(500);
    expect(o.current?.periodEnd).toBeUndefined();
  });
});
