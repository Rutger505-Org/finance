"use client";

import { saveExpense, saveIncome, type ActionResult } from "@/app/actions";
import { ResultMessage } from "@/components/issues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { Account, ExpenseDto, IncomeDto, ScenarioDto } from "@/lib/finance/schemas";
import { amountText, parseAmount } from "@/lib/format";
import { useId, useState, useTransition } from "react";
import { CycleFields, cycleState, cycleValue } from "./cycle-fields";

export type ItemKind = "income" | "expense";
export type Item = IncomeDto | ExpenseDto;

export function ItemForm({
  kind,
  item,
  scenarios,
  newIn,
  onDone,
}: {
  kind: ItemKind;
  item?: Item;
  scenarios: ScenarioDto[];
  /** A new item in a comparison scenario starts out only there. */
  newIn: ScenarioDto;
  onDone: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(item?.name ?? "");
  const [amount, setAmount] = useState(item ? amountText(item.amount) : "");
  const [cycle, setCycle] = useState(cycleState(item?.cycle));
  const [account, setAccount] = useState<Account>(item && "account" in item ? item.account : "fixed");
  const [main, setMain] = useState(item && "main" in item ? item.main : false);
  const [active, setActive] = useState(item?.active ?? true);
  const [note, setNote] = useState(item?.note ?? "");
  const [inScenarios, setInScenarios] = useState<number[]>(
    () => (item ? item.scenarioIds : newIn.real ? null : [newIn.id]) ?? scenarios.map((s) => s.id),
  );
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = parseAmount(amount);
    if (value === null) {
      setResult({ ok: false, error: "Vul een geldig bedrag in, bijv. 19,49" });
      return;
    }
    if (inScenarios.length === 0) {
      setResult({ ok: false, error: "Kies minstens één situatie" });
      return;
    }
    const scenarioIds = scenarios.every((s) => inScenarios.includes(s.id)) ? null : inScenarios;
    const common = { name, amount: value, cycle: cycleValue(cycle), active, scenarioIds, note: note.trim() || null };
    startTransition(async () => {
      const response =
        kind === "income"
          ? await saveIncome(item?.id ?? null, { ...common, main })
          : await saveExpense(item?.id ?? null, { ...common, account });
      setResult(response);
      if (response.ok) onDone();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border bg-muted/30 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`${id}-name`}>Naam</Label>
          <Input id={`${id}-name`} value={name} onChange={(event) => setName(event.target.value)} required />
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
      </div>
      <CycleFields value={cycle} onChange={setCycle} idPrefix={id} />
      <div className="grid gap-3 sm:grid-cols-3">
        {kind === "expense" && (
          <div className="space-y-1">
            <Label htmlFor={`${id}-account`}>Hoe betaald</Label>
            <Select id={`${id}-account`} value={account} onChange={(event) => setAccount(event.target.value as Account)}>
              <option value="fixed">Incasso van vaste lasten</option>
              <option value="current">Van lopende, daarna terugboeken</option>
            </Select>
          </div>
        )}
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`${id}-note`}>Notitie</Label>
          <Input id={`${id}-note`} value={note} onChange={(event) => setNote(event.target.value)} />
        </div>
      </div>
      {scenarios.length > 1 && (
        <fieldset className="flex flex-wrap gap-4 text-sm">
          <legend className="mb-1 text-sm font-medium">Geldt in</legend>
          {scenarios.map((scenario) => (
            <label key={scenario.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={inScenarios.includes(scenario.id)}
                onChange={(event) =>
                  setInScenarios((ids) =>
                    event.target.checked ? [...ids, scenario.id] : ids.filter((value) => value !== scenario.id),
                  )
                }
              />
              {scenario.name}
            </label>
          ))}
        </fieldset>
      )}
      <div className="flex flex-wrap gap-4 text-sm">
        {kind === "income" && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={main} onChange={(event) => setMain(event.target.checked)} />
            Hoofdinkomen (periode loopt tot de volgende betaling)
          </label>
        )}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
          Actief
        </label>
      </div>
      <ResultMessage result={result} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {item ? "Opslaan" : "Toevoegen"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Annuleren
        </Button>
      </div>
    </form>
  );
}
