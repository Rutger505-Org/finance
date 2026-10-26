import { BalanceForm } from "@/app/_components/balance-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { parseDay } from "@/lib/finance/dates";
import { date, moneyEuros } from "@/lib/format";
import { repository } from "@/server/finance";
import { DeleteBalance } from "./_components/delete-balance";

export const dynamic = "force-dynamic";

const accountName = { fixed: "Vaste lasten", current: "Lopende" } as const;

export default function SaldoPage() {
  const balances = repository.listBalances({ limit: 200 });
  return (
    <>
      <h1 className="text-2xl font-semibold">Saldo</h1>
      <Card>
        <CardHeader>
          <CardTitle>Saldo invoeren</CardTitle>
          <CardDescription>Het overzicht gebruikt per rekening het laatste saldo tot en met die dag. Leeg = vandaag.</CardDescription>
        </CardHeader>
        <CardContent>
          <BalanceForm withDate />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Geschiedenis</CardTitle>
        </CardHeader>
        <CardContent>
          {balances.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nog geen saldo ingevoerd.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="tabular-nums">
                {balances.map((balance) => (
                  <tr key={balance.id} className="border-t first:border-t-0">
                    <td className="py-2 pr-4">{date(parseDay(balance.date))}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{accountName[balance.account]}</td>
                    <td className="py-2 pr-4 text-right">{moneyEuros(balance.amount)}</td>
                    <td className="py-2 text-right">
                      <DeleteBalance id={balance.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
