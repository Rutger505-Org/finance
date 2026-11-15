import type { Day } from "./dates";
import { movementsBetween, type PlanInput } from "./plan";
import { occurrencesBetween } from "./schedule";
import type { BalanceAccount } from "./schemas";

/** All amounts in this module are cents. */

/**
 * - income, refund (fixed-costs → current), transfer (current → fixed-costs), expense (paid from the current
 *   account), spending: the current account
 * - transfer, charge (direct debit), refund: the fixed-costs account
 * - withdrawal: a savings account
 */
export type ChangeKind =
  | "income"
  | "transfer"
  | "refund"
  | "expense"
  | "charge"
  | "spending"
  | "withdrawal";

/** A planned or booked change of one account's balance. */
export interface Change {
  day: Day;
  /** HH:MM, spendings only. Without one it counts before any checkpoint that day. */
  time: string | null;
  name: string;
  /** Signed: negative is money out. */
  amount: number;
  kind: ChangeKind;
}

export interface Checkpoint {
  id: number;
  day: Day;
  /** HH:MM; null is the end of the day. */
  time: string | null;
  amount: number;
}

export interface CheckedCheckpoint extends Checkpoint {
  /** What the balance should have been, from the checkpoint before; null for the first. */
  expected: number | null;
  /** Real minus expected: positive is more money than expected. */
  difference: number | null;
}

export interface Reconciliation {
  /** Oldest first. */
  checkpoints: CheckedCheckpoint[];
  /** Expected balance at the end of each day from `from` through `until`; null before the first checkpoint. */
  days: { day: Day; balance: number | null }[];
  /** Expected balance at the end of `until`; null without a checkpoint. */
  expected: number | null;
  /** Changes after the last checkpoint through `until`, in order. */
  since: Change[];
}

const minutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
/** Changes without a time sort first in their day, checkpoints without one last. */
const changePosition = (change: Change) =>
  change.day * 1441 + (change.time ? minutes(change.time) : 0);
const checkpointPosition = (checkpoint: Checkpoint) =>
  checkpoint.day * 1441 + (checkpoint.time ? minutes(checkpoint.time) : 1440);

/** Planned changes of the current or fixed-costs account in (after, until]. */
export function planChanges(
  input: PlanInput,
  account: "current" | "fixed",
  after: Day,
  until: Day,
): Change[] {
  const change = (
    day: Day,
    name: string,
    amount: number,
    kind: ChangeKind,
  ): Change => ({
    day,
    time: null,
    name,
    amount,
    kind,
  });
  const changes: Change[] = [];
  for (const movement of movementsBetween(input, after, until)) {
    const { day, name, amount, kind } = movement;
    if (account === "current") {
      if (kind === "income") changes.push(change(day, name, amount, "income"));
      if (kind === "transfer")
        changes.push(change(day, name, -amount, "transfer"));
      if (kind === "refund") changes.push(change(day, name, amount, "refund"));
    } else {
      if (kind === "transfer")
        changes.push(change(day, name, amount, "transfer"));
      if (kind === "charge") changes.push(change(day, name, -amount, "charge"));
      if (kind === "refund") changes.push(change(day, name, -amount, "refund"));
    }
  }
  if (account === "current") {
    for (const expense of input.expenses) {
      if (expense.account !== "current") continue;
      for (const day of occurrencesBetween(expense.cycle, after, until)) {
        changes.push(change(day, expense.name, -expense.amount, "expense"));
      }
    }
  }
  return changes;
}

/** A checkpoint less than a euro off counts as matching. */
export const matches = (difference: number) => Math.abs(difference) < 100;

export const accountLabel: Record<BalanceAccount, string> = {
  current: "Lopende rekening",
  fixed: "Vaste lastenrekening",
  savings: "Spaarrekening",
};

/**
 * Walks an account's checkpoints and changes in order: each checkpoint is compared with what the balance should
 * have been since the one before, then becomes the new starting point.
 */
export function reconcile(
  checkpoints: Checkpoint[],
  changes: Change[],
  from: Day,
  until: Day,
): Reconciliation {
  const sortedCheckpoints = [...checkpoints].sort(
    (a, b) => checkpointPosition(a) - checkpointPosition(b) || a.id - b.id,
  );
  const sortedChanges = changes
    .filter((change) => change.day <= until)
    .sort((a, b) => changePosition(a) - changePosition(b));
  type Event = {
    position: number;
    day: Day;
    change?: Change;
    checkpoint?: Checkpoint;
  };
  const events: Event[] = [
    ...sortedChanges.map((change): Event => ({
      position: changePosition(change),
      day: change.day,
      change,
    })),
    ...sortedCheckpoints
      .filter((checkpoint) => checkpoint.day <= until)
      .map((checkpoint): Event => ({
        position: checkpointPosition(checkpoint),
        day: checkpoint.day,
        checkpoint,
      })),
  ].sort(
    (a, b) =>
      a.position - b.position || (a.change ? 0 : 1) - (b.change ? 0 : 1),
  );

  let running: number | null = null;
  let since: Change[] = [];
  const checked: CheckedCheckpoint[] = [];
  const days: Reconciliation["days"] = [];
  let index = 0;
  const apply = (event: Event) => {
    if (event.change) {
      if (running !== null) {
        running += event.change.amount;
        since.push(event.change);
      }
      return;
    }
    const checkpoint = event.checkpoint!;
    checked.push({
      ...checkpoint,
      expected: running,
      difference: running === null ? null : checkpoint.amount - running,
    });
    running = checkpoint.amount;
    since = [];
  };
  for (; index < events.length && events[index].day < from; index++)
    apply(events[index]);
  for (let day = from; day <= until; day++) {
    for (; index < events.length && events[index].day === day; index++)
      apply(events[index]);
    days.push({ day, balance: running });
  }
  return { checkpoints: checked, days, expected: running, since };
}
