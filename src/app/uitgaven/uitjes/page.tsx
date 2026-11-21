import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isoDay } from "@/lib/finance/dates";
import { outingTotals, recurringOutings, trendHref } from "@/lib/finance/outing-trend";
import { isValidMonth } from "@/lib/finance/spending";
import { cn } from "@/lib/utils";
import { today as getToday, repository } from "@/server/finance";
import type { Metadata } from "next";
import Link from "next/link";
import { OutingCalendar } from "./_components/outing-calendar";
import { OutingForm } from "./_components/outing-form";
import { OutingList } from "./_components/outing-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Uitjes" };

const views = [
  { href: "/uitgaven/uitjes", label: "Agenda", list: false },
  { href: "/uitgaven/uitjes?weergave=lijst", label: "Lijst", list: true },
];

export default async function OutingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { maand, weergave } = await searchParams;
  const list = weergave === "lijst";
  const todayDay = getToday();
  const today = isoDay(todayDay);
  const current = today.slice(0, 7);
  const month = typeof maand === "string" && isValidMonth(maand) ? maand : current;
  const lookups = {
    categories: repository.listCategories(),
    outings: repository.listOutings(),
    counterparties: repository.listCounterparties(),
  };
  const linked = repository.listSpendings().filter((s) => s.outingId !== null);
  const totals = outingTotals(linked);
  const recurring = recurringOutings(lookups.outings, totals);

  return (
    <>
      <p className="text-muted-foreground">
        Feestjes en avonden uit, met alles wat erbij hoort: ook het ticket van maanden ervoor.
      </p>

      <nav aria-label="Weergave" className="bg-muted inline-flex rounded-lg p-1 text-sm">
        {views.map((view) => (
          <Link
            key={view.label}
            href={view.href}
            aria-current={view.list === list ? "page" : undefined}
            className={cn(
              "text-muted-foreground hover:text-foreground rounded-md px-3 py-1",
              view.list === list && "bg-background text-foreground font-medium shadow-sm",
            )}
          >
            {view.label}
          </Link>
        ))}
      </nav>

      {list ? (
        <OutingList
          lookups={lookups}
          linked={linked}
          recurringNames={new Set(recurring.map((g) => g.name))}
          today={today}
        />
      ) : (
        <OutingCalendar
          month={month}
          current={current}
          today={todayDay}
          outings={lookups.outings.map((o) => ({
            id: o.id,
            name: o.name,
            date: o.date,
            total: totals.get(o.id) ?? 0,
          }))}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Nieuw uitje</CardTitle>
        </CardHeader>
        <CardContent>
          <OutingForm />
        </CardContent>
      </Card>

      {recurring.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Terugkerende uitjes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-2 text-sm">
              {recurring.map((group) => (
                <li key={group.name}>
                  <Link href={trendHref(group.name)} className="bg-muted hover:bg-muted/70 block rounded px-2 py-1">
                    {group.name} <span className="text-muted-foreground">{group.points.length}×</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}
