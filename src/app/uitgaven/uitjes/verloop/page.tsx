import { LineChart } from "@/components/line-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { outingKey, outingTotals, recurringOutings, trendStats } from "@/lib/finance/outing-trend";
import { dateLong, money } from "@/lib/format";
import { repository } from "@/server/finance";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const nameFrom = async (searchParams: Props["searchParams"]) => {
  const { naam } = await searchParams;
  return typeof naam === "string" ? outingKey(naam) : "";
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const name = await nameFrom(searchParams);
  return { title: name ? `Verloop ${name}` : "Verloop uitje" };
}

export default async function OutingTrendPage({ searchParams }: Props) {
  const name = await nameFrom(searchParams);
  const totals = outingTotals(repository.listSpendings().filter((s) => s.outingId !== null));
  const group = recurringOutings(repository.listOutings(), totals).find((g) => g.name === name);
  const back = (
    <Link href="/uitgaven/uitjes" className="text-sm underline">
      ← Terug naar uitjes
    </Link>
  );

  if (!group) {
    return (
      <>
        <p className="text-muted-foreground">
          {name
            ? `Geen verloop voor "${name}": daarvoor zijn minstens twee uitjes met die naam en een datum nodig.`
            : "Geen uitje gekozen."}
        </p>
        {back}
      </>
    );
  }

  const stats = trendStats(group.points)!;

  return (
    <>
      {back}
      <Card>
        <CardHeader>
          <CardTitle>{group.name}</CardTitle>
          <CardDescription>
            {group.points.length} keer · gemiddeld {money(stats.average)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LineChart
            title={`Kosten per keer van ${group.name}`}
            points={group.points.map((p) => ({ key: String(p.outingId), day: p.day, value: p.total }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per keer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-1 text-sm tabular-nums">
            {group.points.map((p) => (
              <li key={p.outingId} className="flex justify-between gap-4">
                <span className="first-letter:uppercase">{dateLong(p.day)}</span>
                <span className="font-medium">{money(p.total)}</span>
              </li>
            ))}
          </ul>
          <ul className="flex flex-wrap gap-2 text-sm tabular-nums">
            <li className="bg-muted rounded px-2 py-1">
              Gemiddeld <span className="font-medium">{money(stats.average)}</span>
            </li>
            <li className="bg-muted rounded px-2 py-1">
              Laagst <span className="font-medium">{money(stats.min)}</span>
            </li>
            <li className="bg-muted rounded px-2 py-1">
              Hoogst <span className="font-medium">{money(stats.max)}</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
