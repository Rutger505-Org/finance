"use client";

import { addBalance, type ActionResult } from "@/app/actions";
import { ResultMessage } from "@/components/issues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { BalanceAccount } from "@/lib/finance/schemas";
import { money, parseAmount } from "@/lib/format";
import { useEffect, useId, useState, useTransition } from "react";

interface AccountOption {
  key: string;
  label: string;
  account: BalanceAccount;
  savingsAccountId: number | null;
  /** Expected balance at the end of the day, by date (cents). */
  expected: Record<string, number | null>;
}

const clock = () => new Date().toTimeString().slice(0, 5);

/** Records a checkpoint: the real balance of one account, today by default. */
export function CheckpointForm({
  accounts,
  today,
}: {
  accounts: AccountOption[];
  today: string;
}) {
  const id = useId();
  const [key, setKey] = useState(accounts[0].key);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [amount, setAmount] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const selected =
    accounts.find((account) => account.key === key) ?? accounts[0];
  const expected = selected.expected[date];

  // The browser's clock, not the server's, so only after mounting.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setTime(clock()), []);

  function changeDate(value: string) {
    setDate(value);
    setTime(value === today ? clock() : "");
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = parseAmount(amount);
    if (value === null) {
      setResult({ ok: false, error: "Vul een bedrag in, bijv. 450 of 450,25" });
      return;
    }
    startTransition(async () => {
      const response = await addBalance({
        account: selected.account,
        ...(selected.savingsAccountId !== null && {
          savingsAccountId: selected.savingsAccountId,
        }),
        amount: value,
        date,
        ...(time && { time }),
      });
      setResult(response);
      if (response.ok) setAmount("");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[2fr_1.3fr_1fr_1.5fr_auto] sm:items-end">
        <div className="space-y-1">
          <Label htmlFor={`${id}-account`}>Rekening</Label>
          <Select
            id={`${id}-account`}
            value={key}
            onChange={(event) => setKey(event.target.value)}
          >
            {accounts.map((account) => (
              <option key={account.key} value={account.key}>
                {account.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-date`}>Datum</Label>
          <Input
            id={`${id}-date`}
            type="date"
            max={today}
            value={date}
            onChange={(event) => changeDate(event.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-time`}>Tijd</Label>
          <Input
            id={`${id}-time`}
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-amount`}>Echt saldo (€)</Label>
          <Input
            id={`${id}-amount`}
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={pending}>
          Opslaan
        </Button>
      </div>
      {expected != null && (
        <p className="text-muted-foreground text-sm">
          Verwacht aan het eind van deze dag:{" "}
          <span className="text-foreground font-medium">{money(expected)}</span>
        </p>
      )}
      <ResultMessage result={result} />
    </form>
  );
}
