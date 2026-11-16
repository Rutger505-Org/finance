"use client";

import { saveSavingsAccount, type ActionResult } from "@/app/actions";
import { ResultMessage } from "@/components/issues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  SavingsAccountDto,
  SavingsWithdrawal,
  ScenarioDto,
} from "@/lib/finance/schemas";
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

/** Create or edit a savings account; a changed balance becomes a new checkpoint. */
export function SavingsForm({
  account,
  scenarios,
  today,
  onDone,
}: {
  account?: SavingsAccountDto;
  scenarios: ScenarioDto[];
  today: string;
  onDone: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(account?.name ?? "");
  const [iban, setIban] = useState(account?.iban ?? "");
  const [balance, setBalance] = useState(
    account?.balance ? amountText(account.balance.amount) : "",
  );
  const [date, setDate] = useState(account?.balance?.date ?? today);
  const [until, setUntil] = useState(account?.until ?? "");
  const [inScenarios, setInScenarios] = useState<number[]>(
    () => account?.scenarioIds ?? scenarios.map((s) => s.id),
  );
  const [rows, setRows] = useState<Row[]>(() =>
    (account?.withdrawals ?? []).map((w) => ({
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
    setRows((list) =>
      list.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const amount = parseAmount(balance);
    if (amount === null) {
      setResult({
        ok: false,
        error: "Vul een geldig saldo in, bijv. 1.234,56",
      });
      return;
    }
    if (inScenarios.length === 0) {
      setResult({ ok: false, error: "Kies minstens één situatie" });
      return;
    }
    const withdrawals: SavingsWithdrawal[] = [];
    for (const [index, row] of rows.entries()) {
      const value = parseAmount(row.amount);
      if (value === null) {
        setResult({
          ok: false,
          error: `Uitgave ${index + 1}: vul een geldig bedrag in`,
        });
        return;
      }
      withdrawals.push({
        name: row.name,
        amount: value,
        date: row.date,
        ...(row.note.trim() && { note: row.note.trim() }),
      });
    }
    const scenarioIds = scenarios.every((s) => inScenarios.includes(s.id))
      ? null
      : inScenarios;
    const fields = {
      name,
      iban: iban.trim() || null,
      until: until || null,
      withdrawals,
      scenarioIds,
    };
    startTransition(async () => {
      const response = account
        ? await saveSavingsAccount(account.id, fields, { amount, date })
        : await saveSavingsAccount(null, {
            ...fields,
            balance: { amount, date },
          });
      setResult(response);
      if (response.ok) onDone();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="bg-muted/30 space-y-4 rounded-md border p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${id}-name`}>Naam</Label>
          <Input
            id={`${id}-name`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-iban`}>IBAN (optioneel)</Label>
          <Input
            id={`${id}-iban`}
            value={iban}
            onChange={(event) => setIban(event.target.value)}
            placeholder="NL91 ABNA 0417 1643 00"
            autoCapitalize="characters"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-until`}>
            Verdelen t/m (leeg = niet verdelen)
          </Label>
          <Input
            id={`${id}-until`}
            type="month"
            value={until}
            onChange={(event) => setUntil(event.target.value)}
          />
        </div>
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
          <Input
            id={`${id}-date`}
            type="date"
            max={today}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </div>
      </div>
      {scenarios.length > 1 && (
        <fieldset className="flex flex-wrap gap-4 text-sm">
          <legend className="mb-1 text-sm font-medium">Telt mee in</legend>
          {scenarios.map((scenario) => (
            <label key={scenario.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={inScenarios.includes(scenario.id)}
                onChange={(event) =>
                  setInScenarios((ids) =>
                    event.target.checked
                      ? [...ids, scenario.id]
                      : ids.filter((value) => value !== scenario.id),
                  )
                }
              />
              {scenario.name}
            </label>
          ))}
        </fieldset>
      )}
      <div className="space-y-2">
        <p className="text-sm font-medium">
          Geplande uitgaven van deze rekening
        </p>
        <p className="text-muted-foreground text-xs">
          Tellen alleen mee zolang ze na vandaag zijn; wat echt gebeurd is,
          staat bij de overboekingen.
        </p>
        {rows.length === 0 && (
          <p className="text-muted-foreground text-sm">Nog geen.</p>
        )}
        {rows.map((row) => (
          <div
            key={row.key}
            className="grid gap-2 rounded-md border p-3 sm:grid-cols-[2fr_1fr_1fr_2fr_auto] sm:border-0 sm:p-0"
          >
            <Input
              aria-label="Naam"
              value={row.name}
              onChange={(event) =>
                update(row.key, { name: event.target.value })
              }
              placeholder="Naam"
              required
            />
            <Input
              aria-label="Bedrag"
              inputMode="decimal"
              value={row.amount}
              onChange={(event) =>
                update(row.key, { amount: event.target.value })
              }
              placeholder="0,00"
              required
            />
            <Input
              aria-label="Datum"
              type="date"
              value={row.date}
              onChange={(event) =>
                update(row.key, { date: event.target.value })
              }
              required
            />
            <Input
              aria-label="Notitie"
              value={row.note}
              onChange={(event) =>
                update(row.key, { note: event.target.value })
              }
              placeholder="Notitie"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setRows((list) => list.filter((r) => r.key !== row.key))
              }
            >
              Weg
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setRows((list) => [
              ...list,
              { key: nextKey++, name: "", amount: "", date: today, note: "" },
            ])
          }
        >
          Uitgave toevoegen
        </Button>
      </div>
      <ResultMessage result={result} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {account ? "Opslaan" : "Toevoegen"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Annuleren
        </Button>
      </div>
    </form>
  );
}
