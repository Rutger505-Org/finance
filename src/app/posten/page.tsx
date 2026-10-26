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
