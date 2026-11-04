"use client";

import { saveOuting, saveSpending, type ActionResult } from "@/app/actions";
import { ResultMessage } from "@/components/issues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { CategoryDto, CounterpartyDto, OutingDto, SpendingDto } from "@/lib/finance/schemas";
import { amountText, parseAmount } from "@/lib/format";
import { useId, useState, useTransition } from "react";

export interface Lookups {
  categories: CategoryDto[];
  outings: OutingDto[];
  counterparties: CounterpartyDto[];
}

const NEW_OUTING = "new";

/** Select value ("" = none) as an id or null. */
const idOrNull = (value: string) => (value === "" ? null : Number(value));
const text = (id: number | null | undefined) => (id == null ? "" : String(id));

export function SpendingForm({
  spending,
  lookups,
  today,
  onDone,
}: {
  spending?: SpendingDto;
  lookups: Lookups;
  today: string;
  onDone?: () => void;
}) {
  const id = useId();
  const [date, setDate] = useState(spending?.date ?? today);
  const [amount, setAmount] = useState(spending ? amountText(spending.amount) : "");
  const [description, setDescription] = useState(spending?.description ?? "");
  const [categoryId, setCategoryId] = useState(text(spending?.categoryId));
  const [outingId, setOutingId] = useState(text(spending?.outingId));
  const [outingName, setOutingName] = useState("");
  const [outingDate, setOutingDate] = useState(spending?.date ?? today);
  const [counterpartyId, setCounterpartyId] = useState(text(spending?.counterpartyId));
  const [note, setNote] = useState(spending?.note ?? "");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function chooseCounterparty(value: string) {
    setCounterpartyId(value);
    const fallback = lookups.counterparties.find((c) => String(c.id) === value)?.categoryId;
    if (categoryId === "" && fallback != null) setCategoryId(String(fallback));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = parseAmount(amount);
    if (value === null || value === 0) {
      setResult({ ok: false, error: "Vul een geldig bedrag in, bijv. 6,50 (negatief = terugbetaald)" });
      return;
    }
    startTransition(async () => {
      let outing = idOrNull(outingId);
      if (outingId === NEW_OUTING) {
        const created = await saveOuting(null, { name: outingName, date: outingDate || null });
        if (!created.ok) {
          setResult(created);
          return;
        }
        outing = created.id ?? null;
        setOutingId(text(outing));
        setOutingName("");
      }
      const response = await saveSpending(spending?.id ?? null, {
        date,
        amount: value,
        description,
        categoryId: idOrNull(categoryId),
        outingId: outing,
        counterpartyId: idOrNull(counterpartyId),
        note: note.trim() || null,
      });
      setResult(response.ok && !spending ? { ok: true, message: `Toegevoegd: ${description}` } : response);
      if (!response.ok) return;
      if (spending) onDone?.();
      else {
        // Keep date, outing and category: the next drink of the same night is one amount away.
        setAmount("");
        setDescription("");
        setNote("");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border bg-muted/30 p-4">
      <div className="grid gap-3 sm:grid-cols-[10rem_8rem_1fr]">
        <div className="space-y-1">
          <Label htmlFor={`${id}-date`}>Datum</Label>
          <Input id={`${id}-date`} type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
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
            placeholder="2 bier"
            required
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor={`${id}-category`}>Categorie</Label>
          <Select id={`${id}-category`} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Geen</option>
            {lookups.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-outing`}>Uitje</Label>
          <Select id={`${id}-outing`} value={outingId} onChange={(event) => setOutingId(event.target.value)}>
            <option value="">Geen</option>
            <option value={NEW_OUTING}>+ Nieuw uitje…</option>
            {lookups.outings.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
                {o.date && ` (${o.date})`}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-counterparty`}>Tegenrekening</Label>
          <Select
            id={`${id}-counterparty`}
            value={counterpartyId}
            onChange={(event) => chooseCounterparty(event.target.value)}
          >
            <option value="">Geen</option>
            {lookups.counterparties.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {outingId === NEW_OUTING && (
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <div className="space-y-1">
            <Label htmlFor={`${id}-outing-name`}>Naam nieuw uitje</Label>
            <Input
              id={`${id}-outing-name`}
              value={outingName}
              onChange={(event) => setOutingName(event.target.value)}
              placeholder="Verjaardag"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-outing-date`}>Datum uitje</Label>
            <Input
              id={`${id}-outing-date`}
              type="date"
              value={outingDate}
              onChange={(event) => setOutingDate(event.target.value)}
            />
          </div>
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor={`${id}-note`}>Notitie</Label>
        <Input id={`${id}-note`} value={note} onChange={(event) => setNote(event.target.value)} />
      </div>
      <ResultMessage result={result} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {spending ? "Opslaan" : "Toevoegen"}
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
