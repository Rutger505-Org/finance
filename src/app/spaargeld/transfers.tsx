"use client";

import {
  addSavingsTransfer,
  deleteSavingsTransfer,
  type ActionResult,
} from "@/app/actions";
import { ResultMessage } from "@/components/issues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { parseDay } from "@/lib/finance/dates";
import type { SavingsTransferDto } from "@/lib/finance/schemas";
import { date as shortDate, moneyEuros, parseAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useId, useState, useTransition } from "react";

const SHOWN = 10;

/** Real transfers of one savings account, newest first, from the savings account's side; add or delete by hand. */
export function SavingsTransfers({
  savingsAccountId,
  transfers,
  today,
}: {
  savingsAccountId: number;
  transfers: SavingsTransferDto[];
  today: string;
}) {
  const [all, setAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(transfer: SavingsTransferDto) {
    if (!confirm(`Overboeking "${transfer.description}" verwijderen?`)) return;
    startTransition(async () =>
      setResult(await deleteSavingsTransfer(transfer.id)),
    );
  }

  return (
    <div className="space-y-2 border-t pt-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Overboekingen</p>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            Toevoegen
          </Button>
        )}
      </div>
      {adding && (
        <TransferForm
          savingsAccountId={savingsAccountId}
          today={today}
          onDone={() => setAdding(false)}
        />
      )}
      <ResultMessage result={result} />
      {transfers.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nog geen.</p>
      ) : (
        <ul className="space-y-1 text-sm tabular-nums">
          {(all ? transfers : transfers.slice(0, SHOWN)).map((transfer) => (
            <li key={transfer.id} className="flex items-center gap-2">
              <span className="text-muted-foreground w-24 shrink-0">
                {shortDate(parseDay(transfer.date))} {transfer.date.slice(0, 4)}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {transfer.amount > 0
                  ? "Naar lopende rekening"
                  : "Van lopende rekening"}{" "}
                · {transfer.description}
              </span>
              <span className={cn(transfer.amount < 0 && "text-green-700")}>
                {moneyEuros(-transfer.amount)}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => remove(transfer)}
                disabled={pending}
              >
                Weg
              </Button>
            </li>
          ))}
        </ul>
      )}
      {!all && transfers.length > SHOWN && (
        <Button size="sm" variant="ghost" onClick={() => setAll(true)}>
          Alle {transfers.length} tonen
        </Button>
      )}
    </div>
  );
}

function TransferForm({
  savingsAccountId,
  today,
  onDone,
}: {
  savingsAccountId: number;
  today: string;
  onDone: () => void;
}) {
  const id = useId();
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = parseAmount(amount);
    if (value === null || value <= 0) {
      setResult({ ok: false, error: "Vul een bedrag groter dan 0 in" });
      return;
    }
    startTransition(async () => {
      const response = await addSavingsTransfer({
        savingsAccountId,
        date,
        time: time || null,
        amount: direction === "out" ? value : -value,
        description,
      });
      setResult(response);
      if (response.ok) onDone();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="bg-muted/30 space-y-3 rounded-md border p-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${id}-direction`}>Richting</Label>
          <Select
            id={`${id}-direction`}
            value={direction}
            onChange={(event) =>
              setDirection(event.target.value as "out" | "in")
            }
          >
            <option value="out">Naar lopende rekening</option>
            <option value="in">Van lopende rekening</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-amount`}>Bedrag (€)</Label>
          <Input
            id={`${id}-amount`}
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0,00"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-date`}>Datum</Label>
          <Input
            id={`${id}-date`}
            type="date"
            max={today}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-time`}>Tijd (optioneel)</Label>
          <Input
            id={`${id}-time`}
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`${id}-description`}>Omschrijving</Label>
          <Input
            id={`${id}-description`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
          />
        </div>
      </div>
      <ResultMessage result={result} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          Opslaan
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Annuleren
        </Button>
      </div>
    </form>
  );
}
