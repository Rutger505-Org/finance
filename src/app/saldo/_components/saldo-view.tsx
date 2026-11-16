"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { matches } from "@/lib/finance/balances";
import { parseDay } from "@/lib/finance/dates";
import { date, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { BalanceChart } from "./balance-chart";
import { ChangeNote } from "./change-note";
import type { AccountView } from "./types";

const when = (iso: string, time: string | null) =>
  `${date(parseDay(iso))}${time ? ` ${time}` : ""}`;

function Difference({ value }: { value: number | null }) {
  if (value === null)
    return <span className="text-muted-foreground">eerste checkpoint</span>;
  if (matches(value)) return <span className="text-emerald-700">klopt</span>;
  return (
    <span className="text-amber-700">
      {money(Math.abs(value))} {value > 0 ? "meer" : "minder"} dan verwacht
    </span>
  );
}

/** Per account: expected balance now, a chart of the last two months and what changed since the last checkpoint. */
export function SaldoView({ views }: { views: AccountView[] }) {
  const [selected, setSelected] = useState(views[0].key);
  const view = views.find((v) => v.key === selected) ?? views[0];
  const last = view.checkpoints[0];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {views.map((v) => {
          const latest = v.checkpoints[0];
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => setSelected(v.key)}
              className={cn(
                "bg-card rounded-xl border p-4 text-left shadow-sm transition-colors",
                v.key === selected
                  ? "ring-2 ring-blue-600"
                  : "hover:bg-muted/50",
              )}
            >
              <p className="text-muted-foreground text-sm">{v.label}</p>
              <p className="text-2xl font-semibold tabular-nums">
                {v.expected === null ? "–" : money(v.expected)}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {latest ? (
                  <>
                    Checkpoint {when(latest.date, latest.time)}:{" "}
                    {money(latest.amount)} ·{" "}
                    <Difference value={latest.difference} />
                  </>
                ) : (
                  "Nog geen checkpoint"
                )}
              </p>
            </button>
          );
        })}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{view.label}: afgelopen 2 maanden</CardTitle>
          <CardDescription>
            Verwacht saldo aan het eind van elke dag; bij elk checkpoint begint
            het opnieuw.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <BalanceChart key={view.key} points={view.points} checkpoints={view.checkpoints} />
          {last && (
            <div className="space-y-1 text-sm tabular-nums">
              <p className="font-medium">Sinds het laatste checkpoint</p>
              <p className="flex justify-between">
                <span>Checkpoint {when(last.date, last.time)}</span>
                <span>{money(last.amount)}</span>
              </p>
              {view.since.map((group) => (
                <details key={group.kind} className="group">
                  <summary className="flex cursor-pointer list-none justify-between">
                    <span>
                      <span className="text-muted-foreground mr-1 inline-block transition-transform group-open:rotate-90">
                        ›
                      </span>
                      {group.label} ({group.items.length})
                    </span>
                    <span>{money(group.total)}</span>
                  </summary>
                  <ul className="text-muted-foreground mt-1 mb-2 space-y-0.5 pl-4 text-xs">
                    {group.items.map((item, index) => (
                      <li key={index} className="flex justify-between gap-4">
                        <span className="truncate">
                          {when(item.date, item.time)} · {item.name}
                          <ChangeNote change={item} />
                        </span>
                        <span>{money(item.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
              <p className="flex justify-between border-t pt-1 font-medium">
                <span>Verwacht nu</span>
                <span>
                  {view.expected === null ? "–" : money(view.expected)}
                </span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
