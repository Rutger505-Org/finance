import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TopTotal } from "@/lib/finance/insights";
import { money } from "@/lib/format";
import Link from "next/link";

const percent = (share: number | null) => (share === null ? "" : `${Math.round(share * 100)}%`);

function TopList({ title, href, totals, name }: { title: string; href: string; totals: TopTotal[]; name: (id: number | null) => string }) {
  return (
    <div className="min-w-0 space-y-2">
      <h3 className="text-sm font-medium">
        <Link href={href} className="hover:underline">
          {title}
        </Link>
      </h3>
      {totals.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nog niets.</p>
      ) : (
        <ul className="space-y-2 text-sm tabular-nums">
          {totals.map((t) => (
            <li key={String(t.id)} className="space-y-1">
              <div className="flex justify-between gap-3">
                <span className={t.id === null ? "text-muted-foreground truncate" : "truncate"}>{name(t.id)}</span>
                <span className="shrink-0">
                  {money(t.amount)} <span className="text-muted-foreground inline-block w-10 text-right">{percent(t.share)}</span>
                </span>
              </div>
              <div className="bg-muted h-1.5 rounded-full" aria-hidden>
                <div className="h-1.5 rounded-full bg-blue-600" style={{ width: `${Math.min(100, (t.share ?? 0) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Top categories and counterparties this month, with their share of the month's total. */
export function WhereCard({
  categories,
  counterparties,
  categoryName,
  counterpartyName,
}: {
  categories: TopTotal[];
  counterparties: TopTotal[];
  categoryName: (id: number | null) => string;
  counterpartyName: (id: number | null) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Waar gaat het heen</CardTitle>
        <CardDescription>Deze maand, aandeel in het totaal.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
        <TopList title="Categorieën" href="/uitgaven" totals={categories} name={categoryName} />
        <TopList title="Tegenrekeningen" href="/uitgaven/tegenrekeningen" totals={counterparties} name={counterpartyName} />
      </CardContent>
    </Card>
  );
}
