import { SpendingList } from "@/app/uitgaven/_components/spending-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isoDay, parseDay } from "@/lib/finance/dates";
import { sum, totalsBy } from "@/lib/finance/spending";
import { dateLong, money } from "@/lib/format";
import { today as getToday, repository } from "@/server/finance";
import { OutingActions, OutingForm } from "./_components/outing-form";

export const dynamic = "force-dynamic";

const cents = (euros: number) => Math.round(euros * 100);

export default function OutingsPage() {
  const today = isoDay(getToday());
  const lookups = {
    categories: repository.listCategories(),
    outings: repository.listOutings(),
    counterparties: repository.listCounterparties(),
  };
  const linked = repository.listSpendings().filter((s) => s.outingId !== null);
  const categoryName = (id: number | null) =>
    id === null ? "Geen categorie" : (lookups.categories.find((c) => c.id === id)?.name ?? `#${id}`);

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Uitjes</h1>
        <p className="text-muted-foreground">
          Feestjes en avonden uit, met alles wat erbij hoort: ook het ticket van maanden ervoor.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nieuw uitje</CardTitle>
        </CardHeader>
        <CardContent>
          <OutingForm />
        </CardContent>
      </Card>

      {lookups.outings.length === 0 && <p className="text-muted-foreground text-sm">Nog geen uitjes.</p>}

      {lookups.outings.map((outing) => {
        const spendings = linked.filter((s) => s.outingId === outing.id);
        const lines = spendings.map((s) => ({ ...s, amount: cents(s.amount) }));
        return (
          <Card key={outing.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div className="space-y-1">
                <CardTitle>{outing.name}</CardTitle>
                <CardDescription className="first-letter:uppercase">
                  {[outing.date && dateLong(parseDay(outing.date)), outing.note].filter(Boolean).join(" · ") ||
                    "Geen datum"}
                </CardDescription>
              </div>
              <p className="text-xl font-semibold tabular-nums">{money(sum(lines))}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {lines.length > 0 && (
                <ul className="flex flex-wrap gap-2 text-sm tabular-nums">
                  {totalsBy(lines, "categoryId").map((t) => (
                    <li key={String(t.id)} className="bg-muted rounded px-2 py-1">
                      {categoryName(t.id)} <span className="font-medium">{money(t.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
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
      })}
    </>
  );
}
