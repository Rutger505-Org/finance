import { parseDay } from "@/lib/finance/dates";
import { date, money } from "@/lib/format";
import type { ChangeItem } from "./types";

/**
 * How a change relates to the plan: "gepland, geen bankregel" for a planned occurrence without a bank line; for a
 * linked line what differs from the plan ("€ 0,20 goedkoper dan gepland", another date). Null when nothing to say.
 */
export function planNote(
  change: Pick<ChangeItem, "date" | "planned" | "plan">,
): string | null {
  if (change.planned) return "gepland, geen bankregel";
  const { plan } = change;
  if (!plan) return null;
  if (plan.amount === null) return "niet meer gepland";
  const notes: string[] = [];
  const difference = plan.real - plan.amount;
  if (difference !== 0) {
    const out = plan.amount < 0;
    const word =
      difference > 0
        ? out
          ? "goedkoper"
          : "meer"
        : out
          ? "duurder"
          : "minder";
    notes.push(`${money(Math.abs(difference))} ${word} dan gepland`);
  }
  if (plan.date !== change.date)
    notes.push(`gepland op ${date(parseDay(plan.date))}`);
  return notes.length ? notes.join(", ") : null;
}

export function ChangeNote({ change }: { change: ChangeItem }) {
  const note = planNote(change);
  if (!note) return null;
  return (
    <span className={change.planned ? "text-amber-700" : "text-sky-700"}>
      {" "}
      · {note}
    </span>
  );
}
