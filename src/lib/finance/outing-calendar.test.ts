import { describe, expect, test } from "bun:test";
import { isoDay } from "./dates";
import { heatLevel, heatScale, outingCalendar, outingHref } from "./outing-calendar";

const outing = (id: number, date: string | null, total: number, name = `Uitje ${id}`) => ({ id, name, date, total });

describe("outing calendar", () => {
  test("month starting on a Monday has no leading days", () => {
    const { weeks } = outingCalendar("2026-06", []);
    expect(weeks.length).toBe(5);
    expect(isoDay(weeks[0].start)).toBe("2026-06-01");
    expect(weeks[0].days.every((d) => d.inMonth)).toBe(true);
    expect(isoDay(weeks.at(-1)!.days[6].day)).toBe("2026-07-05");
    expect(weeks.at(-1)!.days.map((d) => d.inMonth)).toEqual([true, true, false, false, false, false, false]);
  });

  test("month starting on a Sunday starts the grid on the Monday before", () => {
    const { weeks } = outingCalendar("2026-03", []);
    expect(weeks.length).toBe(6);
    expect(isoDay(weeks[0].start)).toBe("2026-02-23");
    expect(weeks[0].days.map((d) => d.inMonth)).toEqual([false, false, false, false, false, false, true]);
    expect(isoDay(weeks.at(-1)!.days[6].day)).toBe("2026-04-05");
  });

  test("a week spanning months counts all seven days, the month total only its own", () => {
    const calendar = outingCalendar("2026-03", [
      outing(1, "2026-02-24", 2500, "Kroegavond"),
      outing(2, "2026-02-26", 3000),
      outing(3, "2026-03-01", 1250),
      outing(4, "2026-01-10", 9999),
    ]);
    const [first] = calendar.weeks;
    expect(first.total).toBe(6750);
    expect(first.days[1].outings.map((o) => o.name)).toEqual(["Kroegavond"]);
    expect(calendar.total).toBe(1250);
    expect(calendar.count).toBe(1);
  });

  test("several outings on a day stack by id; refunds lower the totals", () => {
    const calendar = outingCalendar("2026-06", [
      outing(5, "2026-06-02", 1000),
      outing(2, "2026-06-02", -400),
      outing(3, "2026-06-04", 2050),
    ]);
    const day = calendar.weeks[0].days[1];
    expect(day.outings.map((o) => o.id)).toEqual([2, 5]);
    expect(day.total).toBe(600);
    expect(calendar.weeks[0].total).toBe(2650);
    expect(calendar.total).toBe(2650);
    expect(calendar.count).toBe(3);
  });

  test("undated outings are listed apart and don't count", () => {
    const calendar = outingCalendar("2026-06", [outing(1, null, 500), outing(2, "2026-06-10", 700)]);
    expect(calendar.undated.map((o) => o.id)).toEqual([1]);
    expect(calendar.total).toBe(700);
    expect(calendar.count).toBe(1);
    expect(
      calendar.weeks
        .flatMap((w) => w.days)
        .flatMap((d) => d.outings)
        .map((o) => o.id),
    ).toEqual([2]);
  });

  test("heat is relative to the busiest day and the busiest week", () => {
    const calendar = outingCalendar("2026-06", [
      outing(1, "2026-06-02", 2500),
      outing(2, "2026-06-04", 3000),
      outing(3, "2026-06-10", 400),
      outing(4, "2026-06-11", -300),
    ]);
    const [w1, w2, w3] = calendar.weeks;
    expect(w1.days.map((d) => d.heat)).toEqual([0, 4, 0, 4, 0, 0, 0]);
    expect(w2.days[2].heat).toBe(1);
    expect(w2.days[3].heat).toBe(0);
    expect([w1.heat, w2.heat, w3.heat]).toEqual([4, 1, 0]);
  });

  test("heat compares with outings outside the month", () => {
    const calendar = outingCalendar("2026-06", [outing(1, "2026-06-02", 1000), outing(2, "2026-09-15", 4000)]);
    expect(calendar.weeks[0].days[1].heat).toBe(1);
    expect(calendar.weeks[0].heat).toBe(1);
  });

  test("empty grid has no heat", () => {
    const calendar = outingCalendar("2026-06", []);
    expect(calendar.weeks.flatMap((w) => [w.heat, ...w.days.map((d) => d.heat)]).every((h) => h === 0)).toBe(true);
    expect(calendar.total).toBe(0);
  });

  test("heat scale is the 90th percentile of positive totals", () => {
    expect(heatScale([])).toBe(0);
    expect(heatScale([-100, 0])).toBe(0);
    expect(heatScale([500])).toBe(500);
    expect(heatScale([100, 200, 300, 400, 500, 600, 700, 800, 900, 10000])).toBe(900);
  });

  test("heat levels", () => {
    expect(heatLevel(0, 1000)).toBe(0);
    expect(heatLevel(-500, 1000)).toBe(0);
    expect(heatLevel(500, 0)).toBe(0);
    expect(heatLevel(1, 1000)).toBe(1);
    expect(heatLevel(250, 1000)).toBe(1);
    expect(heatLevel(251, 1000)).toBe(2);
    expect(heatLevel(750, 1000)).toBe(3);
    expect(heatLevel(1000, 1000)).toBe(4);
    expect(heatLevel(1000, 1000, 3)).toBe(3);
  });

  test("detail href", () => {
    expect(outingHref(7)).toBe("/uitgaven/uitjes/7");
    expect(outingHref(7, true)).toBe("/uitgaven/uitjes/7?terug=lijst");
  });
});
