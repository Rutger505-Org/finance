import { describe, expect, test } from "bun:test";
import { isoDay, parseDay } from "./dates";
import {
  busiestWeekday,
  daysSinceLastSpending,
  lastOutings,
  monthComparison,
  mostExpensiveDay,
  mostExpensiveOuting,
  mostVisitedCounterparty,
  startOfMonth,
  startOfWeek,
  toInsightSpending,
  topTotals,
  weekday,
  weeklyTotals,
  type InsightSpending,
} from "./insights";

const line = (date: string, amount: number, extra: Partial<InsightSpending> = {}): InsightSpending => ({
  day: parseDay(date),
  amount,
  categoryId: null,
  counterpartyId: null,
  outingId: null,
  ...extra,
});

describe("insights", () => {
  test("converts repository spendings to cents", () => {
    expect(
      toInsightSpending({ date: "2026-03-10", amount: 12.5, categoryId: 1, counterpartyId: null, outingId: 2 }),
    ).toEqual({ day: parseDay("2026-03-10"), amount: 1250, categoryId: 1, counterpartyId: null, outingId: 2 });
    expect(toInsightSpending({ date: "2026-03-10", amount: 0.29, categoryId: null, counterpartyId: null, outingId: null }).amount).toBe(29);
  });

  test("month and week starts", () => {
    expect(isoDay(startOfMonth(parseDay("2026-03-17")))).toBe("2026-03-01");
    // 2026-03-16 is a Monday.
    expect(isoDay(startOfWeek(parseDay("2026-03-16")))).toBe("2026-03-16");
    expect(isoDay(startOfWeek(parseDay("2026-03-22")))).toBe("2026-03-16");
    expect(weekday(parseDay("2026-03-22"))).toBe(6);
    expect(isoDay(startOfWeek(parseDay("1970-01-01")))).toBe("1969-12-29");
  });

  test("this month vs the same point last month, refunds net", () => {
    const spendings = [
      line("2026-02-02", 1000),
      line("2026-02-10", 500),
      line("2026-02-20", 2000),
      line("2026-03-01", 1250),
      line("2026-03-05", -250),
      line("2026-03-11", 9999), // after today
    ];
    const c = monthComparison(spendings, parseDay("2026-03-10"));
    expect(c.total).toBe(1000);
    expect(c.lastMonthSoFar).toBe(1500);
    expect(c.lastMonthTotal).toBe(3500);
    expect(c.dailyAverage).toBe(100);
    expect(c.current).toHaveLength(10);
    expect(c.current[0]).toEqual({ x: 1, value: 1250 });
    expect(c.current[4]).toEqual({ x: 5, value: 1000 });
    expect(c.previous).toHaveLength(28);
    expect(c.previous.at(-1)).toEqual({ x: 28, value: 3500 });
  });

  test("last month shorter than today's day of month counts in full", () => {
    const c = monthComparison([line("2026-02-28", 700), line("2026-03-31", 100)], parseDay("2026-03-31"));
    expect(c.lastMonthSoFar).toBe(700);
    expect(c.total).toBe(100);
  });

  test("weekly totals, Monday to Sunday, oldest first", () => {
    const today = parseDay("2026-03-18"); // Wednesday
    const weeks = weeklyTotals(
      [line("2026-03-01", 300), line("2026-03-09", 100), line("2026-03-15", 200), line("2026-03-16", 50), line("2026-03-19", 999)],
      today,
      3,
    );
    expect(weeks.map((w) => isoDay(w.start))).toEqual(["2026-03-02", "2026-03-09", "2026-03-16"]);
    expect(weeks.map((w) => w.total)).toEqual([0, 300, 50]);
  });

  test("top totals with share of the net total", () => {
    const lines = [
      line("2026-03-01", 3000, { categoryId: 1, counterpartyId: 7 }),
      line("2026-03-02", 1000, { categoryId: 2, counterpartyId: 7 }),
      line("2026-03-03", 1000, { categoryId: null }),
      line("2026-03-04", -1000, { categoryId: 2 }),
    ];
    expect(topTotals(lines, "categoryId")).toEqual([
      { id: 1, amount: 3000, count: 1, share: 0.75 },
      { id: null, amount: 1000, count: 1, share: 0.25 },
    ]);
    expect(topTotals(lines, "counterpartyId", 5, true)).toEqual([{ id: 7, amount: 4000, count: 2, share: 1 }]);
    expect(topTotals(lines, "categoryId", 1)).toHaveLength(1);
    expect(topTotals([line("2026-03-01", -500, { categoryId: 1 })], "categoryId")).toEqual([]);
  });

  test("last outings and the most expensive one", () => {
    const outings = [
      { id: 1, name: "Quiz Night", date: "2026-03-01" },
      { id: 2, name: "Bowling", date: "2026-03-20" },
      { id: 3, name: "Board Games", date: null },
      { id: 4, name: "Quiz Night", date: "2026-03-08" },
    ];
    const totals = new Map([
      [1, 1250],
      [2, 9000],
      [3, 4000],
    ]);
    const last = lastOutings(outings, totals, parseDay("2026-03-10"));
    expect(last.map((o) => [o.id, o.total])).toEqual([
      [4, 0],
      [1, 1250],
    ]);
    expect(mostExpensiveOuting(outings, totals)).toMatchObject({ id: 2, total: 9000 });
    expect(mostExpensiveOuting(outings, new Map())).toBeNull();
  });

  test("weetjes", () => {
    const spendings = [
      line("2026-03-02", 1000, { counterpartyId: 1 }),
      line("2026-03-02", 1500, { counterpartyId: 2 }),
      line("2026-03-03", 2500, { counterpartyId: 2 }),
      line("2026-03-04", 300, { counterpartyId: 1 }),
      line("2026-03-05", -200, { counterpartyId: 3 }),
      line("2025-12-30", 99_00, { counterpartyId: 3 }),
    ];
    expect(mostExpensiveDay(spendings)).toEqual({ day: parseDay("2025-12-30"), total: 9900 });
    expect(mostExpensiveDay(spendings.slice(0, 5))).toEqual({ day: parseDay("2026-03-02"), total: 2500 });
    expect(mostExpensiveDay([])).toBeNull();
    expect(daysSinceLastSpending(spendings, parseDay("2026-03-10"))).toBe(6);
    expect(daysSinceLastSpending([line("2026-03-05", -200)], parseDay("2026-03-10"))).toBeNull();
    // Tie on count (2 each): most spent wins; money back doesn't count as a visit.
    expect(mostVisitedCounterparty(spendings, parseDay("2026-01-01"), parseDay("2026-12-31"))).toEqual({
      id: 2,
      count: 2,
      amount: 4000,
    });
    expect(mostVisitedCounterparty([], 0, 100)).toBeNull();
    // 2025-12-30 is a Tuesday.
    expect(busiestWeekday(spendings)).toEqual({ weekday: 1, total: 12400 });
    expect(busiestWeekday([line("2026-03-05", -200)])).toBeNull();
  });
});
