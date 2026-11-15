"use client";

import { deleteBalance, type ActionResult } from "@/app/actions";
import { ResultMessage } from "@/components/issues";
import { Button } from "@/components/ui/button";
import { matches } from "@/lib/finance/balances";
import { parseDay } from "@/lib/finance/dates";
import { date, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useState, useTransition } from "react";

interface Row {
  id: number;
  label: string;
  date: string;
  time: string | null;
  amount: number;
  expected: number | null;
  difference: number | null;
}

export function CheckpointList({ rows }: { rows: Row[] }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(row: Row) {
    if (
      !confirm(
        `Checkpoint ${row.label} van ${date(parseDay(row.date))} verwijderen?`,
      )
    )
      return;
    startTransition(async () => setResult(await deleteBalance(row.id)));
  }

  if (rows.length === 0)
    return (
      <p className="text-muted-foreground text-sm">Nog geen checkpoints.</p>
    );
  return (
    <div className="space-y-2">
      <ResultMessage result={result} />
      <ul className="divide-y text-sm tabular-nums">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2"
          >
            <div className="min-w-0">
              <p className="font-medium">
                {date(parseDay(row.date))} {row.date.slice(0, 4)}
                {row.time && (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    {row.time}
                  </span>
                )}
              </p>
              <p className="text-muted-foreground">{row.label}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-medium">{money(row.amount)}</p>
                <p className="text-muted-foreground text-xs">
                  {row.expected === null
                    ? "eerste"
                    : `verwacht ${money(row.expected)}`}
                </p>
              </div>
              <p
                className={cn(
                  "w-24 text-right",
                  row.difference === null
                    ? "text-muted-foreground"
                    : matches(row.difference)
                      ? "text-emerald-700"
                      : "text-amber-700",
                )}
              >
                {row.difference === null
                  ? "–"
                  : matches(row.difference)
                    ? "klopt"
                    : `${row.difference > 0 ? "+" : "−"}${money(Math.abs(row.difference))}`}
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => remove(row)}
                disabled={pending}
              >
                Weg
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
