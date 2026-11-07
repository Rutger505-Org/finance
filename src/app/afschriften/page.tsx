import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { repository } from "@/server/finance";
import Link from "next/link";
import { ImportForm } from "./_components/import-form";
import { OpenLines } from "./_components/open-lines";

export const dynamic = "force-dynamic";

export default function StatementsPage() {
  const open = repository.listStatementLines({ status: "open" });
  const counterparties = repository.listCounterparties();
  return (
    <>
      <h1 className="text-2xl font-semibold">Afschriften</h1>
      <Card>
        <CardHeader>
          <CardTitle>Importeren</CardTitle>
          <CardDescription>
            ABN AMRO export als TXT (tab-gescheiden). Regels die al bekend zijn worden overgeslagen, het laatste saldo
            wordt opgeslagen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImportForm />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Te verwerken ({open.length})</CardTitle>
          <CardDescription>
            Regels zonder{" "}
            <Link href="/tegenrekeningen" className="underline">
              tegenrekening
            </Link>{" "}
            of met &quot;per regel kiezen&quot;. Een tegenrekening toevoegen verwerkt zijn regels meteen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OpenLines lines={open} counterparties={counterparties} />
        </CardContent>
      </Card>
    </>
  );
}
