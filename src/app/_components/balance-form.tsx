"use client";

import { addBalance, type ActionResult } from "@/app/actions";
import { ResultMessage } from "@/components/issues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Account } from "@/lib/finance/schemas";
import { parseAmount } from "@/lib/format";
import { useState, useTransition } from "react";

/** Records today's balance of one account. */
export function BalanceForm({ account, withDate = false }: { account?: Account; withDate?: boolean }) {
  const [amount, setAmount] = useState("");
  const [selected, setSelected] = useState<Account>(account ?? "current");
  const [date, setDate] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = parseAmount(amount);
    if (value === null) {
      setResult({ ok: false, error: "Vul een bedrag in, bijv. 450 of 450,25" });
      return;
    }
    startTransition(async () => {
      const response = await addBalance({ account: selected, amount: value, date: date || undefined });
      setResult(response);
      if (response.ok) setAmount("");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {!account && (
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value as Account)}
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            aria-label="Rekening"
          >
            <option value="current">Lopende rekening</option>
            <option value="fixed">Vaste lastenrekening</option>
          </select>
        )}
        {withDate && (
          <Input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="w-40"
            aria-label="Datum (leeg = vandaag)"
          />
        )}
        <Input
          inputMode="decimal"
          placeholder="Saldo, bijv. 450,25"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="w-44"
          aria-label="Saldo"
        />
        <Button type="submit" variant="outline" disabled={pending}>
          Saldo bijwerken
        </Button>
      </div>
      <ResultMessage result={result} />
    </form>
  );
}
