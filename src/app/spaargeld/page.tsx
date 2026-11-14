import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isoDay, parseDay } from "@/lib/finance/dates";
import { summarizeSavings } from "@/lib/finance/savings";
import { cn } from "@/lib/utils";
import { date, monthLabel, moneyEuros } from "@/lib/format";
import { today as getToday, repository } from "@/server/finance";
import type { Metadata } from "next";
import { SavingsForm } from "./savings-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Spaargeld" };

export default function SavingsPage() {
  const today = getToday();
  const savings = repository.getSavings();
  const summary = savings && summarizeSavings(savings, today);
  return (
    <>
      <h1 className="text-2xl font-semibold">Spaargeld</h1>
      {savings && summary && (
        <Card>
          <CardHeader>
            <CardTitle>Per maand uit spaargeld</CardTitle>
            <CardDescription>
              Wat na de geplande uitgaven over is, verdeeld over de maanden
              {summary.firstMonth ? ` van ${monthLabel(summary.firstMonth)} t/m ${monthLabel(savings.until)}` : ""}.
              Telt mee in &ldquo;Per maand&rdquo; bij Inkomsten en Vaste lasten.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm tabular-nums">
            <p className="flex justify-between">
              <span>
                Saldo op {date(parseDay(savings.date))} {savings.date.slice(0, 4)}
              </span>
              <span>{moneyEuros(savings.balance)}</span>
            </p>
            {summary.withdrawals.map((w, index) => (
              <p key={index} className="text-muted-foreground flex justify-between">
                <span>
                  {w.name} · {date(parseDay(w.date))} {w.date.slice(0, 4)}
                </span>
                <span>{moneyEuros(-w.amount)}</span>
              </p>
            ))}
            <p className="flex justify-between border-t pt-1">
              <span>Vrij</span>
              <span className={cn(summary.free < 0 && "text-red-700")}>{moneyEuros(summary.free)}</span>
            </p>
            <p className="flex justify-between">
              <span>Maanden</span>
              <span>{summary.months}</span>
            </p>
            <p className="flex justify-between border-t pt-1 text-base font-medium">
              <span>Per maand</span>
              <span className={cn((summary.perMonth ?? 0) < 0 && "text-red-700")}>
                {summary.perMonth === null ? "–" : moneyEuros(summary.perMonth)}
              </span>
            </p>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Spaarrekening</CardTitle>
          <CardDescription>
            Saldo, tot wanneer het moet duren en wat er nog van af moet (bijv. een jaarlijks bedrag). Uitgaven op of voor
            de saldodatum zitten al in het saldo en tellen niet mee.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SavingsForm savings={savings} today={isoDay(today)} />
        </CardContent>
      </Card>
    </>
  );
}
