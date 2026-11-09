import { ItemsSection, type ItemRow } from "@/app/_components/items/items-section";
import { itemRow, monthlySlices } from "@/app/_components/items/rows";
import { TransfersCard } from "@/app/_components/items/transfers-card";
import { PieChart } from "@/components/pie-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isoDay } from "@/lib/finance/dates";
import { today as getToday, repository } from "@/server/finance";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Inkomsten" };

export default function IncomesPage() {
  const today = getToday();
  const items = repository.listIncomes();
  return (
    <>
      <h1 className="text-2xl font-semibold">Inkomsten</h1>
      <Card>
        <CardHeader>
          <CardTitle>Inkomsten per maand</CardTitle>
        </CardHeader>
        <CardContent>
          <PieChart title="Verdeling inkomsten per maand" slices={monthlySlices(items)} />
        </CardContent>
      </Card>
      <ItemsSection
        kind="income"
        title="Inkomsten"
        today={isoDay(today)}
        rows={items.map((item): ItemRow => ({ item, ...itemRow(item, today) }))}
      />
      <TransfersCard today={today} />
    </>
  );
}
