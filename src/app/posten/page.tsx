import { PieChart, type PieSlice } from "@/components/pie-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isoDay } from "@/lib/finance/dates";
import { cyclesPerYear, nextOccurrence } from "@/lib/finance/schedule";
import type { Cycle } from "@/lib/finance/schemas";
import {
  cycleLabel,
  money,
  moneyEuros,
  relativeDate,
} from "@/lib/format";
import { today as getToday, repository } from "@/server/finance";
import { ItemsSection, type ItemRow } from "./_components/items-section";
import { SettingsForm } from "./_components/settings-form";

export const dynamic = "force-dynamic";

export default function PostenPage() {
  const today = getToday();
  const incomes = repository.listIncomes();
  const expenses = repository.listExpenses();
  const settings = repository.getSettings();

  const row = (item: { amount: number; cycle: Cycle }) => {
    const nextDue = nextOccurrence(item.cycle, today - 1);
    const monthlyEuros = (item.amount * cyclesPerYear(item.cycle)) / 12;
    return {
      amount: moneyEuros(item.amount),
      cycle: cycleLabel(item.cycle),
      next: relativeDate(nextDue, today),
      nextDue: isoDay(nextDue),
      monthly: moneyEuros(monthlyEuros),
      monthlyEuros,
    };
  };

  /** Active items as average monthly cents. */
  const monthlySlices = (
    items: {
      id: number;
      name: string;
      amount: number;
      cycle: Cycle;
      active: boolean;
    }[],
  ) =>
    items
      .filter((item) => item.active)
      .map((item): PieSlice => ({
        key: String(item.id),
        label: item.name,
        value: (item.amount * 100 * cyclesPerYear(item.cycle)) / 12,
      }));

  const amounts = repository.transfers(today).map((t) => money(t.amount));

  return (
    <>
      <h1 className="text-2xl font-semibold">Posten</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Inkomsten per maand</CardTitle>
          </CardHeader>
          <CardContent>
            <PieChart
              title="Verdeling inkomsten per maand"
              slices={monthlySlices(incomes)}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Vaste lasten per maand</CardTitle>
          </CardHeader>
          <CardContent>
            <PieChart
              title="Verdeling vaste lasten per maand"
              slices={monthlySlices(expenses)}
            />
          </CardContent>
        </Card>
      </div>
      <ItemsSection
        kind="income"
        title="Inkomsten"
        today={isoDay(today)}
        rows={incomes.map((item): ItemRow => ({ item, ...row(item) }))}
      />
      <ItemsSection
        kind="expense"
        title="Vaste lasten"
        today={isoDay(today)}
        rows={expenses.map((item): ItemRow => ({ item, ...row(item) }))}
      />
      <Card>
        <CardHeader>
          <CardTitle>Overboekingen naar vaste lasten</CardTitle>
          <CardDescription>
            Wanneer en hoeveel je automatisch van je lopende naar je vaste
            lastenrekening overboekt. Vaste bedragen en hele inkomens tellen
            eerst; automatische overboekingen dekken de rest van wat er
            gemiddeld nodig is, naar boven afgerond op hele euro&apos;s.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm
            settings={settings}
            incomes={incomes}
            amounts={amounts}
          />
        </CardContent>
      </Card>
    </>
  );
}
