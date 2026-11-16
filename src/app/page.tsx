import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: { absolute: "Overzicht · Financiën" } };

export default function OverviewPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Overzicht</h1>
      <Card>
        <CardHeader>
          <CardTitle>Vaste lastenrekening</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <Link href="/posten#vaste-lastenrekening" className="underline">
            Verwacht saldo per post staat bij Posten
          </Link>
        </CardContent>
      </Card>
    </>
  );
}
