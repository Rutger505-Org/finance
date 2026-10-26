import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { repository } from "@/server/finance";
import { JsonEditor } from "./_components/json-editor";

export const dynamic = "force-dynamic";

export default function JsonPage() {
  const config = JSON.stringify(repository.getConfig(), null, 2);
  return (
    <>
      <h1 className="text-2xl font-semibold">JSON</h1>
      <Card>
        <CardHeader>
          <CardTitle>Alle instellingen, inkomsten en vaste lasten</CardTitle>
          <CardDescription>
            Plakken, aanpassen, opslaan. Posten met een <code>id</code> worden bijgewerkt, zonder <code>id</code>{" "}
            toegevoegd, en wat ontbreekt wordt verwijderd. Saldo&apos;s blijven staan. Hetzelfde document als{" "}
            <code>GET/PUT /api/v1/config</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JsonEditor initial={config} />
        </CardContent>
      </Card>
    </>
  );
}
