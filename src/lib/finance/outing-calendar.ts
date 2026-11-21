import { dayFromYMD, daysInMonth, parseDay, type Day } from "./dates";
import { startOfWeek } from "./insights";

/** An outing with its total in cents (sum of all linked spendings, refunds negative). */
export interface CalendarOuting {
  id: number;
  name: string;
  date: string | null;
  total: number;
}

export interface CalendarDay {
  day: Day;
  /** False for the leading/trailing days of the adjacent months. */
  inMonth: boolean;
  /** Outings dated that day, by id. */
  outings: CalendarOuting[];
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
  /** Outings dated in the month itself (not the adjacent days). */
  total: number;
  count: number;
  /** Outings without a date, in input order. */
  undated: CalendarOuting[];
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
 * Whole Mon–Sun weeks covering `month` ("YYYY-MM"), with the outings per day and per week.
 * Heat is relative to all dated outings so months compare: days to other days, weeks to other weeks (see heatScale).
 */
export function outingCalendar(month: string, outings: CalendarOuting[]): OutingCalendar {
  const [year, m] = month.split("-").map(Number) as [number, number];
  const first = dayFromYMD(year, m, 1);
  const last = dayFromYMD(year, m, daysInMonth(year, m));
  const gridStart = startOfWeek(first);
  const gridEnd = startOfWeek(last) + 6;

  const byDay = new Map<Day, CalendarOuting[]>();
  const undated: CalendarOuting[] = [];
  let total = 0;
  let count = 0;
  for (const outing of outings) {
    if (outing.date === null) {
      undated.push(outing);
      continue;
    }
    const day = parseDay(outing.date);
    if (day >= first && day <= last) {
      total += outing.total;
      count++;
    }
    if (day < gridStart || day > gridEnd) continue;
    byDay.set(day, [...(byDay.get(day) ?? []), outing]);
  }

  const weeks: CalendarWeek[] = [];
  for (let start = gridStart; start <= gridEnd; start += 7) {
    const days = Array.from({ length: 7 }, (_, i): CalendarDay => {
      const day = start + i;
      const list = (byDay.get(day) ?? []).sort((a, b) => a.id - b.id);
      return {
        day,
        inMonth: day >= first && day <= last,
        outings: list,
        total: list.reduce((acc, o) => acc + o.total, 0),
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

  const dayTotals = new Map<Day, number>();
  const weekTotals = new Map<Day, number>();
  for (const outing of outings) {
    if (outing.date === null) continue;
    const day = parseDay(outing.date);
    dayTotals.set(day, (dayTotals.get(day) ?? 0) + outing.total);
    weekTotals.set(startOfWeek(day), (weekTotals.get(startOfWeek(day)) ?? 0) + outing.total);
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
