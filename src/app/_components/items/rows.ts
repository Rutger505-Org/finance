import type { PieSlice } from "@/components/pie-chart";
import { isoDay, parseDay, type Day } from "@/lib/finance/dates";
import { cyclesPerYear, endedBefore, nextOccurrenceWithin } from "@/lib/finance/schedule";
import type { Cycle } from "@/lib/finance/schemas";
import { cycleLabel, dateCompact, moneyEuros, relativeDate } from "@/lib/format";

/** An income or expense; only expenses have bounds (ISO dates, inclusive). */
type RowItem = { amount: number; cycle: Cycle; from?: string | null; until?: string | null };

const boundsOf = (item: RowItem) => ({
  from: item.from ? parseDay(item.from) : null,
  until: item.until ? parseDay(item.until) : null,
});

/** Average per month in the item's unit; 0 once its `until` is before today. */
const monthlyOf = (item: RowItem, today: Day) =>
  endedBefore(boundsOf(item), today) ? 0 : (item.amount * cyclesPerYear(item.cycle)) / 12;

/** "vanaf 1 jan 26 · t/m 31 dec 26", the set sides only. */
const boundsLabel = (item: RowItem) => {
  const { from, until } = boundsOf(item);
  const parts = [from !== null && `vanaf ${dateCompact(from)}`, until !== null && `t/m ${dateCompact(until)}`];
  return parts.filter(Boolean).join(" · ") || undefined;
};

/** Display fields of an income or expense row. */
export function itemRow(item: RowItem, today: Day) {
  const nextDue = nextOccurrenceWithin(item.cycle, today - 1, boundsOf(item));
  const monthlyEuros = monthlyOf(item, today);
  return {
    amount: moneyEuros(item.amount),
    cycle: cycleLabel(item.cycle),
    next: nextDue === null ? "gestopt" : relativeDate(nextDue, today),
    nextDue: nextDue === null ? null : isoDay(nextDue),
    monthly: moneyEuros(monthlyEuros),
    monthlyEuros,
    detail: boundsLabel(item),
  };
}

/** Active items as average monthly euros; an item whose `until` is before today counts as 0. */
export const perMonth = (items: (RowItem & { active: boolean })[], today: Day) =>
  items.filter((item) => item.active).reduce((total, item) => total + monthlyOf(item, today), 0);

/** Active, not ended items as average monthly cents. */
export const monthlySlices = (
  items: (RowItem & { id: number; name: string; active: boolean })[],
  today: Day,
) =>
  items
    .filter((item) => item.active && !endedBefore(boundsOf(item), today))
    .map(
      (item): PieSlice => ({
        key: String(item.id),
        label: item.name,
        value: monthlyOf(item, today) * 100,
      }),
    );
