import { describe, expect, test } from "bun:test";
import {
  labelIndices,
  niceTicks,
  outingTotals,
  recurringOutings,
  scaleLinear,
  trendHref,
  trendStats,
} from "./outing-trend";
import { parseDay } from "./dates";

describe("outing trend", () => {
  test("totals per outing in cents, ignoring unlinked spendings", () => {
    const totals = outingTotals([
      { outingId: 1, amount: 12.5 },
      { outingId: 1, amount: 0.1 },
      { outingId: 1, amount: 0.2 },
      { outingId: 2, amount: -3 },
      { outingId: null, amount: 99 },
    ]);
    expect([...totals]).toEqual([
      [1, 1280],
      [2, -300],
    ]);
  });

  test("groups dated outings by trimmed name, at least two, sorted by day", () => {
    const outings = [
      { id: 1, name: "Quiz Night", date: "2026-03-10" },
      { id: 2, name: " Quiz Night ", date: "2026-01-05" },
      { id: 3, name: "Quiz Night", date: null },
      { id: 4, name: "Board Games", date: "2026-02-01" },
      { id: 5, name: "Board Games", date: null },
      { id: 6, name: "Bowling", date: "2026-02-01" },
      { id: 7, name: "Bowling", date: "2026-04-01" },
      { id: 8, name: "quiz night", date: "2026-05-01" },
    ];
    const groups = recurringOutings(outings, new Map([[1, 2000], [2, 1500]]));
    expect(groups.map((g) => g.name)).toEqual(["Bowling", "Quiz Night"]);
    expect(groups[1].points).toEqual([
      { outingId: 2, day: parseDay("2026-01-05"), total: 1500 },
      { outingId: 1, day: parseDay("2026-03-10"), total: 2000 },
    ]);
    expect(groups[0].points.map((p) => p.total)).toEqual([0, 0]);
  });

  test("stats", () => {
    expect(trendStats([])).toBeNull();
    expect(trendStats([{ total: 1000 }, { total: 2001 }, { total: 1500 }])).toEqual({
      average: 1500,
      min: 1000,
      max: 2001,
    });
  });

  test("ticks start at 0 and cover the max with round steps", () => {
    expect(niceTicks([4321, 1200])).toEqual([0, 1000, 2000, 3000, 4000, 5000]);
    expect(niceTicks([9000])).toEqual([0, 2000, 4000, 6000, 8000, 10000]);
    expect(niceTicks([10000])).toEqual([0, 2000, 4000, 6000, 8000, 10000]);
    expect(niceTicks([0, 0])).toEqual([0, 20, 40, 60, 80, 100]);
    expect(niceTicks([-500, 1500])).toEqual([-500, 0, 500, 1000, 1500]);
  });

  test("linear scale", () => {
    const y = scaleLinear([0, 100], [200, 0]);
    expect(y(0)).toBe(200);
    expect(y(25)).toBe(150);
    expect(scaleLinear([5, 5], [0, 100])(5)).toBe(50);
  });

  test("labels thinned to keep a minimum gap", () => {
    expect(labelIndices([], 10)).toEqual([]);
    expect(labelIndices([0], 10)).toEqual([0]);
    expect(labelIndices([0, 100], 10)).toEqual([0, 1]);
    expect(labelIndices([0, 5], 10)).toEqual([0]);
    expect(labelIndices([0, 5, 12, 20, 25, 33], 10)).toEqual([0, 2, 5]);
  });

  test("href encodes the trimmed name", () => {
    expect(trendHref(" Quiz & Night ")).toBe("/uitgaven/uitjes/verloop?naam=Quiz%20%26%20Night");
  });
});
