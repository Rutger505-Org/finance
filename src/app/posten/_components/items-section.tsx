"use client";

import { deleteExpense, deleteIncome, type ActionResult } from "@/app/actions";
import { ResultMessage } from "@/components/issues";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { moneyEuros } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useId, useMemo, useState, useTransition } from "react";
import { ItemForm, type Item, type ItemKind } from "./item-form";

export interface ItemRow {
  item: Item;
  amount: string;
  cycle: string;
  next: string;
  /** ISO date of the next payment. */
  nextDue: string;
  monthly: string;
  monthlyEuros: number;
  detail?: string;
}

type Sort = "next" | "monthly-desc" | "monthly-asc" | "name";

const sorters: Record<Sort, (a: ItemRow, b: ItemRow) => number> = {
  next: (a, b) =>
    a.nextDue.localeCompare(b.nextDue) || b.monthlyEuros - a.monthlyEuros,
  "monthly-desc": (a, b) =>
    b.monthlyEuros - a.monthlyEuros || a.nextDue.localeCompare(b.nextDue),
  "monthly-asc": (a, b) =>
    a.monthlyEuros - b.monthlyEuros || a.nextDue.localeCompare(b.nextDue),
  name: (a, b) => a.item.name.localeCompare(b.item.name, "nl"),
};

/** ISO date `days` after `iso`. */
function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function ItemsSection({
  kind,
  title,
  rows,
  today,
}: {
  kind: ItemKind;
  title: string;
  rows: ItemRow[];
  today: string;
}) {
  const id = useId();
  const [sort, setSort] = useState<Sort>("next");
  const [until, setUntil] = useState("");
  const shown = useMemo(
    () =>
      rows.filter((row) => !until || row.nextDue <= until).sort(sorters[sort]),
    [rows, sort, until],
  );
  const shownMonthly = shown
    .filter((row) => row.item.active)
    .reduce((sum, row) => sum + row.monthlyEuros, 0);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(item: Item) {
    if (!confirm(`"${item.name}" verwijderen?`)) return;
    startTransition(async () => {
      setResult(
        kind === "income"
          ? await deleteIncome(item.id)
          : await deleteExpense(item.id),
      );
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>{title}</CardTitle>
        <Button
          size="sm"
          onClick={() => setEditing("new")}
          disabled={editing === "new"}
        >
          Toevoegen
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {editing === "new" && (
          <ItemForm kind={kind} onDone={() => setEditing(null)} />
        )}
        <ResultMessage result={result} />
        {rows.length > 0 && (
          <div className="flex flex-wrap items-end gap-3 text-sm">
            <div className="space-y-1">
              <label
                htmlFor={`${id}-sort`}
                className="text-muted-foreground text-xs"
              >
                Sorteren
              </label>
              <Select
                id={`${id}-sort`}
                value={sort}
                onChange={(event) => setSort(event.target.value as Sort)}
                className="w-52"
              >
                <option value="next">Eerstvolgende betaling</option>
                <option value="monthly-desc">Per maand, hoog → laag</option>
                <option value="monthly-asc">Per maand, laag → hoog</option>
                <option value="name">Naam</option>
              </Select>
            </div>
            <div className="space-y-1">
              <label
                htmlFor={`${id}-until`}
                className="text-muted-foreground text-xs"
              >
                Volgende betaling t/m
              </label>
              <Input
                id={`${id}-until`}
                type="date"
                min={today}
                value={until}
                onChange={(event) => setUntil(event.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex gap-1">
              {[7, 30].map((days) => (
                <Button
                  key={days}
                  size="sm"
                  variant={
                    until === addDays(today, days) ? "secondary" : "outline"
                  }
                  onClick={() => setUntil(addDays(today, days))}
                >
                  {days} dagen
                </Button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setUntil("")}
                disabled={!until}
              >
                Alles
              </Button>
            </div>
          </div>
        )}
        {rows.length === 0 && editing !== "new" && (
          <p className="text-muted-foreground text-sm">Nog niets.</p>
        )}
        {rows.length > 0 && shown.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Geen posten met een betaling t/m deze datum.
          </p>
        )}
        <ul className="divide-y">
          {shown.map((row) => (
            <li key={row.item.id} className="py-3">
              {editing === row.item.id ? (
                <ItemForm
                  kind={kind}
                  item={row.item}
                  onDone={() => setEditing(null)}
                />
              ) : (
                <div
                  className={cn(
                    "grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 sm:flex",
                    !row.item.active && "opacity-50",
                  )}
                >
                  <div className="min-w-0 sm:flex-1">
                    <p className="font-medium">
                      {row.item.name}
                      {!row.item.active && (
                        <span className="ml-2 text-xs font-normal">
                          (inactief)
                        </span>
                      )}
                      {"main" in row.item && row.item.main && (
                        <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-normal text-emerald-800">
                          hoofdinkomen
                        </span>
                      )}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {row.cycle}
                      {row.detail && <> · {row.detail}</>}
                      {row.item.note && <> · {row.item.note}</>}
                    </p>
                  </div>
                  <div className="text-right text-sm tabular-nums">
                    <p className="font-medium">{row.amount}</p>
                    <p className="text-muted-foreground">{row.monthly} p/m</p>
                  </div>
                  <div className="col-span-2 flex items-center justify-between gap-2 sm:contents">
                    <div className="text-muted-foreground text-sm whitespace-nowrap sm:w-36">
                      volgende: {row.next}
                    </div>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(row.item.id)}
                      >
                        Bewerken
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(row.item)}
                        disabled={pending}
                      >
                        Verwijderen
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        {rows.length > 0 && (
          <p className="text-muted-foreground border-t pt-3 text-right text-sm tabular-nums">
            {shown.length} {shown.length === 1 ? "post" : "posten"} · totaal
            actief{" "}
            <span className="text-foreground font-medium">
              {moneyEuros(shownMonthly)} p/m
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
