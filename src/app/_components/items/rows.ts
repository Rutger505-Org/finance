import type { PieSlice } from "@/components/pie-chart";
import { isoDay } from "@/lib/finance/dates";
import { cyclesPerYear, nextOccurrence } from "@/lib/finance/schedule";
import type { Cycle } from "@/lib/finance/schemas";
import { cycleLabel, moneyEuros, relativeDate } from "@/lib/format";

/** Display fields of an income or expense row. */
export function itemRow(item: { amount: number; cycle: Cycle }, today: number) {
  const nextDue = nextOccurrence(item.cycle, today - 1);
  const monthlyEuros = (item.amount * cyclesPerYear(item.cycle)) / 12;
  return {
    amount: moneyEuros(item.amount),
    cycle: cycleLabel(item.cycle),
    next: relativeDate(nextDue, today),
    nextDue: isoDay(nextDue),
    monthly: moneyEuros(monthlyEuros),
    monthlyEuros,
  };
}

/** Active items as average monthly cents. */
export const monthlySlices = (
  items: { id: number; name: string; amount: number; cycle: Cycle; active: boolean }[],
) =>
  items
    .filter((item) => item.active)
    .map(
      (item): PieSlice => ({
        key: String(item.id),
        label: item.name,
        value: (item.amount * 100 * cyclesPerYear(item.cycle)) / 12,
      }),
    );
