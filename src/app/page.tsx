import { BalancesCard, type AccountBalance } from "@/app/_components/overview/balances-card";
import { FactsCard } from "@/app/_components/overview/facts-card";
import { FreeToSpendCard } from "@/app/_components/overview/free-to-spend-card";
import { MonthCard } from "@/app/_components/overview/month-card";
import { OutingsCard } from "@/app/_components/overview/outings-card";
import { WeeklyCard } from "@/app/_components/overview/weekly-card";
import { WhereCard } from "@/app/_components/overview/where-card";
import { accountLabel } from "@/lib/finance/balances";
import { dayFromYMD, parseDay, toYMD, type Day } from "@/lib/finance/dates";
import {
  busiestWeekday,
  daysSinceLastSpending,
  lastOutings,
  monthComparison,
  mostExpensiveDay,
  mostExpensiveOuting,
  mostVisitedCounterparty,
  startOfMonth,
  toInsightSpending,
  topTotals,
  weekdayNames,
  weeklyTotals,
  type InsightSpending,
} from "@/lib/finance/insights";
import { savingsBalance } from "@/lib/finance/savings";
import { outingTotals, recurringOutings, trendStats } from "@/lib/finance/outing-trend";
import { dateLong, money } from "@/lib/format";
import { today as getToday, repository } from "@/server/finance";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: { absolute: "Overzicht · Financiën" } };

const cents = (euros: number) => Math.round(euros * 100);

const nameOf = (list: { id: number; name: string }[], none: string) => (id: number | null) =>
  id === null ? none : (list.find((item) => item.id === id)?.name ?? `#${id}`);

/** Dashboard: free to spend, this month, per week, where it goes, outings, balances and a few fun facts. */
export default function OverviewPage() {
  const today = getToday();
  const raw = repository.listSpendings();
  const spendings = raw.map(toInsightSpending).filter((s) => s.day <= today);
  const thisMonth = spendings.filter((s) => s.day >= startOfMonth(today));
  const categoryName = nameOf(repository.listCategories(), "Geen categorie");
  const counterpartyName = nameOf(repository.listCounterparties(), "Onbekend");

  return (
    <>
      <h1 className="text-2xl font-semibold">Overzicht</h1>
      <FreeToSpendCard current={repository.overview(today).current} today={today} />
      <div className="grid gap-6 md:grid-cols-2">
        <MonthCard comparison={monthComparison(spendings, today)} />
        <WhereCard
          categories={topTotals(thisMonth, "categoryId")}
          counterparties={topTotals(thisMonth, "counterpartyId", 5, true)}
          categoryName={categoryName}
          counterpartyName={counterpartyName}
        />
        <WeeklyCard weeks={weeklyTotals(spendings, today)} />
        <OutingsCard {...outingsSummary(raw, today)} />
        <BalancesCard accounts={balances()} />
        <FactsCard facts={facts(spendings, today, counterpartyName)} />
      </div>
    </>
  );
}

function outingsSummary(raw: { outingId: number | null; amount: number }[], today: Day) {
  const outings = repository.listOutings();
  const totals = outingTotals(raw);
  const top = mostExpensiveOuting(outings, totals);
  return {
    last: lastOutings(outings, totals, today),
    mostExpensive: top && { name: top.name, day: top.date === null ? null : parseDay(top.date), total: top.total },
    recurring: recurringOutings(outings, totals)
      .map((group) => ({ name: group.name, count: group.points.length, average: trendStats(group.points)!.average }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "nl"))
      .slice(0, 5),
  };
}

function balances(): AccountBalance[] {
  const latest = (account: "current" | "fixed"): AccountBalance => {
    const row = repository.listBalances({ account, limit: 1 })[0];
    return {
      key: account,
      label: accountLabel[account],
      amount: row ? cents(row.amount) : null,
      day: row ? parseDay(row.date) : null,
    };
  };
  return [
    latest("current"),
    latest("fixed"),
    ...repository.listSavingsAccounts().map(
      (account): AccountBalance => {
        const amount = savingsBalance(account);
        const dates = [account.balance?.date, ...account.transfers.map((t) => t.date)].filter((d) => d !== undefined);
        return {
          key: `savings-${account.id}`,
          label: account.name,
          amount: amount === null ? null : cents(amount),
          day: amount === null ? null : parseDay(dates.sort().at(-1)!),
        };
      },
    ),
  ];
}

function facts(spendings: InsightSpending[], today: Day, counterpartyName: (id: number | null) => string): string[] {
  const list: string[] = [];
  const day = mostExpensiveDay(spendings);
  if (day) list.push(`Duurste dag ooit: ${dateLong(day.day)}, ${money(day.total)}.`);
  const since = daysSinceLastSpending(spendings, today);
  if (since !== null) {
    list.push(
      since === 0
        ? "Laatste geboekte uitgave: vandaag."
        : since === 1
          ? "Laatste geboekte uitgave: gisteren."
          : `Laatste geboekte uitgave: ${since} dagen geleden.`,
    );
  }
  const visited = mostVisitedCounterparty(spendings, dayFromYMD(toYMD(today).year, 1, 1), today);
  if (visited) {
    list.push(
      `Vaakst dit jaar: ${counterpartyName(visited.id)}, ${visited.count}× voor ${money(visited.amount)} in totaal.`,
    );
  }
  const weekday = busiestWeekday(spendings);
  if (weekday) {
    list.push(`Op ${weekdayNames[weekday.weekday]} geef je het meest uit: ${money(weekday.total)} in totaal.`);
  }
  return list;
}
