import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Day } from "@/lib/finance/dates";
import type { Overview } from "@/lib/finance/plan";
import { date, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import Link from "next/link";

/** Hero: free to spend until the next main income (the overview's own calculation), and per day. */
export function FreeToSpendCard({ current, today }: { current: Overview["current"]; today: Day }) {
  if (!current) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vrij te besteden</CardTitle>
          <CardDescription>
            Nog niet te berekenen: er is nog geen saldo van je lopende rekening. Voer er een in bij{" "}
            <Link href="/saldo" className="underline">
              Saldo
            </Link>
            .
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const { free, perDay, daysLeft, periodEnd } = current;
  return (
    <Card>
      <CardHeader>
        <CardDescription>Vrij te besteden</CardDescription>
        <CardTitle className={cn("text-4xl tabular-nums", free < 0 && "text-red-700")}>{money(free)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {periodEnd !== undefined && daysLeft !== undefined && perDay !== undefined ? (
          <p>
            Nog <span className="font-medium">{daysLeft}</span> {daysLeft === 1 ? "dag" : "dagen"} tot het hoofdinkomen
            op {date(periodEnd)}: ongeveer <span className="font-medium tabular-nums">{money(perDay)}</span> per dag.
          </p>
        ) : (
          <p>
            Geen inkomen ingevoerd, dus geen periode om over te verdelen. Voeg er een toe bij{" "}
            <Link href="/posten" className="underline">
              Posten
            </Link>
            .
          </p>
        )}
        <p className="text-muted-foreground">
          Op basis van het saldo van {current.date === today ? "vandaag" : date(current.date)} ({money(current.balance)}
          ); uitgaven daarna tellen pas mee in het volgende{" "}
          <Link href="/saldo" className="underline">
            saldo
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
