import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { repository } from "@/server/finance";
import { Categories } from "./_components/categories";
import { Counterparties } from "./_components/counterparties";

export const dynamic = "force-dynamic";

export default function CounterpartiesPage() {
  const categories = repository.listCategories();
  return (
    <>
      <h1 className="text-2xl font-semibold">Tegenrekeningen</h1>
      <Card>
        <CardHeader>
          <CardTitle>Tegenrekeningen</CardTitle>
          <CardDescription>
            Om afschriften te herkennen. Een nieuwe uitgave aan een tegenrekening krijgt zijn standaardcategorie.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Counterparties counterparties={repository.listCounterparties()} categories={categories} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Categorieën</CardTitle>
          <CardDescription>Waaraan je geld uitgeeft.</CardDescription>
        </CardHeader>
        <CardContent>
          <Categories categories={categories} />
        </CardContent>
      </Card>
    </>
  );
}
