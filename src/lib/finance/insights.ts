import { dayFromYMD, parseDay, toYMD, type Day } from "./dates";
import { sum } from "./spending";

/** Calculations for the overview dashboard. Amounts are cents; negative is money back (same as /uitgaven). */

export interface InsightSpending {
  day: Day;
  amount: number;
  categoryId: number | null;
  counterpartyId: number | null;
  outingId: number | null;
}

/** A spending as returned by the repository (euros, ISO date) → cents and Day. */
export function toInsightSpending(s: {
  date: string;
  amount: number;
  categoryId: number | null;
  counterpartyId: number | null;
  outingId: number | null;
}): InsightSpending {
  return {
    day: parseDay(s.date),
    amount: Math.round(s.amount * 100),
    categoryId: s.categoryId,
    counterpartyId: s.counterpartyId,
    outingId: s.outingId,
  };
}

export const startOfMonth = (day: Day): Day => {
  const { year, month } = toYMD(day);
  return dayFromYMD(year, month, 1);
};

/** Monday of the week (Mon–Sun) containing `day`. Day 0 (1970-01-01) is a Thursday. */
export const startOfWeek = (day: Day): Day => day - ((((day + 3) % 7) + 7) % 7);

/** 0 = Monday ... 6 = Sunday. */
export const weekday = (day: Day): number => day - startOfWeek(day);

export const weekdayNames = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];

const between = (spendings: InsightSpending[], from: Day, until: Day) =>
  spendings.filter((s) => s.day >= from && s.day <= until);

/** Running total per day of month, 1..days. */
function cumulative(spendings: InsightSpending[], first: Day, days: number): { x: number; value: number }[] {
  const perDay = new Array<number>(days).fill(0);
  for (const s of between(spendings, first, first + days - 1)) perDay[s.day - first] += s.amount;
  let total = 0;
  return perDay.map((amount, i) => ({ x: i + 1, value: (total += amount) }));
}

export interface MonthComparison {
  /** First day of this month and of last month. */
  thisMonth: Day;
  lastMonth: Day;
  /** Spent this month up to and including today. */
  total: number;
  /** Spent last month up to the same day of the month (its last day when shorter). */
  lastMonthSoFar: number;
  lastMonthTotal: number;
  /** total / days so far. */
  dailyAverage: number;
  /** Cumulative per day of month: this month up to today, last month in full. */
  current: { x: number; value: number }[];
  previous: { x: number; value: number }[];
}

export function monthComparison(spendings: InsightSpending[], today: Day): MonthComparison {
  const thisMonth = startOfMonth(today);
  const lastMonth = startOfMonth(thisMonth - 1);
  const daysSoFar = today - thisMonth + 1;
  const lastLength = thisMonth - lastMonth;
  const current = cumulative(spendings, thisMonth, daysSoFar);
  const previous = cumulative(spendings, lastMonth, lastLength);
  const total = current.at(-1)!.value;
  return {
    thisMonth,
    lastMonth,
    total,
    lastMonthSoFar: previous[Math.min(daysSoFar, lastLength) - 1].value,
    lastMonthTotal: previous.at(-1)!.value,
    dailyAverage: total / daysSoFar,
    current,
    previous,
  };
}

/** Totals per week (Mon–Sun) for the last `weeks` weeks, oldest first; the current week counts up to today. */
export function weeklyTotals(spendings: InsightSpending[], today: Day, weeks = 12): { start: Day; total: number }[] {
  const first = startOfWeek(today) - (weeks - 1) * 7;
  const totals = Array.from({ length: weeks }, (_, i) => ({ start: first + i * 7, total: 0 }));
  for (const s of between(spendings, first, today)) totals[Math.floor((s.day - first) / 7)].total += s.amount;
  return totals;
}

export interface TopTotal {
  id: number | null;
  amount: number;
  count: number;
  /** Fraction of the net total, null when that isn't positive. */
  share: number | null;
}

/** Largest totals per key; `skipNull` leaves out spendings without one. Share is of all lines. */
export function topTotals(
  lines: InsightSpending[],
  key: "categoryId" | "counterpartyId",
  limit = 5,
  skipNull = false,
): TopTotal[] {
  const total = sum(lines);
  const totals = new Map<number | null, { amount: number; count: number }>();
  for (const line of lines) {
    const id = line[key];
    if (id === null && skipNull) continue;
    const entry = totals.get(id) ?? { amount: 0, count: 0 };
    entry.amount += line.amount;
    entry.count += 1;
    totals.set(id, entry);
  }
  return [...totals]
    .map(([id, t]) => ({ id, ...t, share: total > 0 ? t.amount / total : null }))
    .filter((t) => t.amount > 0)
    .sort((a, b) => b.amount - a.amount || (a.id ?? Infinity) - (b.id ?? Infinity))
    .slice(0, limit);
}

export interface DatedOuting {
  id: number;
  name: string;
  date: string | null;
}

/** Dated outings up to today, newest first, with their totals. */
export function lastOutings(
  outings: DatedOuting[],
  totals: Map<number, number>,
  today: Day,
  limit = 5,
): { id: number; name: string; day: Day; total: number }[] {
  return outings
    .flatMap((o) => (o.date === null ? [] : [{ id: o.id, name: o.name, day: parseDay(o.date), total: totals.get(o.id) ?? 0 }]))
    .filter((o) => o.day <= today)
    .sort((a, b) => b.day - a.day || b.id - a.id)
    .slice(0, limit);
}

/** Outing with the highest total (dated or not), null without any positive one. */
export function mostExpensiveOuting<T extends { id: number }>(
  outings: T[],
  totals: Map<number, number>,
): (T & { total: number }) | null {
  let best: (T & { total: number }) | null = null;
  for (const o of outings) {
    const total = totals.get(o.id) ?? 0;
    if (total > 0 && (best === null || total > best.total)) best = { ...o, total };
  }
  return best;
}

/** Day with the highest net total, earliest on a tie. */
export function mostExpensiveDay(spendings: InsightSpending[]): { day: Day; total: number } | null {
  const perDay = new Map<Day, number>();
  for (const s of spendings) perDay.set(s.day, (perDay.get(s.day) ?? 0) + s.amount);
  let best: { day: Day; total: number } | null = null;
  for (const [day, total] of perDay) {
    if (total > 0 && (best === null || total > best.total || (total === best.total && day < best.day))) {
      best = { day, total };
    }
  }
  return best;
}

/** Days since the last spending (not money back) up to today; null without one. */
export function daysSinceLastSpending(spendings: InsightSpending[], today: Day): number | null {
  const days = spendings.filter((s) => s.amount > 0 && s.day <= today).map((s) => s.day);
  return days.length === 0 ? null : today - Math.max(...days);
}

/** Counterparty with the most spendings (not money back) in `from`..`until`; most spent on a tie. */
export function mostVisitedCounterparty(
  spendings: InsightSpending[],
  from: Day,
  until: Day,
): { id: number; count: number; amount: number } | null {
  const visits = new Map<number, { count: number; amount: number }>();
  for (const s of between(spendings, from, until)) {
    if (s.counterpartyId === null || s.amount <= 0) continue;
    const entry = visits.get(s.counterpartyId) ?? { count: 0, amount: 0 };
    entry.count += 1;
    entry.amount += s.amount;
    visits.set(s.counterpartyId, entry);
  }
  return (
    [...visits]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.count - a.count || b.amount - a.amount || a.id - b.id)[0] ?? null
  );
}

/** Weekday (0 = Monday) with the highest net total, null without a positive one. */
export function busiestWeekday(spendings: InsightSpending[]): { weekday: number; total: number } | null {
  const totals = new Array<number>(7).fill(0);
  for (const s of spendings) totals[weekday(s.day)] += s.amount;
  const best = totals.reduce((bestIndex, total, i) => (total > totals[bestIndex] ? i : bestIndex), 0);
  return totals[best] > 0 ? { weekday: best, total: totals[best] } : null;
}
