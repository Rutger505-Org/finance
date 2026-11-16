"use client";

import { deleteSavingsAccount, type ActionResult } from "@/app/actions";
import { ResultMessage } from "@/components/issues";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { parseDay } from "@/lib/finance/dates";
import type { SavingsSummary } from "@/lib/finance/savings";
import type { SavingsAccountDto, ScenarioDto } from "@/lib/finance/schemas";
import { date, moneyEuros, monthLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useState, useTransition } from "react";
import { SavingsForm } from "./savings-form";
import { SavingsTransfers } from "./transfers";

const fullDate = (iso: string) => `${date(parseDay(iso))} ${iso.slice(0, 4)}`;

export function SavingsList({
  accounts,
  scenarios,
  today,
}: {
  accounts: {
    account: SavingsAccountDto;
    /** Checkpoint plus the transfers after it. */
    balance: number | null;
    summary: SavingsSummary | null;
  }[];
  scenarios: ScenarioDto[];
  today: string;
}) {
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const scenarioNames = (ids: number[]) =>
    scenarios
      .filter((s) => ids.includes(s.id))
      .map((s) => s.name)
      .join(", ");

  function remove(account: SavingsAccountDto) {
    if (
      !confirm(
        `Spaarrekening "${account.name}" met haar checkpoints en overboekingen verwijderen?`,
      )
    )
      return;
    startTransition(async () =>
      setResult(await deleteSavingsAccount(account.id)),
    );
  }

  return (
    <>
      <ResultMessage result={result} />
      {accounts.map(({ account, balance, summary }) => (
        <Card key={account.id}>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-1.5">
              <CardTitle>
                {account.name}
                {account.scenarioIds && scenarios.length > 1 && (
                  <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-xs font-normal text-sky-800">
                    alleen {scenarioNames(account.scenarioIds)}
                  </span>
                )}
              </CardTitle>
              {account.iban && (
                <p className="text-muted-foreground font-mono text-xs">
                  {account.iban.replace(/(.{4})/g, "$1 ").trim()}
                </p>
              )}
              <CardDescription>
                {account.until
                  ? `Wat na de geplande uitgaven over is, verdeeld${summary?.firstMonth ? ` van ${monthLabel(summary.firstMonth)}` : ""} t/m ${monthLabel(account.until)}.`
                  : "Wordt niet verdeeld over de maanden."}
              </CardDescription>
            </div>
            {editing !== account.id && (
              <div className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(account.id)}
                >
                  Bewerken
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove(account)}
                  disabled={pending}
                >
                  Verwijderen
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {editing === account.id ? (
              <SavingsForm
                account={account}
                scenarios={scenarios}
                today={today}
                onDone={() => setEditing(null)}
              />
            ) : (
              <div className="space-y-1 text-sm tabular-nums">
                <p className="flex justify-between">
                  <span>
                    {account.balance
                      ? `Checkpoint ${fullDate(account.balance.date)}${account.balance.time ? ` ${account.balance.time}` : ""}`
                      : "Nog geen saldo"}
                  </span>
                  <span>
                    {account.balance && moneyEuros(account.balance.amount)}
                  </span>
                </p>
                {balance !== null && balance !== account.balance?.amount && (
                  <p className="flex justify-between">
                    <span>Met overboekingen sindsdien</span>
                    <span>{moneyEuros(balance)}</span>
                  </p>
                )}
                {[...account.withdrawals]
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((w, index) => {
                    const past = w.date <= today;
                    const counted =
                      !summary ||
                      summary.withdrawals.some(
                        (s) => s.date === w.date && s.name === w.name,
                      );
                    return (
                      <p
                        key={index}
                        className={cn(
                          "text-muted-foreground flex justify-between",
                          (past || !counted) && "opacity-60",
                        )}
                      >
                        <span>
                          {w.name} · {fullDate(w.date)}
                          {past && " · geweest"}
                        </span>
                        <span className={cn(past && "line-through")}>
                          {moneyEuros(-w.amount)}
                        </span>
                      </p>
                    );
                  })}
                {summary && (
                  <>
                    <p className="flex justify-between border-t pt-1">
                      <span>Vrij</span>
                      <span className={cn(summary.free < 0 && "text-red-700")}>
                        {moneyEuros(summary.free)}
                      </span>
                    </p>
                    <p className="flex justify-between">
                      <span>Maanden</span>
                      <span>{summary.months}</span>
                    </p>
                    <p className="flex justify-between border-t pt-1 text-base font-medium">
                      <span>Per maand</span>
                      <span
                        className={cn(
                          (summary.perMonth ?? 0) < 0 && "text-red-700",
                        )}
                      >
                        {summary.perMonth === null
                          ? "–"
                          : moneyEuros(summary.perMonth)}
                      </span>
                    </p>
                  </>
                )}
                <SavingsTransfers
                  savingsAccountId={account.id}
                  transfers={account.transfers}
                  today={today}
                />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      {editing === "new" ? (
        <Card>
          <CardHeader>
            <CardTitle>Nieuwe spaarrekening</CardTitle>
          </CardHeader>
          <CardContent>
            <SavingsForm
              scenarios={scenarios}
              today={today}
              onDone={() => setEditing(null)}
            />
          </CardContent>
        </Card>
      ) : (
        <div>
          <Button onClick={() => setEditing("new")}>
            Spaarrekening toevoegen
          </Button>
        </div>
      )}
    </>
  );
}
