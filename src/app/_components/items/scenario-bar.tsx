"use client";

import { deleteScenario, saveScenario, selectScenario, type ActionResult } from "@/app/actions";
import { ResultMessage } from "@/components/issues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ScenarioDto } from "@/lib/finance/schemas";
import { useState, useTransition } from "react";

/** Switch between scenarios (remembered in a cookie) and add, rename or delete them. */
export function ScenarioBar({ scenarios, selected }: { scenarios: ScenarioDto[]; selected: ScenarioDto }) {
  const [mode, setMode] = useState<"new" | "rename" | null>(null);
  const [name, setName] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const act = (fn: () => Promise<ActionResult | void>) =>
    startTransition(async () => {
      const response = await fn();
      setResult(response ?? null);
      if (!response || response.ok) setMode(null);
    });

  function open(next: "new" | "rename") {
    setMode(mode === next ? null : next);
    setName(next === "rename" ? selected.name : "");
    setResult(null);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    act(async () => {
      if (mode === "rename") return saveScenario(selected.id, { name });
      const response = await saveScenario(null, { name });
      if (response.ok && response.id) await selectScenario(response.id);
      return response;
    });
  }

  function remove() {
    if (!confirm(`Situatie "${selected.name}" verwijderen? Posten die alleen hierin zitten gaan mee.`)) return;
    act(() => deleteScenario(selected.id));
  }

  function makeReal() {
    if (!confirm(`"${selected.name}" de echte situatie maken? Het overzicht en de overboekingen rekenen dan hiermee.`)) {
      return;
    }
    act(() => saveScenario(selected.id, { real: true }));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Situatie" className="bg-muted inline-flex flex-wrap rounded-lg p-1">
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              role="tab"
              aria-selected={scenario.id === selected.id}
              disabled={pending}
              onClick={() => act(() => selectScenario(scenario.id))}
              className={
                scenario.id === selected.id
                  ? "bg-background rounded-md px-3 py-1 text-sm font-medium shadow"
                  : "text-muted-foreground hover:text-foreground rounded-md px-3 py-1 text-sm"
              }
            >
              {scenario.name}
            </button>
          ))}
        </div>
        <Button size="sm" variant="ghost" onClick={() => open("new")} aria-label="Situatie toevoegen">
          + Situatie
        </Button>
        <Button size="sm" variant="ghost" onClick={() => open("rename")}>
          Hernoemen
        </Button>
        {!selected.real && (
          <>
            <Button size="sm" variant="ghost" onClick={makeReal} disabled={pending}>
              Maak echt
            </Button>
            <Button size="sm" variant="ghost" onClick={remove} disabled={pending}>
              Verwijderen
            </Button>
          </>
        )}
      </div>
      {mode && (
        <form onSubmit={submit} className="flex flex-wrap gap-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Naam van de situatie"
            className="w-56"
            required
            autoFocus
          />
          <Button type="submit" size="sm" disabled={pending}>
            {mode === "new" ? "Toevoegen" : "Opslaan"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)}>
            Annuleren
          </Button>
        </form>
      )}
      <ResultMessage result={result} />
      {!selected.real && (
        <p className="text-muted-foreground text-sm">
          Vergelijking: het overzicht en de overboekingen rekenen met de echte situatie.
        </p>
      )}
    </div>
  );
}
