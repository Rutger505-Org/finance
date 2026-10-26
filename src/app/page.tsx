import { BalanceForm } from "@/app/_components/balance-form";
import { DateNav } from "@/app/_components/date-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isValidIsoDate, parseDay } from "@/lib/finance/dates";
import type { MovementKind } from "@/lib/finance/plan";
import { accountLabel, date, dateLong, money, relativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { repository, today as getToday } from "@/server/finance";
import Link from "next/link";

export const dynamic = "force-dynamic";

const kindLabel: Record<MovementKind, string> = {
  income: "Inkomen",
  transfer: "Overboeking",
  charge: "Incasso",
  refund: "Terug naar lopende",
};

const kindStyle: Record<MovementKind, string> = {
  income: "bg-emerald-100 text-emerald-800",
  transfer: "bg-sky-100 text-sky-800",
  charge: "bg-amber-100 text-amber-800",
  refund: "bg-violet-100 text-violet-800",
};

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("flex justify-between gap-4 text-sm", className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { datum } = await searchParams;
  const today = getToday();
  const day = typeof datum === "string" && isValidIsoDate(datum) ? parseDay(datum) : today;
  const o = repository.overview(day);
  const empty = o.expenses.length === 0 && o.nextIncomes.length === 0;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Overzicht</h1>
          <p className="text-muted-foreground first-letter:uppercase">{dateLong(day)}</p>
        </div>
        <DateNav day={day} today={today} />
      </div>

      {empty && (
        <Card>
          <CardContent className="pt-6 text-sm">
            Nog niets ingevoerd. Voeg inkomsten en vaste lasten toe bij{" "}
            <Link href="/posten" className="underline">
              Posten
            </Link>
            , of plak een complete config bij{" "}
            <Link href="/json" className="underline">
              JSON
            </Link>
            .
          </CardContent>
        </Card>
      )}

      {o.warnings.map((warning) => (
        <div key={warning} className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {warning}
        </div>
      ))}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vaste lastenrekening</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Moet nu op staan</p>
              <p className="text-3xl font-semibold tabular-nums">{money(o.target)}</p>
            </div>
            {o.fixed ? (
              <div className="space-y-1">
                <Row label={`Saldo op ${date(o.fixed.date)}`} value={money(o.fixed.balance)} />
                {o.fixed.date !== day && <Row label="Verwacht nu (volgens planning)" value={money(o.fixed.expected)} />}
                <Row
                  label={o.fixed.difference >= 0 ? "Overschot" : "Tekort"}
                  value={money(Math.abs(o.fixed.difference))}
                  className={cn("font-medium", o.fixed.difference >= 0 ? "text-emerald-700" : "text-red-700")}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Vul je saldo in om tekort of overschot te zien.</p>
            )}
            <div className="rounded-md bg-sky-50 p-3 text-sm text-sky-900">
              Volgende overboeking lopende → vaste lasten: <strong>{relativeDate(o.transfer.next, day)}</strong>,{" "}
              <strong className="tabular-nums">{money(o.transfer.amount)}</strong>
              {o.transfer.amount > o.transfer.needed && (
                <span className="block text-xs text-sky-800/80">
                  Nodig is {money(o.transfer.needed)}, de rest bouwt buffer op.
                </span>
              )}
            </div>
            <BalanceForm account="fixed" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lopende rekening</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {o.current ? (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Vrij te besteden
                    {o.current.periodEnd !== undefined && <> t/m {date(o.current.periodEnd - 1)}</>}
                  </p>
                  <p className={cn("text-3xl font-semibold tabular-nums", o.current.free < 0 && "text-red-700")}>
                    {money(o.current.free)}
                  </p>
                  {o.current.perDay !== undefined && (
                    <p className="text-sm text-muted-foreground">
                      {money(o.current.perDay)} per dag, nog {o.current.daysLeft} dagen
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Row label={`Saldo op ${date(o.current.date)}`} value={money(o.current.balance)} />
                  {o.current.additions.map((m) => (
                    <Row key={`${m.day}-${m.name}`} label={`+ ${m.name} (${date(m.day)})`} value={money(m.amount)} className="text-emerald-700" />
                  ))}
                  {o.current.deductions.map((m) => (
                    <Row key={`${m.day}-${m.name}`} label={`− ${m.name} (${date(m.day)})`} value={money(m.amount)} className="text-red-700" />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Terugboekingen uit vaste lasten tellen niet mee: dat geld is al voor die post.
                  {o.current.date !== day && " Uitgaven sinds de saldodatum zijn niet bekend."}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Vul je saldo in om te zien wat je vrij kunt besteden.</p>
            )}
            {o.nextIncomes.length > 0 && (
              <p className="text-sm">
                Volgende inkomsten:{" "}
                {o.nextIncomes.map((m) => `${m.name} ${relativeDate(m.day, day)} (${money(m.amount)})`).join(", ")}
              </p>
            )}
            <BalanceForm account="current" />
          </CardContent>
        </Card>
      </div>

      {o.expenses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Wat er op de vaste lastenrekening moet staan</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Post</th>
                  <th className="py-2 pr-4 text-right font-medium">Gereserveerd</th>
                  <th className="py-2 pr-4 text-right font-medium">Bedrag</th>
                  <th className="py-2 pr-4 font-medium">Volgende keer</th>
                  <th className="py-2 font-medium">Gaat</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {[...o.expenses]
                  .sort((a, b) => a.nextDue - b.nextDue || a.name.localeCompare(b.name))
                  .map((line) => (
                    <tr key={line.id ?? line.name} className="border-t">
                      <td className="py-2 pr-4">{line.name}</td>
                      <td className="py-2 pr-4 text-right font-medium">{money(line.reserved)}</td>
                      <td className="py-2 pr-4 text-right">{money(line.amount)}</td>
                      <td className="py-2 pr-4">{relativeDate(line.nextDue, day)}</td>
                      <td className="py-2 text-muted-foreground">{accountLabel[line.account]}</td>
                    </tr>
                  ))}
                <tr className="border-t font-semibold">
                  <td className="py-2 pr-4">Totaal</td>
                  <td className="py-2 pr-4 text-right">{money(o.target)}</td>
                  <td colSpan={3} />
                </tr>
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-foreground">
              Gereserveerd: wat er voor die post nu moet klaarstaan, zodat hij met zijn deel van elke overboeking nooit
              tekortkomt.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Komende {o.window} dagen</CardTitle>
          </CardHeader>
          <CardContent>
            {o.upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">Niets gepland.</p>
            ) : (
              <ul className="divide-y text-sm">
                {o.upcoming.map((m, index) => (
                  <li key={index} className="flex items-center justify-between gap-3 py-2">
                    <span className="w-24 shrink-0 text-muted-foreground">{relativeDate(m.day, day)}</span>
                    <span className="flex-1">{m.name}</span>
                    <span className={cn("hidden rounded px-2 py-0.5 text-xs sm:inline", kindStyle[m.kind])}>
                      {kindLabel[m.kind]}
                    </span>
                    <span className="w-24 text-right tabular-nums">{money(m.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Per maand</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <Row label="Inkomsten" value={money(o.monthly.income)} />
            <Row label="Vaste lasten" value={money(o.monthly.costs)} />
            <Row label="Overboeking" value={money(o.monthly.transfer)} />
            <Row label="Over na overboeking" value={money(o.monthly.income - o.monthly.transfer)} className="border-t pt-1 font-medium" />
            <p className="pt-2 text-xs text-muted-foreground">Gemiddelden; jaarlijkse en 28-daagse posten omgerekend.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
