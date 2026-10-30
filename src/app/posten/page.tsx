import { PieChart, type PieSlice } from "@/components/pie-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { transferAmount } from "@/lib/finance/plan";
import { cyclesPerYear, nextOccurrence } from "@/lib/finance/schedule";
import type { Cycle } from "@/lib/finance/schemas";
import { accountLabel, cycleLabel, money, moneyEuros, relativeDate } from "@/lib/format";
import { repository, today as getToday } from "@/server/finance";
import { ItemsSection, type ItemRow } from "./_components/items-section";
import { SettingsForm } from "./_components/settings-form";

export const dynamic = "force-dynamic";

export default function PostenPage() {
  const today = getToday();
  const incomes = repository.listIncomes();
  const expenses = repository.listExpenses();
  const settings = repository.getSettings();

  const row = (item: { amount: number; cycle: Cycle }) => ({
    amount: moneyEuros(item.amount),
    cycle: cycleLabel(item.cycle),
    next: relativeDate(nextOccurrence(item.cycle, today - 1), today),
    monthly: moneyEuros((item.amount * cyclesPerYear(item.cycle)) / 12),
  });

  /** Active items as average monthly cents. */
  const monthlySlices = (items: { id: number; name: string; amount: number; cycle: Cycle; active: boolean }[]) =>
    items
      .filter((item) => item.active)
      .map((item): PieSlice => ({
        key: String(item.id),
        label: item.name,
        value: (item.amount * 100 * cyclesPerYear(item.cycle)) / 12,
      }));

  const transfer = transferAmount({
    incomes: [],
    expenses: expenses
      .filter((expense) => expense.active)
      .map((expense) => ({ ...expense, amount: Math.round(expense.amount * 100) })),
    transfer: { cycle: settings.transfer.cycle, amount: "auto" },
  });

  return (
    <>
      <h1 className="text-2xl font-semibold">Posten</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Inkomsten per maand</CardTitle>
          </CardHeader>
          <CardContent>
            <PieChart title="Verdeling inkomsten per maand" slices={monthlySlices(incomes)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Vaste lasten per maand</CardTitle>
          </CardHeader>
          <CardContent>
            <PieChart title="Verdeling vaste lasten per maand" slices={monthlySlices(expenses)} />
          </CardContent>
        </Card>
      </div>
      <ItemsSection
        kind="income"
        title="Inkomsten"
        rows={incomes.map((item): ItemRow => ({ item, ...row(item) }))}
      />
      <ItemsSection
        kind="expense"
        title="Vaste lasten"
        rows={expenses.map((item): ItemRow => ({ item, ...row(item), detail: accountLabel[item.account] }))}
      />
      <Card>
        <CardHeader>
          <CardTitle>Overboeking naar vaste lasten</CardTitle>
          <CardDescription>
            Wanneer je van je lopende naar je vaste lastenrekening overboekt. Automatisch = gemiddeld nodig per keer,
            naar boven afgerond op hele euro&apos;s.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm settings={settings} needed={money(Math.ceil(transfer.needed / 100) * 100)} />
        </CardContent>
      </Card>
    </>
  );
}
