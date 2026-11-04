import { describe, expect, test } from "bun:test";
import { isValidIban } from "./schemas";
import { addMonths, isValidMonth, monthRange, totalsBy } from "./spending";

describe("spending", () => {
  test("totals per category, largest first, refunds subtract", () => {
    const lines = [
      { amount: 1300, categoryId: 2, outingId: null },
      { amount: 1200, categoryId: 1, outingId: 7 },
      { amount: 500, categoryId: 1, outingId: 7 },
      { amount: -300, categoryId: 1, outingId: 7 },
      { amount: 400, categoryId: null, outingId: null },
    ];
    expect(totalsBy(lines, "categoryId")).toEqual([
      { id: 1, amount: 1400, count: 3 },
      { id: 2, amount: 1300, count: 1 },
      { id: null, amount: 400, count: 1 },
    ]);
    expect(totalsBy(lines, "outingId").find((t) => t.id === 7)).toEqual({ id: 7, amount: 1400, count: 3 });
  });

  test("months", () => {
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthRange("2028-02").to).toBe("2028-02-29");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(isValidMonth("2026-13")).toBe(false);
    expect(isValidMonth("2026-11")).toBe(true);
  });

  test("iban checksum", () => {
    expect(isValidIban("NL91ABNA0417164300")).toBe(true);
    expect(isValidIban("NL91ABNA0417164301")).toBe(false);
  });
});
