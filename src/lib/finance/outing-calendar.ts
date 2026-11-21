import { dayFromYMD, daysInMonth, parseDay, type Day } from "./dates";
import { startOfWeek } from "./insights";

/** A spending of an outing: its own date and the amount in cents (refunds negative). */
export interface OutingSpending {
  date: string;
  amount: number;
}

/** Spendings with amounts in euros (the API's) as OutingSpendings, rounded per line like the outing totals. */
export const outingSpendings = (spendings: { date: string; amount: number }[]): OutingSpending[] =>
  spendings.map((s) => ({ date: s.date, amount: Math.round(s.amount * 100) }));

/** An outing with its spendings; `endDate` (inclusive) makes it multi-day, null = a single day. */
export interface CalendarOuting {
  id: number;
  name: string;
  date: string | null;
  endDate: string | null;
  spendings: OutingSpending[];
}

/** First and last day (inclusive) of an outing; equal for a single day. */
export interface OutingRange {
  start: Day;
  end: Day;
}

/** The days an outing covers, null without a date. */
export function outingRange(outing: { date: string | null; endDate: string | null }): OutingRange | null {
  if (outing.date === null) return null;
  const start = parseDay(outing.date);
  return { start, end: outing.endDate === null ? start : Math.max(start, parseDay(outing.endDate)) };
}

export const rangeLength = (range: OutingRange): number => range.end - range.start + 1;

/**
 * Amount in cents per day of the range, every day present (0 without spendings). A spending before the first day
 * (the ticket) counts on the first day, one after the last (a Tikkie afterwards) on the last day.
 */
export function amountsPerDay(range: OutingRange, spendings: OutingSpending[]): Map<Day, number> {
  const days = new Map<Day, number>();
  for (let day = range.start; day <= range.end; day++) days.set(day, 0);
  for (const s of spendings) {
    const day = Math.min(range.end, Math.max(range.start, parseDay(s.date)));
    days.set(day, days.get(day)! + s.amount);
  }
  return days;
}

/** An outing on one day of the grid: `amount` is that day's share, `total` the whole outing's. */
export interface CalendarChip {
  id: number;
  name: string;
  start: Day;
  end: Day;
  amount: number;
  total: number;
}

export interface CalendarDay {
  day: Day;
  /** False for the leading/trailing days of the adjacent months. */
  inMonth: boolean;
  /** Outings covering that day: earliest start first, then the longest, then by id. */
  outings: CalendarChip[];
  total: number;
  heat: number;
}

export interface CalendarWeek {
  /** Monday. */
  start: Day;
  days: CalendarDay[];
  total: number;
  heat: number;
}

export interface OutingCalendar {
  weeks: CalendarWeek[];
  /** Amounts on the month's own days (not the adjacent ones). */
  total: number;
  /** Outings whose range overlaps the month. */
  count: number;
  /** Outings without a date, in input order, with their total. */
  undated: { id: number; name: string; total: number }[];
}

export const HEAT_LEVELS = 4;

/** 0 for nothing (or money back), else 1..levels by share of `max`; `max` itself is the top level. */
export function heatLevel(amount: number, max: number, levels = HEAT_LEVELS): number {
  if (amount <= 0 || max <= 0) return 0;
  return Math.min(levels, Math.max(1, Math.ceil((amount / max) * levels)));
}

/** Amount that gets the top heat level: the 90th percentile of the positive totals, so one festival doesn't pale the rest. */
export function heatScale(totals: number[]): number {
  const positive = totals.filter((t) => t > 0).sort((a, b) => a - b);
  if (positive.length === 0) return 0;
  return positive[Math.ceil(positive.length * 0.9) - 1];
}

/**
 * Whole Mon–Sun weeks covering `month` ("YYYY-MM"), with the outings per day and per week. A multi-day outing is on
 * every day of its range with that day's amount (see amountsPerDay); weeks add up all seven days.
 * Heat is relative to all dated outings so months compare: days to other days, weeks to other weeks (see heatScale).
 */
export function outingCalendar(month: string, outings: CalendarOuting[]): OutingCalendar {
  const [year, m] = month.split("-").map(Number) as [number, number];
  const first = dayFromYMD(year, m, 1);
  const last = dayFromYMD(year, m, daysInMonth(year, m));
  const gridStart = startOfWeek(first);
  const gridEnd = startOfWeek(last) + 6;

  const byDay = new Map<Day, CalendarChip[]>();
  const dayTotals = new Map<Day, number>();
  const weekTotals = new Map<Day, number>();
  const undated: OutingCalendar["undated"] = [];
  let total = 0;
  let count = 0;
  for (const outing of outings) {
    const outingTotal = outing.spendings.reduce((acc, s) => acc + s.amount, 0);
    const range = outingRange(outing);
    if (range === null) {
      undated.push({ id: outing.id, name: outing.name, total: outingTotal });
      continue;
    }
    if (range.start <= last && range.end >= first) count++;
    for (const [day, amount] of amountsPerDay(range, outing.spendings)) {
      dayTotals.set(day, (dayTotals.get(day) ?? 0) + amount);
      weekTotals.set(startOfWeek(day), (weekTotals.get(startOfWeek(day)) ?? 0) + amount);
      if (day >= first && day <= last) total += amount;
      if (day < gridStart || day > gridEnd) continue;
      const chip = { id: outing.id, name: outing.name, ...range, amount, total: outingTotal };
      byDay.set(day, [...(byDay.get(day) ?? []), chip]);
    }
  }

  const weeks: CalendarWeek[] = [];
  for (let start = gridStart; start <= gridEnd; start += 7) {
    const days = Array.from({ length: 7 }, (_, i): CalendarDay => {
      const day = start + i;
      const list = (byDay.get(day) ?? []).sort((a, b) => a.start - b.start || b.end - a.end || a.id - b.id);
      return {
        day,
        inMonth: day >= first && day <= last,
        outings: list,
        total: list.reduce((acc, o) => acc + o.amount, 0),
        heat: 0,
      };
    });
    weeks.push({
      start,
      days,
      total: days.reduce((acc, d) => acc + d.total, 0),
      heat: 0,
    });
  }

  const maxDay = heatScale([...dayTotals.values()]);
  const maxWeek = heatScale([...weekTotals.values()]);
  for (const week of weeks) {
    week.heat = heatLevel(week.total, maxWeek);
    for (const day of week.days) day.heat = heatLevel(day.total, maxDay);
  }

  return { weeks, total, count, undated };
}

/** Detail page of an outing; `fromList` makes its back link go to the list view. */
export const outingHref = (id: number, fromList = false): string =>
  `/uitgaven/uitjes/${id}${fromList ? "?terug=lijst" : ""}`;
