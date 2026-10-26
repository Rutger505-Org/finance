import { describe, expect, test } from "bun:test";
import { configSchema, cycleSchema, euros, formatIssues } from "./schemas";

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
      settings: { transfer: { cycle: { type: "monthly", day: 1 }, amount: "auto" } },
      incomes: [],
      expenses: [{ name: "X", amount: 1, cycle: { type: "weekly" }, account: "fixed" }],
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(formatIssues(result.error)[0]?.path).toBe("expenses[0].cycle.type");
  });

  test("config rejects two main incomes and duplicate ids", () => {
    const income = { name: "A", amount: 1, cycle: { type: "monthly", day: 1 }, main: true };
    const result = configSchema.safeParse({
      settings: { transfer: { cycle: { type: "monthly", day: 1 }, amount: "auto" } },
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
});
