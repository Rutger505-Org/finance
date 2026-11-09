"use client";

import { deleteOuting, saveOuting, type ActionResult } from "@/app/actions";
import { ResultMessage } from "@/components/issues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OutingDto } from "@/lib/finance/schemas";
import { useId, useState, useTransition } from "react";

export function OutingForm({ outing, onDone }: { outing?: OutingDto; onDone?: () => void }) {
  const id = useId();
  const [name, setName] = useState(outing?.name ?? "");
  const [date, setDate] = useState(outing?.date ?? "");
  const [note, setNote] = useState(outing?.note ?? "");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const response = await saveOuting(outing?.id ?? null, { name, date: date || null, note: note.trim() || null });
      setResult(response.ok && !outing ? { ok: true, message: `Toegevoegd: ${name}` } : response);
      if (!response.ok) return;
      if (outing) onDone?.();
      else {
        setName("");
        setDate("");
        setNote("");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border bg-muted/30 p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <div className="space-y-1">
          <Label htmlFor={`${id}-name`}>Naam</Label>
          <Input
            id={`${id}-name`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Verjaardag"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-date`}>Datum</Label>
          <Input id={`${id}-date`} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id}-note`}>Notitie</Label>
        <Input id={`${id}-note`} value={note} onChange={(event) => setNote(event.target.value)} />
      </div>
      <ResultMessage result={result} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {outing ? "Opslaan" : "Toevoegen"}
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

export function OutingActions({ outing }: { outing: OutingDto }) {
  const [editing, setEditing] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!confirm(`"${outing.name}" verwijderen? De uitgaven blijven, zonder uitje.`)) return;
    startTransition(async () => setResult(await deleteOuting(outing.id)));
  }

  if (editing) return <OutingForm outing={outing} onDone={() => setEditing(false)} />;
  return (
    <div className="space-y-2">
      <ResultMessage result={result} />
      <div className="flex gap-1">
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          Uitje bewerken
        </Button>
        <Button size="sm" variant="ghost" onClick={remove} disabled={pending}>
          Uitje verwijderen
        </Button>
      </div>
    </div>
  );
}
