import { MonthNav } from "@/app/_components/month-nav";
import { PieChart } from "@/components/pie-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isoDay } from "@/lib/finance/dates";
import { isValidMonth, monthRange, sum, totalsBy } from "@/lib/finance/spending";
import { money, monthLabel } from "@/lib/format";
import { today as getToday, repository } from "@/server/finance";
import type { Metadata } from "next";
import Link from "next/link";
import { SpendingForm } from "./_components/spending-form";
import { SpendingList } from "./_components/spending-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Uitgaven" };

const cents = (euros: number) => Math.round(euros * 100);

export default async function SpendingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { maand } = await searchParams;
  const today = isoDay(getToday());
  const current = today.slice(0, 7);
  const month = typeof maand === "string" && isValidMonth(maand) ? maand : current;
  const lookups = {
    categories: repository.listCategories(),
    outings: repository.listOutings(),
    counterparties: repository.listCounterparties(),
  };
  const spendings = repository.listSpendings(monthRange(month));
  const lines = spendings.map((s) => ({ ...s, amount: cents(s.amount) }));
  const total = sum(lines);
  const name = (list: { id: number; name: string }[], id: number | null, none: string) =>
    id === null ? none : (list.find((item) => item.id === id)?.name ?? `#${id}`);
  const perCategory = totalsBy(lines, "categoryId");
  const perOuting = totalsBy(lines, "outingId");

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-xl font-semibold first-letter:uppercase">{monthLabel(month)}</h2>
        <MonthNav path="/uitgaven" month={month} current={current} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Toevoegen</CardTitle>
          <CardDescription>
            Losse uitgaven van je lopende rekening. Categorie = waaraan, uitje = waarvoor. Een negatief bedrag is
            terugbetaald (Tikkie).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SpendingForm lookups={lookups} today={today} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Totaal: {money(total)}</CardTitle>
            <CardDescription>
              {spendings.length} {spendings.length === 1 ? "uitgave" : "uitgaven"} per categorie
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PieChart
              title="Uitgaven per categorie"
              slices={perCategory.map((t) => ({
                key: String(t.id),
                label: name(lookups.categories, t.id, "Geen categorie"),
                value: t.amount,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Per uitje</CardTitle>
            <CardDescription>
              Alleen wat in deze maand viel. Totalen over alle maanden staan bij{" "}
              <Link href="/uitgaven/uitjes" className="underline">
                Uitjes
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            {perOuting.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nog niets.</p>
            ) : (
              <ul className="divide-y text-sm tabular-nums">
                {perOuting.map((t) => (
                  <li key={String(t.id)} className="flex justify-between gap-4 py-2">
                    <span className={t.id === null ? "text-muted-foreground" : "font-medium"}>
                      {name(lookups.outings, t.id, "Geen uitje")}
                    </span>
                    <span>{money(t.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alle uitgaven</CardTitle>
        </CardHeader>
        <CardContent>
          <SpendingList spendings={spendings} lookups={lookups} today={today} />
        </CardContent>
      </Card>
    </>
  );
}
