import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Day } from "@/lib/finance/dates";
import { trendHref } from "@/lib/finance/outing-trend";
import { date, money } from "@/lib/format";
import Link from "next/link";

export interface OutingsSummary {
  last: { id: number; name: string; day: Day; total: number }[];
  mostExpensive: { name: string; day: Day | null; total: number } | null;
  /** Recurring outing names with their average per time. */
  recurring: { name: string; count: number; average: number }[];
}

/** Last outings, the most expensive one ever and averages of recurring ones. */
export function OutingsCard({ last, mostExpensive, recurring }: OutingsSummary) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Link href="/uitgaven/uitjes" className="hover:underline">
            Uitjes
          </Link>
        </CardTitle>
        {mostExpensive && (
          <CardDescription>
            Duurste ooit: {mostExpensive.name}
            {mostExpensive.day !== null && ` (${date(mostExpensive.day)})`}, {money(mostExpensive.total)}.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {last.length === 0 ? (
          <p className="text-muted-foreground">Nog geen uitjes met een datum.</p>
        ) : (
          <ul className="divide-y tabular-nums">
            {last.map((o) => (
              <li key={o.id} className="flex justify-between gap-3 py-1.5">
                <span className="min-w-0 truncate">
                  <span className="text-muted-foreground">{date(o.day)}</span> {o.name}
                </span>
                <span className="shrink-0">{money(o.total)}</span>
              </li>
            ))}
          </ul>
        )}
        {recurring.length > 0 && (
          <div className="space-y-1">
            <h3 className="font-medium">Gemiddeld per keer</h3>
            <ul className="tabular-nums">
              {recurring.map((r) => (
                <li key={r.name}>
                  <Link href={trendHref(r.name)} className="flex justify-between gap-3 py-0.5 hover:underline">
                    <span className="min-w-0 truncate">
                      {r.name} <span className="text-muted-foreground">({r.count}×)</span>
                    </span>
                    <span className="shrink-0">{money(r.average)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
