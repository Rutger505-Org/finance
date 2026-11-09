"use client";

import { deleteSpending, type ActionResult } from "@/app/actions";
import { ResultMessage } from "@/components/issues";
import { Button } from "@/components/ui/button";
import { parseDay } from "@/lib/finance/dates";
import type { SpendingDto } from "@/lib/finance/schemas";
import { date, moneyEuros } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useState, useTransition } from "react";
import { SpendingForm, type Lookups } from "./spending-form";

/** Spendings grouped per day (input newest first), with edit and delete. */
export function SpendingList({
  spendings,
  lookups,
  today,
}: {
  spendings: SpendingDto[];
  lookups: Lookups;
  today: string;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const name = <T extends { id: number; name: string }>(list: T[], id: number | null) =>
    id === null ? undefined : (list.find((item) => item.id === id)?.name ?? `#${id}`);

  const days = new Map<string, SpendingDto[]>();
  for (const spending of spendings) days.set(spending.date, [...(days.get(spending.date) ?? []), spending]);

  function remove(spending: SpendingDto) {
    if (!confirm(`"${spending.description}" verwijderen?`)) return;
    startTransition(async () => setResult(await deleteSpending(spending.id)));
  }

  if (spendings.length === 0) return <p className="text-muted-foreground text-sm">Nog niets.</p>;

  return (
    <div className="space-y-4">
      <ResultMessage result={result} />
      {[...days].map(([day, items]) => (
        <section key={day}>
          <h3 className="text-muted-foreground flex justify-between border-b pb-1 text-sm font-medium tabular-nums">
            <span className="first-letter:uppercase">{date(parseDay(day))}</span>
            <span>{moneyEuros(items.reduce((total, item) => total + item.amount, 0))}</span>
          </h3>
          <ul className="divide-y">
            {items.map((spending) => (
              <li key={spending.id} className="py-2">
                {editing === spending.id ? (
                  <SpendingForm
                    spending={spending}
                    lookups={lookups}
                    today={today}
                    onDone={() => setEditing(null)}
                  />
                ) : (
                  <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 sm:flex">
                    <div className="min-w-0 sm:flex-1">
                      <p className="font-medium">
                        {spending.time && (
                          <span className="text-muted-foreground mr-2 font-normal tabular-nums">{spending.time}</span>
                        )}
                        {spending.description}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {[
                          name(lookups.categories, spending.categoryId) ?? "Geen categorie",
                          name(lookups.outings, spending.outingId),
                          name(lookups.counterparties, spending.counterpartyId),
                          spending.note,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <p className={cn("text-right font-medium tabular-nums", spending.amount < 0 && "text-emerald-700")}>
                      {moneyEuros(spending.amount)}
                    </p>
                    <div className="col-span-2 flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => setEditing(spending.id)}>
                        Bewerken
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(spending)} disabled={pending}>
                        Verwijderen
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
