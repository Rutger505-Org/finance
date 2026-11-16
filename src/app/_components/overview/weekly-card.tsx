import { MultiLineChart } from "@/components/line-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isoDay } from "@/lib/finance/dates";
import { date, dateCompact, money } from "@/lib/format";

/** Total spendings per week (Mon–Sun), the current week up to today. */
export function WeeklyCard({ weeks }: { weeks: { start: number; total: number }[] }) {
  const empty = weeks.every((w) => w.total === 0);
  const average = weeks.reduce((total, w) => total + w.total, 0) / weeks.length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Per week</CardTitle>
        <CardDescription>
          {empty
            ? `Nog geen uitgaven in de afgelopen ${weeks.length} weken.`
            : `Afgelopen ${weeks.length} weken, maandag t/m zondag. Gemiddeld ${money(average)} per week; deze week tot nu ${money(weeks.at(-1)!.total)}.`}
        </CardDescription>
      </CardHeader>
      {!empty && (
        <CardContent>
          <MultiLineChart
            title="Uitgaven per week"
            xLabel={dateCompact}
            pointLabel={(x) => `week van ${date(x)}`}
            series={[
              {
                key: "weeks",
                label: "Per week",
                points: weeks.map((w) => ({ key: isoDay(w.start), x: w.start, value: w.total })),
              },
            ]}
          />
        </CardContent>
      )}
    </Card>
  );
}
