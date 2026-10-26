/** A calendar day, counted as whole days since 1970-01-01 (no time component). */
export type Day = number;

const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function dayFromYMD(year: number, month: number, day: number): Day {
  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

export function toYMD(day: Day): { year: number; month: number; day: number } {
  const date = new Date(day * MS_PER_DAY);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function parseDay(value: string): Day {
  if (!isValidIsoDate(value)) {
    throw new Error(`Invalid date "${value}", expected YYYY-MM-DD`);
  }
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  return dayFromYMD(year, month, day);
}

export function isoDay(day: Day): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Today's calendar day in the given IANA time zone. */
export function todayIn(timeZone: string): Day {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parseDay(formatted);
}
