import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { repository } from "@/server/finance";
import type { Metadata } from "next";
import { Categories } from "./categories";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Categorieën" };

export default function CategoriesPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Categorieën</CardTitle>
        <CardDescription>Waaraan je geld uitgeeft.</CardDescription>
      </CardHeader>
      <CardContent>
        <Categories categories={repository.listCategories()} />
      </CardContent>
    </Card>
  );
}
