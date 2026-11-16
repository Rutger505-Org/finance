import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Day } from "@/lib/finance/dates";
import { date, money } from "@/lib/format";
import Link from "next/link";

export interface AccountBalance {
  key: string;
  label: string;
  /** Cents, null without a checkpoint. */
  amount: number | null;
  day: Day | null;
}

/** Latest checkpoint per account and their sum. */
export function BalancesCard({ accounts }: { accounts: AccountBalance[] }) {
  const known = accounts.filter((a) => a.amount !== null);
  const total = known.reduce((sum, a) => sum + a.amount!, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Saldo</CardTitle>
        <CardDescription>
          Laatst ingevoerde saldo per rekening.{" "}
          <Link href="/saldo" className="underline">
            Saldo
          </Link>{" "}
          ·{" "}
          <Link href="/spaargeld" className="underline">
            Spaargeld
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm tabular-nums">
        {known.length === 0 ? (
          <p className="text-muted-foreground">Nog geen saldo ingevoerd.</p>
        ) : (
          <ul className="divide-y">
            {accounts.map((a) => (
              <li key={a.key} className="flex items-start justify-between gap-3 py-1.5">
                <span className="min-w-0">
                  <span className="block truncate">{a.label}</span>
                  <span className="text-muted-foreground text-xs">{a.day === null ? "nog geen saldo" : `per ${date(a.day)}`}</span>
                </span>
                <span className="shrink-0">{a.amount === null ? "–" : money(a.amount)}</span>
              </li>
            ))}
            <li className="flex justify-between gap-3 py-1.5 font-semibold">
              <span>Totaal vermogen</span>
              <span>{money(total)}</span>
            </li>
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
