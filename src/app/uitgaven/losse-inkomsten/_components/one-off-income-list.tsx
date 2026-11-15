"use client";

import { deleteOneOffIncome, type ActionResult } from "@/app/actions";
import { ResultMessage } from "@/components/issues";
import { Button } from "@/components/ui/button";
import { parseDay } from "@/lib/finance/dates";
import type { CounterpartyDto, OneOffIncomeDto } from "@/lib/finance/schemas";
import { date, moneyEuros } from "@/lib/format";
import { useState, useTransition } from "react";
import { OneOffIncomeForm } from "./one-off-income-form";

/** One-off incomes grouped per day (input newest first), with edit and delete. */
export function OneOffIncomeList({
  incomes,
  counterparties,
  today,
}: {
  incomes: OneOffIncomeDto[];
  counterparties: CounterpartyDto[];
  today: string;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const counterpartyName = (id: number | null) =>
    id === null ? undefined : (counterparties.find((c) => c.id === id)?.name ?? `#${id}`);

  const days = new Map<string, OneOffIncomeDto[]>();
  for (const income of incomes) days.set(income.date, [...(days.get(income.date) ?? []), income]);

  function remove(income: OneOffIncomeDto) {
    if (!confirm(`"${income.description}" verwijderen?`)) return;
    startTransition(async () => setResult(await deleteOneOffIncome(income.id)));
  }

  if (incomes.length === 0) return <p className="text-muted-foreground text-sm">Nog niets.</p>;

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
            {items.map((income) => (
              <li key={income.id} className="py-2">
                {editing === income.id ? (
                  <OneOffIncomeForm
                    income={income}
                    counterparties={counterparties}
                    today={today}
                    onDone={() => setEditing(null)}
                  />
                ) : (
                  <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 sm:flex">
                    <div className="min-w-0 sm:flex-1">
                      <p className="font-medium">
                        {income.time && (
                          <span className="text-muted-foreground mr-2 font-normal tabular-nums">{income.time}</span>
                        )}
                        {income.description}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {[counterpartyName(income.counterpartyId), income.note].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <p className="text-right font-medium tabular-nums text-emerald-700">{moneyEuros(income.amount)}</p>
                    <div className="col-span-2 flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => setEditing(income.id)}>
                        Bewerken
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(income)} disabled={pending}>
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
