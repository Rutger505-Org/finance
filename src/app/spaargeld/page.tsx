import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isoDay } from "@/lib/finance/dates";
import { savingsPerMonth, summarizeAccount } from "@/lib/finance/savings";
import { moneyEuros } from "@/lib/format";
import { today as getToday, repository } from "@/server/finance";
import type { Metadata } from "next";
import { SavingsList } from "./savings-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Spaargeld" };

export default function SavingsPage() {
  const today = getToday();
  const accounts = repository.listSavingsAccounts();
  const scenarios = repository.listScenarios();
  const total = accounts.reduce(
    (sum, account) => sum + (account.balance?.amount ?? 0),
    0,
  );
  return (
    <>
      <h1 className="text-2xl font-semibold">Spaargeld</h1>
      {accounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Totaal {moneyEuros(total)}</CardTitle>
            <CardDescription>
              Laatste saldo van elke spaarrekening. Per maand uit spaargeld telt
              mee in &ldquo;Per maand&rdquo; bij Posten, alleen in de situaties
              van de rekening.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm tabular-nums">
            {scenarios.map((scenario) => {
              const perMonth = savingsPerMonth(accounts, scenario.id, today);
              return (
                <p key={scenario.id} className="flex justify-between">
                  <span>Per maand uit spaargeld · {scenario.name}</span>
                  <span>{perMonth === null ? "–" : moneyEuros(perMonth)}</span>
                </p>
              );
            })}
          </CardContent>
        </Card>
      )}
      <SavingsList
        accounts={accounts.map((account) => ({
          account,
          summary: summarizeAccount(account, today),
        }))}
        scenarios={scenarios}
        today={isoDay(today)}
      />
    </>
  );
}
