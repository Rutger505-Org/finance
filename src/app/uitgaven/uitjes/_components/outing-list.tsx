import { SpendingList } from "@/app/uitgaven/_components/spending-list";
import type { Lookups } from "@/app/uitgaven/_components/spending-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { parseDay } from "@/lib/finance/dates";
import { outingHref } from "@/lib/finance/outing-calendar";
import { outingKey, trendHref } from "@/lib/finance/outing-trend";
import type { SpendingDto } from "@/lib/finance/schemas";
import { sum } from "@/lib/finance/spending";
import { dateLong, money } from "@/lib/format";
import Link from "next/link";
import { CategoryTotals } from "./category-totals";
import { OutingActions } from "./outing-form";

const cents = (euros: number) => Math.round(euros * 100);

/** Every outing as a card, with its spendings folded away. */
export function OutingList({
  lookups,
  linked,
  recurringNames,
  today,
}: {
  lookups: Lookups;
  /** Spendings linked to an outing. */
  linked: SpendingDto[];
  recurringNames: Set<string>;
  today: string;
}) {
  if (lookups.outings.length === 0) return <p className="text-muted-foreground text-sm">Nog geen uitjes.</p>;

  return lookups.outings.map((outing) => {
    const spendings = linked.filter((s) => s.outingId === outing.id);
    const lines = spendings.map((s) => ({ ...s, amount: cents(s.amount) }));
    return (
      <Card key={outing.id}>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex flex-wrap items-baseline gap-x-2">
              <Link href={outingHref(outing.id, true)} className="hover:underline">
                {outing.name}
              </Link>
              {recurringNames.has(outingKey(outing.name)) && (
                <Link
                  href={trendHref(outing.name)}
                  className="text-muted-foreground hover:text-foreground text-xs font-normal underline"
                  title="Bekijk het verloop"
                >
                  verloop
                </Link>
              )}
            </CardTitle>
            <CardDescription className="first-letter:uppercase">
              {[outing.date && dateLong(parseDay(outing.date)), outing.note].filter(Boolean).join(" · ") || "Geen datum"}
            </CardDescription>
          </div>
          <p className="text-xl font-semibold tabular-nums">{money(sum(lines))}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <CategoryTotals lines={lines} categories={lookups.categories} />
          <details>
            <summary className="cursor-pointer text-sm">
              {spendings.length} {spendings.length === 1 ? "uitgave" : "uitgaven"}
            </summary>
            <div className="mt-3">
              <SpendingList spendings={spendings} lookups={lookups} today={today} />
            </div>
          </details>
          <OutingActions outing={outing} />
        </CardContent>
      </Card>
    );
  });
}
