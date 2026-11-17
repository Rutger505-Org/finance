import { FixedAccountCard } from "@/app/_components/items/fixed-account-card";
import {
  ItemsSection,
  type ItemRow,
} from "@/app/_components/items/items-section";
import { itemRow, monthlySlices, perMonth } from "@/app/_components/items/rows";
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
import { isValidIsoDate, isoDay, parseDay, type Day } from "@/lib/finance/dates";
import { inScenario, savingsPerMonth } from "@/lib/finance/savings";
import { moneyEuros } from "@/lib/format";
import { cn } from "@/lib/utils";
import { today as getToday, repository } from "@/server/finance";
import { selectedScenario } from "@/server/scenario";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Posten" };

/** Incomes and fixed costs of the selected scenario on one page, with what's left per month, the transfers and the fixed-costs account (`?datum=`). */
export default async function PostenPage({
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
              slices={monthlySlices(incomes, today)}
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
              slices={monthlySlices(expenses, today)}
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
      {selected.real && (
        <>
          <TransfersCard today={today} />
          <FixedAccountCard day={day} today={today} />
        </>
      )}
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
    perMonth(inScenario(incomes, id), today) - perMonth(inScenario(expenses, id), today);
  const spendable = (id: number) =>
    left(id) + (savingsPerMonth(accounts, id, today) ?? 0);
  const own = left(scenarioId);
  const savings = savingsPerMonth(accounts, scenarioId, today);
  const difference =
    realId !== undefined && realId !== scenarioId
      ? spendable(scenarioId) - spendable(realId)
      : null;
  const lines: { label: string; value: number; strong?: boolean }[] = [
    { label: "Inkomsten", value: perMonth(inScenario(incomes, scenarioId), today) },
    {
      label: "Vaste lasten",
      value: -perMonth(inScenario(expenses, scenarioId), today),
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
