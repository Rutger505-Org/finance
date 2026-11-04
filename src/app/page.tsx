import { DateNav } from "@/app/_components/date-nav";
import { PieChart } from "@/components/pie-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isValidIsoDate, parseDay } from "@/lib/finance/dates";
import { dateLong, money, relativeDate } from "@/lib/format";
import { today as getToday, repository } from "@/server/finance";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { datum } = await searchParams;
  const today = getToday();
  const day =
    typeof datum === "string" && isValidIsoDate(datum)
      ? parseDay(datum)
      : today;
  const overview = repository.overview(day);
  const expenses = [...overview.expenses].sort(
    (a, b) => a.nextDue - b.nextDue || a.name.localeCompare(b.name),
  );

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Vaste lastenrekening</h1>
          <p className="text-muted-foreground first-letter:uppercase">
            {dateLong(day)}
          </p>
        </div>
        <DateNav day={day} today={today} />
      </div>

      {overview.warnings.map((warning) => (
        <div
          key={warning}
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
        >
          {warning}
        </div>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Verwacht saldo: {money(overview.target)}</CardTitle>
          <p className="text-muted-foreground text-sm">
            Benodigd bedrag op de vaste lastenrekening op deze datum, verdeeld
            over de posten hieronder.
          </p>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nog geen vaste lasten ingevoerd. Voeg posten toe bij{" "}
              <Link href="/posten" className="underline">
                Posten
              </Link>
              .
            </p>
          ) : (
            <>
              <ul className="divide-y text-sm tabular-nums sm:hidden">
                {expenses.map((expense) => (
                  <li
                    key={expense.id ?? expense.name}
                    className="flex items-start justify-between gap-4 py-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{expense.name}</p>
                      <p className="text-muted-foreground">
                        {relativeDate(expense.nextDue, day)} ·{" "}
                        {money(expense.amount)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {expense.account === "current"
                          ? "Terug naar lopende rekening"
                          : "Incasso van vaste lastenrekening"}
                      </p>
                    </div>
                    <p className="shrink-0 text-right font-medium">
                      {money(expense.reserved)}
                    </p>
                  </li>
                ))}
                <li className="flex justify-between gap-4 py-2 font-semibold">
                  <span>Totaal benodigd</span>
                  <span>{money(overview.target)}</span>
                </li>
              </ul>
              <table className="hidden w-full text-sm sm:table">
                <thead className="text-muted-foreground text-left">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Doel</th>
                    <th className="py-2 pr-4 text-right font-medium">
                      Gereserveerd
                    </th>
                    <th className="py-2 pr-4 text-right font-medium">
                      Postbedrag
                    </th>
                    <th className="py-2 pr-4 font-medium">
                      Volgende betaaldatum
                    </th>
                    <th className="py-2 font-medium">Geld gaat naar</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {expenses.map((expense) => (
                    <tr key={expense.id ?? expense.name} className="border-t">
                      <td className="py-2 pr-4">{expense.name}</td>
                      <td className="py-2 pr-4 text-right font-medium">
                        {money(expense.reserved)}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {money(expense.amount)}
                      </td>
                      <td className="py-2 pr-4">
                        {relativeDate(expense.nextDue, day)}
                      </td>
                      <td className="text-muted-foreground py-2">
                        {expense.account === "current"
                          ? "Terug naar lopende rekening"
                          : "Incasso van vaste lastenrekening"}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t font-semibold">
                    <td className="py-2 pr-4">Totaal benodigd</td>
                    <td className="py-2 pr-4 text-right">
                      {money(overview.target)}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tbody>
              </table>
            </>
          )}
          <p className="text-muted-foreground mt-3 text-xs">
            Gereserveerd is het deel dat voor die post moet klaarstaan. Bij
            posten betaald vanaf de lopende rekening wordt het bedrag op de
            betaaldatum teruggeboekt.
          </p>
        </CardContent>
      </Card>

      {overview.target > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Verdeling gereserveerd saldo</CardTitle>
          </CardHeader>
          <CardContent>
            <PieChart
              title="Verdeling gereserveerd saldo per post"
              slices={expenses.map((expense) => ({
                key: String(expense.id ?? expense.name),
                label: expense.name,
                value: expense.reserved,
              }))}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6 text-sm">
          Volgende overboeking van lopend naar vaste lasten:{" "}
          <strong>{relativeDate(overview.transfer.next, day)}</strong> —{" "}
          <strong>{money(overview.transfer.amount)}</strong>.
        </CardContent>
      </Card>
    </main>
  );
}
