import { amountsPerDay, outingRange, outingSpendings, rangeLength } from "@/lib/finance/outing-calendar";
import { date, dateLong, dateRangeLong, money } from "@/lib/format";

/** "zaterdag 17 oktober 2026", or for a multi-day outing "za 17 – wo 21 okt 2026 · 5 dagen"; null without a date. */
export function outingWhen(outing: { date: string | null; endDate: string | null }): string | null {
  const range = outingRange(outing);
  if (range === null) return null;
  if (range.end === range.start) return dateLong(range.start);
  return `${dateRangeLong(range.start, range.end)} · ${rangeLength(range)} dagen`;
}

/** Amount per day of a multi-day outing (nothing for a single day); `spendings` with amounts in euros. */
export function DayTotals({
  outing,
  spendings,
}: {
  outing: { date: string | null; endDate: string | null };
  spendings: { date: string; amount: number }[];
}) {
  const range = outingRange(outing);
  if (range === null || range.end === range.start) return null;
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-medium">Per dag</h3>
      <ul className="max-w-xs divide-y text-sm tabular-nums">
        {[...amountsPerDay(range, outingSpendings(spendings))].map(([day, amount]) => (
          <li key={day} className="flex justify-between gap-3 py-1">
            <span>{date(day)}</span>
            <span className={amount === 0 ? "text-muted-foreground" : "font-medium"}>{money(amount)}</span>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-xs">Eerder betaald telt op de eerste dag, later op de laatste.</p>
    </div>
  );
}
