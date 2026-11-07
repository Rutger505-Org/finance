"use client";

import { deleteCounterparty, saveCounterparty, type ActionResult } from "@/app/actions";
import { ResultMessage } from "@/components/issues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { CategoryDto, CounterpartyDto, CounterpartyHandling } from "@/lib/finance/schemas";
import { useId, useState, useTransition } from "react";

/** NL91ABNA0417164300 → NL91 ABNA 0417 1643 00 */
const formatIban = (iban: string) => iban.replace(/(.{4})/g, "$1 ").trim();

const handlings: Record<CounterpartyHandling, string> = {
  spending: "Uitgave",
  skip: "Geen uitgave",
  ask: "Per regel",
};

/** "a, b" → ["a", "b"] */
const list = (text: string) =>
  text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

function CounterpartyForm({
  counterparty,
  categories,
  onDone,
}: {
  counterparty?: CounterpartyDto;
  categories: CategoryDto[];
  onDone: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(counterparty?.name ?? "");
  const [ibans, setIbans] = useState(counterparty?.ibans.map(formatIban).join(", ") ?? "");
  const [names, setNames] = useState(counterparty?.names.join(", ") ?? "");
  const [handling, setHandling] = useState<CounterpartyHandling>(counterparty?.handling ?? "ask");
  const [categoryId, setCategoryId] = useState(counterparty?.categoryId == null ? "" : String(counterparty.categoryId));
  const [note, setNote] = useState(counterparty?.note ?? "");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const response = await saveCounterparty(counterparty?.id ?? null, {
        name,
        ibans: list(ibans),
        names: list(names),
        handling,
        categoryId: categoryId === "" ? null : Number(categoryId),
        note: note.trim() || null,
      });
      setResult(response);
      if (response.ok) onDone();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border bg-muted/30 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor={`${id}-name`}>Naam</Label>
          <Input
            id={`${id}-name`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Café"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-handling`}>Afschriftregels</Label>
          <Select
            id={`${id}-handling`}
            value={handling}
            onChange={(event) => setHandling(event.target.value as CounterpartyHandling)}
          >
            {Object.entries(handlings).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-category`}>Standaardcategorie</Label>
          <Select id={`${id}-category`} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">Geen</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${id}-ibans`}>IBANs</Label>
          <Input
            id={`${id}-ibans`}
            value={ibans}
            onChange={(event) => setIbans(event.target.value)}
            placeholder="NL00 BANK 0123 4567 89, ..."
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-names`}>Naam op afschrift bevat</Label>
          <Input
            id={`${id}-names`}
            value={names}
            onChange={(event) => setNames(event.target.value)}
            placeholder="supermarkt, ..."
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id}-note`}>Notitie</Label>
        <Input
          id={`${id}-note`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Wat het is, wanneer je er komt, ..."
        />
      </div>
      <ResultMessage result={result} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {counterparty ? "Opslaan" : "Toevoegen"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Annuleren
        </Button>
      </div>
    </form>
  );
}

export function Counterparties({
  counterparties,
  categories,
}: {
  counterparties: CounterpartyDto[];
  categories: CategoryDto[];
}) {
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(counterparty: CounterpartyDto) {
    if (!confirm(`"${counterparty.name}" verwijderen? De uitgaven blijven, zonder tegenrekening.`)) return;
    startTransition(async () => setResult(await deleteCounterparty(counterparty.id)));
  }

  return (
    <div className="space-y-3">
      <Button size="sm" onClick={() => setEditing("new")} disabled={editing === "new"}>
        Toevoegen
      </Button>
      {editing === "new" && <CounterpartyForm categories={categories} onDone={() => setEditing(null)} />}
      <ResultMessage result={result} />
      {counterparties.length === 0 && editing !== "new" && (
        <p className="text-muted-foreground text-sm">Nog niets.</p>
      )}
      <ul className="divide-y">
        {counterparties.map((counterparty) => (
          <li key={counterparty.id} className="py-3">
            {editing === counterparty.id ? (
              <CounterpartyForm
                counterparty={counterparty}
                categories={categories}
                onDone={() => setEditing(null)}
              />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{counterparty.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {[
                      handlings[counterparty.handling],
                      ...counterparty.ibans.map(formatIban),
                      ...counterparty.names.map((name) => `"${name}"`),
                      categories.find((c) => c.id === counterparty.categoryId)?.name,
                      counterparty.note,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setEditing(counterparty.id)}>
                    Bewerken
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(counterparty)} disabled={pending}>
                    Verwijderen
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
