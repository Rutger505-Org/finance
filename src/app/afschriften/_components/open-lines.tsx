"use client";

import { patchStatementLine, statementLineToSpending, type ActionResult } from "@/app/actions";
import { ResultMessage } from "@/components/issues";
import { Button } from "@/components/ui/button";
import type { StatementLineDto } from "@/lib/finance/schemas";
import { readableRemittance } from "@/lib/finance/statement";
import { moneyEuros } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useState, useTransition } from "react";

export function OpenLines({ lines, counterparties }: { lines: StatementLineDto[]; counterparties: { id: number; name: string }[] }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (lines.length === 0) return <p className="text-muted-foreground text-sm">Niets te verwerken.</p>;

  return (
    <div className="space-y-3">
      <ResultMessage result={result} />
      <ul className="divide-y">
        {lines.map((line) => (
          <li key={line.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-2 sm:flex">
            <div className="min-w-0 sm:flex-1">
              <p className="font-medium">{line.name}</p>
              <p className="text-muted-foreground text-sm">
                {[
                  line.paidAt?.replace("T", " ") ?? line.date,
                  line.type,
                  readableRemittance(line.remittance),
                  line.iban,
                  counterparties.find((c) => c.id === line.counterpartyId)?.name,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <p className={cn("text-right font-medium tabular-nums", line.amount > 0 && "text-emerald-700")}>
              {moneyEuros(line.amount)}
            </p>
            <div className="col-span-2 flex justify-end gap-1">
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => startTransition(async () => setResult(await statementLineToSpending(line.id, {})))}
              >
                Uitgave
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => startTransition(async () => setResult(await patchStatementLine(line.id, { skipped: true })))}
              >
                Overslaan
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
