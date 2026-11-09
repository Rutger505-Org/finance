import { ItemsSection, type ItemRow } from "@/app/_components/items/items-section";
import { itemRow, monthlySlices } from "@/app/_components/items/rows";
import { TransfersCard } from "@/app/_components/items/transfers-card";
import { PieChart } from "@/components/pie-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isoDay } from "@/lib/finance/dates";
import { today as getToday, repository } from "@/server/finance";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Vaste lasten" };

export default function ExpensesPage() {
  const today = getToday();
  const items = repository.listExpenses();
  return (
    <>
      <h1 className="text-2xl font-semibold">Vaste lasten</h1>
      <Card>
        <CardHeader>
          <CardTitle>Vaste lasten per maand</CardTitle>
        </CardHeader>
        <CardContent>
          <PieChart title="Verdeling vaste lasten per maand" slices={monthlySlices(items)} />
        </CardContent>
      </Card>
      <ItemsSection
        kind="expense"
        title="Vaste lasten"
        today={isoDay(today)}
        rows={items.map((item): ItemRow => ({ item, ...itemRow(item, today) }))}
      />
      <TransfersCard today={today} />
    </>
  );
}
