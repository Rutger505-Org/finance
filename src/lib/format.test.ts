import { describe, expect, test } from "bun:test";
import { parseDay } from "./finance/dates";
import { dateRange, dateRangeLong } from "./format";

const range = (from: string, to: string) => [parseDay(from), parseDay(to)] as const;
// Intl may put thin or no-break spaces around the dash.
const plain = (text: string) => text.replace(/[\u2009\u202f\u00a0]/g, " ");

describe("date ranges", () => {
  test("within a month", () => {
    expect(plain(dateRange(...range("2026-10-17", "2026-10-21")))).toBe("17–21 okt");
    expect(plain(dateRangeLong(...range("2026-10-17", "2026-10-21")))).toBe("za 17 – wo 21 okt 2026");
  });

  test("across months and years", () => {
    expect(plain(dateRange(...range("2026-10-31", "2026-11-03")))).toBe("31 okt – 3 nov");
    expect(plain(dateRangeLong(...range("2026-12-31", "2027-01-02")))).toBe("do 31 dec 2026 – za 2 jan 2027");
  });

  test("a single day", () => {
    expect(dateRange(...range("2026-10-17", "2026-10-17"))).toBe("17 okt");
  });
});
