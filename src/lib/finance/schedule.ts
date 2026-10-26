import { type Day, dayFromYMD, daysInMonth, parseDay, toYMD } from "./dates";
import type { Cycle } from "./schemas";

/** Longest gap between two occurrences of any supported cycle. */
const MAX_GAP = 366;

/** All occurrences in the half-open range (after, until]. */
export function occurrencesBetween(cycle: Cycle, after: Day, until: Day): Day[] {
  const result: Day[] = [];
  if (until <= after) return result;

  switch (cycle.type) {
    case "monthly": {
      let { year, month } = toYMD(after);
      for (;;) {
        const day = dayFromYMD(year, month, Math.min(cycle.day, daysInMonth(year, month)));
        if (day > until) break;
        if (day > after) result.push(day);
        month += 1;
        if (month > 12) {
          month = 1;
          year += 1;
        }
      }
      break;
    }
    case "yearly": {
      for (let year = toYMD(after).year; ; year++) {
        const day = dayFromYMD(
          year,
          cycle.month,
          Math.min(cycle.day, daysInMonth(year, cycle.month)),
        );
        if (day > until) break;
        if (day > after) result.push(day);
      }
      break;
    }
    case "interval": {
      const anchor = parseDay(cycle.anchor);
      const first = anchor + (Math.floor((after - anchor) / cycle.days) + 1) * cycle.days;
      for (let day = first; day <= until; day += cycle.days) result.push(day);
      break;
    }
  }
  return result;
}

/** First occurrence strictly after `after`. */
export function nextOccurrence(cycle: Cycle, after: Day): Day {
  const next = occurrencesBetween(cycle, after, after + MAX_GAP)[0];
  if (next === undefined) throw new Error("Cycle has no next occurrence");
  return next;
}

/** Average number of occurrences per year. */
export function cyclesPerYear(cycle: Cycle): number {
  switch (cycle.type) {
    case "monthly":
      return 12;
    case "yearly":
      return 1;
    case "interval":
      return 365.2425 / cycle.days;
  }
}
