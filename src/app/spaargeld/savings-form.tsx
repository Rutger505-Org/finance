"use client";

import { saveSavings, type ActionResult } from "@/app/actions";
import { ResultMessage } from "@/components/issues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Savings, SavingsWithdrawal } from "@/lib/finance/schemas";
import { amountText, parseAmount } from "@/lib/format";
import { useId, useState, useTransition } from "react";

interface Row {
  key: number;
  name: string;
  amount: string;
  date: string;
  note: string;
}

let nextKey = 0;

export function SavingsForm({ savings, today }: { savings: Savings | null; today: string }) {
  const id = useId();
  const [balance, setBalance] = useState(savings ? amountText(savings.balance) : "");
  const [date, setDate] = useState(savings?.date ?? today);
  const [until, setUntil] = useState(savings?.until ?? "");
  const [rows, setRows] = useState<Row[]>(() =>
    (savings?.withdrawals ?? []).map((w) => ({
      key: nextKey++,
      name: w.name,
      amount: amountText(w.amount),
      date: w.date,
      note: w.note ?? "",
    })),
  );
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const update = (key: number, patch: Partial<Row>) =>
    setRows((list) => list.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const amount = parseAmount(balance);
    if (amount === null) {
      setResult({ ok: false, error: "Vul een geldig saldo in, bijv. 1.234,56" });
      return;
    }
    const withdrawals: SavingsWithdrawal[] = [];
    for (const [index, row] of rows.entries()) {
      const value = parseAmount(row.amount);
      if (value === null) {
        setResult({ ok: false, error: `Uitgave ${index + 1}: vul een geldig bedrag in` });
        return;
      }
      withdrawals.push({ name: row.name, amount: value, date: row.date, ...(row.note.trim() && { note: row.note.trim() }) });
    }
    startTransition(async () => {
      setResult(await saveSavings({ balance: amount, date, until, withdrawals }));
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor={`${id}-balance`}>Saldo (€)</Label>
          <Input
            id={`${id}-balance`}
            inputMode="decimal"
            value={balance}
            onChange={(event) => setBalance(event.target.value)}
            placeholder="0,00"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-date`}>Saldo op</Label>
          <Input id={`${id}-date`} type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-until`}>Moet duren t/m</Label>
          <Input id={`${id}-until`} type="month" value={until} onChange={(event) => setUntil(event.target.value)} required />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Uitgaven van de spaarrekening</p>
        {rows.length === 0 && <p className="text-muted-foreground text-sm">Nog geen.</p>}
        {rows.map((row) => (
          <div key={row.key} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[2fr_1fr_1fr_2fr_auto] sm:border-0 sm:p-0">
            <Input aria-label="Naam" value={row.name} onChange={(event) => update(row.key, { name: event.target.value })} placeholder="Naam" required />
            <Input
              aria-label="Bedrag"
              inputMode="decimal"
              value={row.amount}
              onChange={(event) => update(row.key, { amount: event.target.value })}
              placeholder="0,00"
              required
            />
            <Input aria-label="Datum" type="date" value={row.date} onChange={(event) => update(row.key, { date: event.target.value })} required />
            <Input aria-label="Notitie" value={row.note} onChange={(event) => update(row.key, { note: event.target.value })} placeholder="Notitie" />
            <Button type="button" variant="ghost" size="sm" onClick={() => setRows((list) => list.filter((r) => r.key !== row.key))}>
              Weg
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRows((list) => [...list, { key: nextKey++, name: "", amount: "", date: today, note: "" }])}
        >
          Uitgave toevoegen
        </Button>
      </div>
      <ResultMessage result={result} />
      <Button type="submit" disabled={pending}>
        Opslaan
      </Button>
    </form>
  );
}
