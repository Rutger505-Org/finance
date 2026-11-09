"use client";

import { saveSettings, type ActionResult } from "@/app/actions";
import { ResultMessage } from "@/components/issues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { Settings, Transfer } from "@/lib/finance/schemas";
import { amountText, parseAmount } from "@/lib/format";
import { useState, useTransition } from "react";
import { CycleFields, cycleState, cycleValue, type CycleState } from "./cycle-fields";

interface TransferState {
  key: number;
  name: string;
  cycle: CycleState;
  mode: "auto" | "fixed" | "income";
  amount: string;
  income: string;
}

let nextKey = 0;

function transferState(transfer?: Transfer): TransferState {
  const amount = transfer?.amount ?? "auto";
  return {
    key: nextKey++,
    name: transfer?.name ?? "",
    cycle: cycleState(transfer?.cycle),
    mode: amount === "auto" ? "auto" : typeof amount === "number" ? "fixed" : "income",
    amount: typeof amount === "number" ? amountText(amount) : "",
    income: typeof amount === "object" ? String(amount.income) : "",
  };
}

export function SettingsForm({
  settings,
  incomes,
  amounts,
}: {
  settings: Settings;
  incomes: { id: number; name: string; active: boolean }[];
  /** Current amount per saved transfer, same order as `settings.transfers`. */
  amounts: string[];
}) {
  const [transfers, setTransfers] = useState(() => settings.transfers.map(transferState));
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const savedKeys = transfers.slice(0, settings.transfers.length).map((t) => t.key);

  const update = (key: number, patch: Partial<TransferState>) =>
    setTransfers((list) => list.map((t) => (t.key === key ? { ...t, ...patch } : t)));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value: { name: string; cycle: unknown; amount: unknown }[] = [];
    for (const [index, t] of transfers.entries()) {
      let amount: unknown = "auto";
      if (t.mode === "fixed") {
        amount = parseAmount(t.amount);
        if (amount === null) {
          setResult({ ok: false, error: `Overboeking ${index + 1}: vul een geldig bedrag in` });
          return;
        }
      } else if (t.mode === "income") {
        if (!t.income) {
          setResult({ ok: false, error: `Overboeking ${index + 1}: kies een inkomen` });
          return;
        }
        amount = { income: Number(t.income) };
      }
      value.push({ name: t.name, cycle: cycleValue(t.cycle), amount });
    }
    startTransition(async () => {
      setResult(await saveSettings({ transfers: value }));
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {transfers.map((t, index) => {
        const id = `transfer-${t.key}`;
        const savedIndex = savedKeys.indexOf(t.key);
        return (
          <fieldset key={t.key} className="space-y-3 rounded-md border p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-48 flex-1 space-y-1">
                <Label htmlFor={`${id}-name`}>Naam</Label>
                <Input
                  id={`${id}-name`}
                  value={t.name}
                  placeholder={`Overboeking ${index + 1}`}
                  onChange={(event) => update(t.key, { name: event.target.value })}
                />
              </div>
              {savedIndex >= 0 && amounts[savedIndex] && (
                <p className="h-9 text-sm leading-9 tabular-nums">
                  Nu <strong>{amounts[savedIndex]}</strong> per keer
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={transfers.length === 1}
                onClick={() => setTransfers((list) => list.filter((other) => other.key !== t.key))}
              >
                Verwijderen
              </Button>
            </div>
            <CycleFields value={t.cycle} onChange={(cycle) => update(t.key, { cycle })} idPrefix={id} />
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor={`${id}-mode`}>Bedrag</Label>
                <Select
                  id={`${id}-mode`}
                  value={t.mode}
                  onChange={(event) => update(t.key, { mode: event.target.value as TransferState["mode"] })}
                  className="w-56"
                >
                  <option value="auto">Automatisch (de rest)</option>
                  <option value="fixed">Vast bedrag</option>
                  <option value="income">Heel inkomen</option>
                </Select>
              </div>
              {t.mode === "fixed" && (
                <div className="space-y-1">
                  <Label htmlFor={`${id}-amount`}>Vast bedrag (€)</Label>
                  <Input
                    id={`${id}-amount`}
                    inputMode="decimal"
                    value={t.amount}
                    onChange={(event) => update(t.key, { amount: event.target.value })}
                    className="w-40"
                  />
                </div>
              )}
              {t.mode === "income" && (
                <div className="space-y-1">
                  <Label htmlFor={`${id}-income`}>Inkomen</Label>
                  <Select
                    id={`${id}-income`}
                    value={t.income}
                    onChange={(event) => update(t.key, { income: event.target.value })}
                    className="w-56"
                  >
                    <option value="">Kies…</option>
                    {incomes.map((income) => (
                      <option key={income.id} value={income.id}>
                        {income.name}
                        {income.active ? "" : " (inactief)"}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          </fieldset>
        );
      })}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={transfers.length >= 10}
          onClick={() => setTransfers((list) => [...list, transferState()])}
        >
          Overboeking toevoegen
        </Button>
        <Button type="submit" disabled={pending}>
          Opslaan
        </Button>
      </div>
      <ResultMessage result={result} />
    </form>
  );
}
