import { SpendingList } from "@/app/uitgaven/_components/spending-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isoDay } from "@/lib/finance/dates";
import { outingTotals, recurringOutings, trendHref, trendStats } from "@/lib/finance/outing-trend";
import { sum } from "@/lib/finance/spending";
import { money } from "@/lib/format";
import { today as getToday, repository } from "@/server/finance";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryTotals } from "../_components/category-totals";
import { DayTotals, outingWhen } from "../_components/outing-days";
import { OutingActions } from "../_components/outing-form";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const cents = (euros: number) => Math.round(euros * 100);

const findOuting = async (params: Props["params"]) => {
  const { id } = await params;
  return /^\d+$/.test(id) ? repository.listOutings().find((o) => o.id === Number(id)) : undefined;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const outing = await findOuting(params);
  return { title: outing?.name ?? "Uitje" };
}

export default async function OutingPage({ params, searchParams }: Props) {
  const outing = await findOuting(params);
  if (!outing) notFound();
  const { terug } = await searchParams;
  const today = isoDay(getToday());

  const lookups = {
    categories: repository.listCategories(),
    outings: repository.listOutings(),
    counterparties: repository.listCounterparties(),
  };
  const spendings = repository.listSpendings({ outingId: outing.id });
  const lines = spendings.map((s) => ({ ...s, amount: cents(s.amount) }));
  const total = sum(lines);

  const group = recurringOutings(
    lookups.outings,
    outingTotals(repository.listSpendings().filter((s) => s.outingId !== null)),
  ).find((g) => g.points.some((p) => p.outingId === outing.id));
  const average = group && trendStats(group.points)!.average;
  const difference = average === undefined ? 0 : total - average;

  const month = outing.date?.slice(0, 7);
  const back =
    terug === "lijst"
      ? { href: "/uitgaven/uitjes?weergave=lijst", label: "← Lijst" }
      : {
          href: month && month !== today.slice(0, 7) ? `/uitgaven/uitjes?maand=${month}` : "/uitgaven/uitjes",
          label: "← Agenda",
        };

  return (
    <>
      <Link href={back.href} className="text-sm underline">
        {back.label}
      </Link>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-xl">{outing.name}</CardTitle>
            <CardDescription className="first-letter:uppercase">
              {outingWhen(outing) ?? "Geen datum"}
            </CardDescription>
            {outing.note && <p className="text-sm">{outing.note}</p>}
          </div>
          <div className="text-right">
            <p className="text-3xl font-semibold tabular-nums">{money(total)}</p>
            <p className="text-muted-foreground text-sm">
              {spendings.length} {spendings.length === 1 ? "uitgave" : "uitgaven"}
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <CategoryTotals lines={lines} categories={lookups.categories} />
          <DayTotals outing={outing} spendings={spendings} />
          {group && average !== undefined && (
            <p className="text-sm">
              {difference === 0
                ? "Precies gemiddeld"
                : `${money(Math.abs(difference))} ${difference > 0 ? "duurder" : "goedkoper"} dan gemiddeld`}{" "}
              <span className="text-muted-foreground">
                ({money(average)} over {group.points.length} keer)
              </span>{" "}
              ·{" "}
              <Link href={trendHref(outing.name)} className="underline">
                Verloop
              </Link>
            </p>
          )}
          <OutingActions outing={outing} afterDelete={back.href} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uitgaven</CardTitle>
        </CardHeader>
        <CardContent>
          {spendings.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nog geen uitgaven bij dit uitje.</p>
          ) : (
            <SpendingList spendings={spendings} lookups={lookups} today={today} />
          )}
        </CardContent>
      </Card>
    </>
  );
}
