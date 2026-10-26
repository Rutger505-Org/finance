"use client";

import { deleteExpense, deleteIncome, type ActionResult } from "@/app/actions";
import { ResultMessage } from "@/components/issues";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useState, useTransition } from "react";
import { ItemForm, type Item, type ItemKind } from "./item-form";

export interface ItemRow {
  item: Item;
  amount: string;
  cycle: string;
  next: string;
  monthly: string;
  detail?: string;
}

export function ItemsSection({ kind, title, rows }: { kind: ItemKind; title: string; rows: ItemRow[] }) {
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(item: Item) {
    if (!confirm(`"${item.name}" verwijderen?`)) return;
    startTransition(async () => {
      setResult(kind === "income" ? await deleteIncome(item.id) : await deleteExpense(item.id));
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>{title}</CardTitle>
        <Button size="sm" onClick={() => setEditing("new")} disabled={editing === "new"}>
          Toevoegen
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {editing === "new" && <ItemForm kind={kind} onDone={() => setEditing(null)} />}
        <ResultMessage result={result} />
        {rows.length === 0 && editing !== "new" && <p className="text-sm text-muted-foreground">Nog niets.</p>}
        <ul className="divide-y">
          {rows.map((row) => (
            <li key={row.item.id} className="py-3">
              {editing === row.item.id ? (
                <ItemForm kind={kind} item={row.item} onDone={() => setEditing(null)} />
              ) : (
                <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1", !row.item.active && "opacity-50")}>
                  <div className="min-w-48 flex-1">
                    <p className="font-medium">
                      {row.item.name}
                      {!row.item.active && <span className="ml-2 text-xs font-normal">(inactief)</span>}
                      {"main" in row.item && row.item.main && (
                        <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-normal text-emerald-800">
                          hoofdinkomen
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {row.cycle}
                      {row.detail && <> · {row.detail}</>}
                      {row.item.note && <> · {row.item.note}</>}
                    </p>
                  </div>
                  <div className="text-right text-sm tabular-nums">
                    <p className="font-medium">{row.amount}</p>
                    <p className="text-muted-foreground">{row.monthly} p/m</p>
                  </div>
                  <div className="w-28 text-sm text-muted-foreground">volgende: {row.next}</div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => setEditing(row.item.id)}>
                      Bewerken
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(row.item)} disabled={pending}>
                      Verwijderen
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
