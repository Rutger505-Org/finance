import type { Item } from "@/app/_components/items/item-form";
import { ItemsSection, type ItemRow } from "@/app/_components/items/items-section";
import { itemRow, monthlySlices } from "@/app/_components/items/rows";
import { ScenarioBar } from "@/app/_components/items/scenario-bar";
import { TransfersCard } from "@/app/_components/items/transfers-card";
import { PieChart } from "@/components/pie-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isoDay } from "@/lib/finance/dates";
import { inScenario, summarizeSavings } from "@/lib/finance/savings";
import { cyclesPerYear } from "@/lib/finance/schedule";
import type { Cycle } from "@/lib/finance/schemas";
import { moneyEuros } from "@/lib/format";
import { cn } from "@/lib/utils";
import { today as getToday, repository } from "@/server/finance";
import { selectedScenario } from "@/server/scenario";
import Link from "next/link";

const perMonth = (items: { amount: number; cycle: Cycle; active: boolean }[]) =>
  items.filter((item) => item.active).reduce((total, item) => total + (item.amount * cyclesPerYear(item.cycle)) / 12, 0);

/** Inkomsten or Vaste lasten: the items of the selected scenario, with what's left per month. */
export async function ItemsPage({ kind, title }: { kind: "income" | "expense"; title: string }) {
  const today = getToday();
  const { scenarios, selected } = await selectedScenario();
  const items: Item[] =
    kind === "income"
      ? inScenario(repository.listIncomes(), selected.id)
      : inScenario(repository.listExpenses(), selected.id);
  return (
    <>
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <ScenarioBar scenarios={scenarios} selected={selected} />
      </div>
      <MonthlyCard scenarioId={selected.id} realId={scenarios.find((s) => s.real)?.id} today={today} />
      <Card>
        <CardHeader>
          <CardTitle>{title} per maand</CardTitle>
        </CardHeader>
        <CardContent>
          <PieChart title={`Verdeling ${title.toLowerCase()} per maand`} slices={monthlySlices(items)} />
        </CardContent>
      </Card>
      <ItemsSection
        kind={kind}
        title={title}
        today={isoDay(today)}
        scenarios={scenarios}
        selected={selected}
        rows={items.map((item): ItemRow => ({ item, ...itemRow(item, today) }))}
      />
      {selected.real && <TransfersCard today={today} />}
    </>
  );
}

/** Average incomes minus fixed costs per month, plus what the savings can add; compared with the real scenario. */
function MonthlyCard({ scenarioId, realId, today }: { scenarioId: number; realId?: number; today: number }) {
  const incomes = repository.listIncomes();
  const expenses = repository.listExpenses();
  const left = (id: number) => perMonth(inScenario(incomes, id)) - perMonth(inScenario(expenses, id));
  const plan = repository.getSavings();
  const savings = plan && summarizeSavings(plan, today);
  const own = left(scenarioId);
  const difference = realId !== undefined && realId !== scenarioId ? own - left(realId) : null;
  const lines: { label: string; value: number; strong?: boolean }[] = [
    { label: "Inkomsten", value: perMonth(inScenario(incomes, scenarioId)) },
    { label: "Vaste lasten", value: -perMonth(inScenario(expenses, scenarioId)) },
    { label: "Over", value: own, strong: !savings?.perMonth },
  ];
  if (savings?.perMonth != null) {
    lines.push({ label: "Uit spaargeld", value: savings.perMonth });
    lines.push({ label: "Te besteden", value: own + savings.perMonth, strong: true });
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Per maand</CardTitle>
        <CardDescription>
          Gemiddeld, actieve posten in deze situatie.{" "}
          {savings ? (
            <Link href="/spaargeld" className="underline">
              Spaargeld
            </Link>
          ) : (
            <Link href="/spaargeld" className="underline">
              Spaargeld instellen
            </Link>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-sm tabular-nums">
        {lines.map((line) => (
          <p key={line.label} className={cn("flex justify-between", line.strong && "border-t pt-1 font-medium")}>
            <span>{line.label}</span>
            <span className={cn(line.value < 0 && line.strong && "text-red-700")}>{moneyEuros(line.value)}</span>
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
