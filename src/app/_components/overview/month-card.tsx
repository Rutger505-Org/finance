import { MultiLineChart } from "@/components/line-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { daysInMonth, toYMD } from "@/lib/finance/dates";
import type { MonthComparison } from "@/lib/finance/insights";
import { money, monthNames } from "@/lib/format";
import Link from "next/link";

/** Spent this month vs the same point last month, cumulative per day. */
export function MonthCard({ comparison }: { comparison: MonthComparison }) {
  const { total, lastMonthSoFar, lastMonthTotal, dailyAverage, current, previous } = comparison;
  const thisName = monthNames[toYMD(comparison.thisMonth).month - 1];
  const lastName = monthNames[toYMD(comparison.lastMonth).month - 1];
  const difference = total - lastMonthSoFar;
  if (total === 0 && lastMonthTotal === 0 && previous.every((p) => p.value === 0)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Deze maand</CardTitle>
          <CardDescription>Nog geen uitgaven deze of vorige maand.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const { year, month } = toYMD(comparison.thisMonth);
  const length = Math.max(previous.length, daysInMonth(year, month));
  return (
    <Card>
      <CardHeader>
        <CardDescription>Deze maand uitgegeven</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{money(total)}</CardTitle>
        <CardDescription>
          {difference === 0
            ? `Precies evenveel als ${lastName} op dag ${current.length}.`
            : `${money(Math.abs(difference))} ${difference > 0 ? "meer" : "minder"} dan ${lastName} op dag ${current.length} (${money(lastMonthSoFar)}).`}{" "}
          Gemiddeld {money(dailyAverage)} per dag.{" "}
          <Link href="/uitgaven" className="underline">
            Uitgaven
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <MultiLineChart
          title={`Opgeteld per dag: ${thisName} tegenover ${lastName}`}
          xDomain={[1, length]}
          xLabel={(x) => String(x)}
          pointLabel={(x) => `dag ${x}`}
          series={[
            {
              key: "current",
              label: thisName,
              points: current.map((p) => ({ key: String(p.x), ...p })),
            },
            {
              key: "previous",
              label: lastName,
              muted: true,
              points: previous.map((p) => ({ key: String(p.x), ...p })),
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}
