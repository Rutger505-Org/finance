import {
  ItemsSection,
  type ItemRow,
} from "@/app/_components/items/items-section";
import { itemRow, monthlySlices } from "@/app/_components/items/rows";
import { ScenarioBar } from "@/app/_components/items/scenario-bar";
import { TransfersCard } from "@/app/_components/items/transfers-card";
import { PieChart } from "@/components/pie-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isoDay, type Day } from "@/lib/finance/dates";
import { inScenario, savingsPerMonth } from "@/lib/finance/savings";
import { cyclesPerYear } from "@/lib/finance/schedule";
import type { Cycle } from "@/lib/finance/schemas";
import { moneyEuros } from "@/lib/format";
import { cn } from "@/lib/utils";
import { today as getToday, repository } from "@/server/finance";
import { selectedScenario } from "@/server/scenario";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Posten" };

const perMonth = (items: { amount: number; cycle: Cycle; active: boolean }[]) =>
  items
    .filter((item) => item.active)
    .reduce(
      (total, item) => total + (item.amount * cyclesPerYear(item.cycle)) / 12,
      0,
    );

/** Incomes and fixed costs of the selected scenario on one page, with what's left per month and the transfers. */
export default async function PostenPage() {
  const today = getToday();
  const { scenarios, selected } = await selectedScenario();
  const incomes = inScenario(repository.listIncomes(), selected.id);
  const expenses = inScenario(repository.listExpenses(), selected.id);
  return (
    <>
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Inkomsten en vaste lasten</h1>
        <ScenarioBar scenarios={scenarios} selected={selected} />
      </div>
      <MonthlyCard
        scenarioId={selected.id}
        realId={scenarios.find((s) => s.real)?.id}
        today={today}
      />
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
        scenarios={scenarios}
        selected={selected}
        rows={incomes.map((item): ItemRow => ({
          item,
          ...itemRow(item, today),
        }))}
      />
      <ItemsSection
        kind="expense"
        title="Vaste lasten"
        today={isoDay(today)}
        scenarios={scenarios}
        selected={selected}
        rows={expenses.map((item): ItemRow => ({
          item,
          ...itemRow(item, today),
        }))}
      />
      {selected.real && <TransfersCard today={today} />}
    </>
  );
}

/** Average incomes minus fixed costs per month, plus what the savings of this scenario add; compared with the real one. */
function MonthlyCard({
  scenarioId,
  realId,
  today,
}: {
  scenarioId: number;
  realId?: number;
  today: Day;
}) {
  const incomes = repository.listIncomes();
  const expenses = repository.listExpenses();
  const accounts = repository.listSavingsAccounts();
  const left = (id: number) =>
    perMonth(inScenario(incomes, id)) - perMonth(inScenario(expenses, id));
  const spendable = (id: number) =>
    left(id) + (savingsPerMonth(accounts, id, today) ?? 0);
  const own = left(scenarioId);
  const savings = savingsPerMonth(accounts, scenarioId, today);
  const difference =
    realId !== undefined && realId !== scenarioId
      ? spendable(scenarioId) - spendable(realId)
      : null;
  const lines: { label: string; value: number; strong?: boolean }[] = [
    { label: "Inkomsten", value: perMonth(inScenario(incomes, scenarioId)) },
    {
      label: "Vaste lasten",
      value: -perMonth(inScenario(expenses, scenarioId)),
    },
    { label: "Over", value: own, strong: savings === null },
  ];
  if (savings !== null) {
    lines.push({ label: "Uit spaargeld", value: savings });
    lines.push({ label: "Te besteden", value: own + savings, strong: true });
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Per maand</CardTitle>
        <CardDescription>
          Gemiddeld, actieve posten en spaarrekeningen in deze situatie.{" "}
          <Link href="/spaargeld" className="underline">
            Spaargeld
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-sm tabular-nums">
        {lines.map((line) => (
          <p
            key={line.label}
            className={cn(
              "flex justify-between",
              line.strong && "border-t pt-1 font-medium",
            )}
          >
            <span>{line.label}</span>
            <span
              className={cn(line.value < 0 && line.strong && "text-red-700")}
            >
              {moneyEuros(line.value)}
            </span>
          </p>
        ))}
        {difference !== null && (
          <p className="text-muted-foreground flex justify-between pt-1">
            <span>Verschil met de echte situatie</span>
            <span>
              {difference > 0 ? "+" : ""}
              {moneyEuros(difference)}
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
