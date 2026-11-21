import { describe, expect, test } from "bun:test";
import { dayFromYMD, isoWeek } from "./dates";

describe("isoWeek", () => {
  test("mid-year and year boundaries", () => {
    expect(isoWeek(dayFromYMD(2026, 11, 16))).toBe(47);
    expect(isoWeek(dayFromYMD(2026, 11, 22))).toBe(47);
    expect(isoWeek(dayFromYMD(2026, 1, 1))).toBe(1);
    expect(isoWeek(dayFromYMD(2027, 1, 1))).toBe(53);
    expect(isoWeek(dayFromYMD(2024, 12, 30))).toBe(1);
  });
});
