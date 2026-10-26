"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { Cycle } from "@/lib/finance/schemas";
import { monthNames } from "@/lib/format";

/** Form state for a cycle: every field as text, so partial input is possible. */
export interface CycleState {
  type: Cycle["type"];
  day: string;
  month: string;
  days: string;
  anchor: string;
}

export function cycleState(cycle?: Cycle): CycleState {
  return {
    type: cycle?.type ?? "monthly",
    day: cycle && cycle.type !== "interval" ? String(cycle.day) : "1",
    month: cycle?.type === "yearly" ? String(cycle.month) : "1",
    days: cycle?.type === "interval" ? String(cycle.days) : "28",
    anchor: cycle?.type === "interval" ? cycle.anchor : "",
  };
}

/** Builds the cycle to send; the server validates it. */
export function cycleValue(state: CycleState): unknown {
  switch (state.type) {
    case "monthly":
      return { type: "monthly", day: Number(state.day) };
    case "yearly":
      return { type: "yearly", month: Number(state.month), day: Number(state.day) };
    case "interval":
      return { type: "interval", days: Number(state.days), anchor: state.anchor };
  }
}

export function CycleFields({
  value,
  onChange,
  idPrefix,
}: {
  value: CycleState;
  onChange: (value: CycleState) => void;
  idPrefix: string;
}) {
  const set = (patch: Partial<CycleState>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-type`}>Herhaling</Label>
        <Select
          id={`${idPrefix}-type`}
          value={value.type}
          onChange={(event) => set({ type: event.target.value as Cycle["type"] })}
        >
          <option value="monthly">Elke maand</option>
          <option value="yearly">Elk jaar</option>
          <option value="interval">Elke n dagen</option>
        </Select>
      </div>
      {value.type === "yearly" && (
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-month`}>Maand</Label>
          <Select id={`${idPrefix}-month`} value={value.month} onChange={(event) => set({ month: event.target.value })}>
            {monthNames.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </Select>
        </div>
      )}
      {value.type !== "interval" ? (
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-day`}>Dag</Label>
          <Input
            id={`${idPrefix}-day`}
            type="number"
            min={1}
            max={31}
            value={value.day}
            onChange={(event) => set({ day: event.target.value })}
          />
        </div>
      ) : (
        <>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-days`}>Elke … dagen</Label>
            <Input
              id={`${idPrefix}-days`}
              type="number"
              min={1}
              max={366}
              value={value.days}
              onChange={(event) => set({ days: event.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-anchor`}>Een bekende datum</Label>
            <Input
              id={`${idPrefix}-anchor`}
              type="date"
              value={value.anchor}
              onChange={(event) => set({ anchor: event.target.value })}
            />
          </div>
        </>
      )}
    </div>
  );
}
