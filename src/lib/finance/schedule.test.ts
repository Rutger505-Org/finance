import { describe, expect, test } from "bun:test";
import { isoDay, parseDay } from "./dates";
import { nextOccurrence, occurrencesBetween } from "./schedule";

const days = (list: number[]) => list.map(isoDay);

describe("occurrencesBetween", () => {
  test("monthly moves to the end of short months", () => {
    const cycle = { type: "monthly", day: 31 } as const;
    expect(days(occurrencesBetween(cycle, parseDay("2027-01-31"), parseDay("2027-04-30")))).toEqual([
      "2027-02-28",
      "2027-03-31",
      "2027-04-30",
    ]);
  });

  test("range excludes the start and includes the end", () => {
    const cycle = { type: "monthly", day: 16 } as const;
    expect(days(occurrencesBetween(cycle, parseDay("2026-10-16"), parseDay("2026-11-16")))).toEqual(["2026-11-16"]);
  });

  test("interval follows the anchor in both directions", () => {
    const cycle = { type: "interval", days: 28, anchor: "2026-10-14" } as const;
    expect(days(occurrencesBetween(cycle, parseDay("2026-09-01"), parseDay("2026-12-31")))).toEqual([
      "2026-09-16",
      "2026-10-14",
      "2026-11-11",
      "2026-12-09",
    ]);
  });

  test("yearly, including 29 February", () => {
    expect(
      days(occurrencesBetween({ type: "yearly", month: 7, day: 1 }, parseDay("2026-10-25"), parseDay("2028-12-31"))),
    ).toEqual(["2027-07-01", "2028-07-01"]);
    expect(
      days(occurrencesBetween({ type: "yearly", month: 2, day: 29 }, parseDay("2026-01-01"), parseDay("2028-12-31"))),
    ).toEqual(["2026-02-28", "2027-02-28", "2028-02-29"]);
  });
});

test("nextOccurrence is strictly after", () => {
  const cycle = { type: "monthly", day: 24 } as const;
  expect(isoDay(nextOccurrence(cycle, parseDay("2026-10-24")))).toBe("2026-11-24");
  expect(isoDay(nextOccurrence(cycle, parseDay("2026-10-23")))).toBe("2026-10-24");
});
