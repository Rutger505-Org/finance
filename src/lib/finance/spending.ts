/** Totals over one-off spendings. Amounts are cents; negative is money back. */

export interface SpendingLine {
  amount: number;
  categoryId: number | null;
  outingId: number | null;
}

export interface Total {
  /** null = no category / no outing. */
  id: number | null;
  amount: number;
  count: number;
}

/** Sum per key, largest first; ties by id. */
export function totalsBy(lines: SpendingLine[], key: "categoryId" | "outingId"): Total[] {
  const totals = new Map<number | null, Total>();
  for (const line of lines) {
    const id = line[key];
    const total = totals.get(id) ?? { id, amount: 0, count: 0 };
    total.amount += line.amount;
    total.count += 1;
    totals.set(id, total);
  }
  return [...totals.values()].sort((a, b) => b.amount - a.amount || (a.id ?? Infinity) - (b.id ?? Infinity));
}

export const sum = (lines: { amount: number }[]): number => lines.reduce((total, line) => total + line.amount, 0);

/** "2026-11" → first and last day, as YYYY-MM-DD. */
export function monthRange(month: string): { from: string; to: string } {
  const [year, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export function isValidMonth(value: string): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  return !!match && Number(match[2]) >= 1 && Number(match[2]) <= 12;
}

/** "2026-11" shifted by `delta` months. */
export function addMonths(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number) as [number, number];
  const date = new Date(Date.UTC(year, m - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}
