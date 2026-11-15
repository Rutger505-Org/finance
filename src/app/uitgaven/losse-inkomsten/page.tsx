import { MonthNav } from "@/app/_components/month-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isoDay } from "@/lib/finance/dates";
import { isValidMonth, monthRange } from "@/lib/finance/spending";
import { moneyEuros, monthLabel } from "@/lib/format";
import { today as getToday, repository } from "@/server/finance";
import type { Metadata } from "next";
import { OneOffIncomeForm } from "./_components/one-off-income-form";
import { OneOffIncomeList } from "./_components/one-off-income-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Losse inkomsten" };

export default async function OneOffIncomesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { maand } = await searchParams;
  const today = isoDay(getToday());
  const current = today.slice(0, 7);
  const month = typeof maand === "string" && isValidMonth(maand) ? maand : current;
  const counterparties = repository.listCounterparties();
  const incomes = repository.listOneOffIncomes(monthRange(month));
  const total = incomes.reduce((sum, income) => sum + income.amount, 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-xl font-semibold first-letter:uppercase">{monthLabel(month)}</h2>
        <MonthNav path="/uitgaven/losse-inkomsten" month={month} current={current} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Toevoegen</CardTitle>
          <CardDescription>
            Geld dat binnenkomt op je lopende rekening maar geen vast inkomen is: iets tweedehands verkocht, een
            bijdrage van familie. Geld terug voor een uitgave (Tikkie) is een negatieve uitgave.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OneOffIncomeForm counterparties={counterparties} today={today} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Totaal: {moneyEuros(total)}</CardTitle>
          <CardDescription>
            {incomes.length} {incomes.length === 1 ? "losse inkomst" : "losse inkomsten"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OneOffIncomeList incomes={incomes} counterparties={counterparties} today={today} />
        </CardContent>
      </Card>
    </>
  );
}
