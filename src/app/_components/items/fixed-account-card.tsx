import { DateNav } from "@/app/_components/date-nav";
import { PieChart } from "@/components/pie-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Day } from "@/lib/finance/dates";
import { dateLong, money, relativeDate } from "@/lib/format";
import { repository } from "@/server/finance";

const ANCHOR = "vaste-lastenrekening";

/** Required balance of the fixed-costs account on `day` (real scenario), reserved per expense, with date navigation via `?datum=`. */
export function FixedAccountCard({ day, today }: { day: Day; today: Day }) {
  const overview = repository.overview(day);
  const expenses = [...overview.expenses].sort(
    (a, b) => a.nextDue - b.nextDue || a.name.localeCompare(b.name),
  );

  return (
    <section id={ANCHOR} className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Vaste lastenrekening</h2>
          <p className="text-muted-foreground first-letter:uppercase">
            {dateLong(day)}
          </p>
        </div>
        <DateNav day={day} today={today} path="/posten" anchor={ANCHOR} />
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
              Nog geen vaste lasten ingevoerd. Voeg ze hierboven toe bij Vaste
              lasten.
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
                    <th className="py-2 font-medium">
                      Volgende betaaldatum
                    </th>
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
                      <td className="py-2">
                        {relativeDate(expense.nextDue, day)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t font-semibold">
                    <td className="py-2 pr-4">Totaal benodigd</td>
                    <td className="py-2 pr-4 text-right">
                      {money(overview.target)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tbody>
              </table>
            </>
          )}
          <p className="text-muted-foreground mt-3 text-xs">
            Gereserveerd is het deel dat voor die post moet klaarstaan.
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
    </section>
  );
}
