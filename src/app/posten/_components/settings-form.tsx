"use client";

import { saveSettings, type ActionResult } from "@/app/actions";
import { ResultMessage } from "@/components/issues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Settings } from "@/lib/finance/schemas";
import { amountText, parseAmount } from "@/lib/format";
import { useState, useTransition } from "react";
import { CycleFields, cycleState, cycleValue } from "./cycle-fields";

export function SettingsForm({ settings, needed }: { settings: Settings; needed: string }) {
  const [cycle, setCycle] = useState(cycleState(settings.transfer.cycle));
  const [auto, setAuto] = useState(settings.transfer.amount === "auto");
  const [amount, setAmount] = useState(
    settings.transfer.amount === "auto" ? "" : amountText(settings.transfer.amount),
  );
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = auto ? "auto" : parseAmount(amount);
    if (value === null) {
      setResult({ ok: false, error: "Vul een geldig bedrag in, of kies automatisch" });
      return;
    }
    startTransition(async () => {
      setResult(await saveSettings({ transfer: { cycle: cycleValue(cycle), amount: value } }));
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <CycleFields value={cycle} onChange={setCycle} idPrefix="transfer" />
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex h-9 items-center gap-2 text-sm">
          <input type="checkbox" checked={auto} onChange={(event) => setAuto(event.target.checked)} />
          Automatisch bedrag (nu {needed})
        </label>
        {!auto && (
          <div className="space-y-1">
            <Label htmlFor="transfer-amount">Vast bedrag (€)</Label>
            <Input
              id="transfer-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-40"
            />
          </div>
        )}
        <Button type="submit" disabled={pending}>
          Opslaan
        </Button>
      </div>
      <ResultMessage result={result} />
    </form>
  );
}
