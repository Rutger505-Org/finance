"use client";

import { saveOneOffIncome, type ActionResult } from "@/app/actions";
import { ResultMessage } from "@/components/issues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { CounterpartyDto, OneOffIncomeDto } from "@/lib/finance/schemas";
import { amountText, parseAmount } from "@/lib/format";
import { useId, useState, useTransition } from "react";

export function OneOffIncomeForm({
  income,
  counterparties,
  today,
  onDone,
}: {
  income?: OneOffIncomeDto;
  counterparties: CounterpartyDto[];
  today: string;
  onDone?: () => void;
}) {
  const id = useId();
  const [date, setDate] = useState(income?.date ?? today);
  const [time, setTime] = useState(income?.time ?? "");
  const [amount, setAmount] = useState(income ? amountText(income.amount) : "");
  const [description, setDescription] = useState(income?.description ?? "");
  const [counterpartyId, setCounterpartyId] = useState(income?.counterpartyId == null ? "" : String(income.counterpartyId));
  const [note, setNote] = useState(income?.note ?? "");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = parseAmount(amount);
    if (value === null || value <= 0) {
      setResult({ ok: false, error: "Vul een bedrag groter dan 0 in, bijv. 25,00" });
      return;
    }
    startTransition(async () => {
      const response = await saveOneOffIncome(income?.id ?? null, {
        date,
        time: time || null,
        amount: value,
        description,
        counterpartyId: counterpartyId === "" ? null : Number(counterpartyId),
        note: note.trim() || null,
      });
      setResult(response.ok && !income ? { ok: true, message: `Toegevoegd: ${description}` } : response);
      if (!response.ok) return;
      if (income) onDone?.();
      else {
        setAmount("");
        setDescription("");
        setNote("");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border bg-muted/30 p-4">
      <div className="grid gap-3 sm:grid-cols-[10rem_7rem_8rem_1fr]">
        <div className="space-y-1">
          <Label htmlFor={`${id}-date`}>Datum</Label>
          <Input id={`${id}-date`} type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-time`}>Tijd</Label>
          <Input id={`${id}-time`} type="time" value={time} onChange={(event) => setTime(event.target.value)} />
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
          <Label htmlFor={`${id}-description`}>Omschrijving</Label>
          <Input
            id={`${id}-description`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Oude fiets verkocht"
            required
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <div className="space-y-1">
          <Label htmlFor={`${id}-counterparty`}>Tegenrekening</Label>
          <Select id={`${id}-counterparty`} value={counterpartyId} onChange={(event) => setCounterpartyId(event.target.value)}>
            <option value="">Geen</option>
            {counterparties.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-note`}>Notitie</Label>
          <Input id={`${id}-note`} value={note} onChange={(event) => setNote(event.target.value)} />
        </div>
      </div>
      <ResultMessage result={result} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {income ? "Opslaan" : "Toevoegen"}
        </Button>
        {onDone && (
          <Button type="button" variant="ghost" onClick={onDone}>
            Annuleren
          </Button>
        )}
      </div>
    </form>
  );
}
