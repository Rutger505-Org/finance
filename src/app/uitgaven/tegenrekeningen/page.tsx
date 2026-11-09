import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { repository } from "@/server/finance";
import type { Metadata } from "next";
import { Counterparties } from "./_components/counterparties";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tegenrekeningen" };

export default function CounterpartiesPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tegenrekeningen</CardTitle>
        <CardDescription>
          Om afschriften te herkennen. Een nieuwe uitgave aan een tegenrekening krijgt zijn standaardcategorie.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Counterparties counterparties={repository.listCounterparties()} categories={repository.listCategories()} />
      </CardContent>
    </Card>
  );
}
