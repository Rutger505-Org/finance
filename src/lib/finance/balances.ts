import type { Day } from "./dates";
import { movementsBetween, resolveTransfers, type PlanInput } from "./plan";
import { occurrencesBetween } from "./schedule";
import type { BalanceAccount } from "./schemas";

/** All amounts in this module are cents. */

/**
 * - income, refund (fixed-costs → current), transfer (current → fixed-costs), expense (paid from the current
 *   account), spending, oneOffIncome (money in that isn't a regular income): the current account
 * - transfer, charge (direct debit), refund: the fixed-costs account
 * - fromSavings, toSavings: the current account's side of a savings transfer
 * - fromCurrent, toCurrent: the savings account's side; withdrawal (planned, after today): a savings account
 * - unplannedTransfer: a bank line moving money between the current and fixed-costs account outside the plan
 *   (both accounts)
 */
export type ChangeKind =
  | "income"
  | "transfer"
  | "refund"
  | "expense"
  | "charge"
  | "spending"
  | "oneOffIncome"
  | "fromSavings"
  | "toSavings"
  | "fromCurrent"
  | "toCurrent"
  | "withdrawal"
  | "unplannedTransfer";

/**
 * A booked bank line (current account) linked to a plan occurrence: an income or expense (paid from the current
 * account) on its due day, the refund of an expense on its refund day (fixed → current), a transfer from the
 * settings on its day (current → fixed), or `fixed`: money between the current and fixed-costs account outside
 * the plan.
 */
export type PlanLink =
  | { kind: "income"; incomeId: number; day: Day }
  | { kind: "expense"; expenseId: number; day: Day }
  | { kind: "refund"; expenseId: number; day: Day }
  | { kind: "transfer"; transfer: string; day: Day }
  | { kind: "fixed" };

export interface PlanLine {
  day: Day;
  /** Bank sign on the current account: negative is money out. */
  amount: number;
  /** Shown in the changes: the item's name. */
  name: string;
  link: PlanLink;
}

/** Identifies one occurrence of a plan item; null for `fixed`. */
export function occurrenceKey(link: PlanLink): string | null {
  switch (link.kind) {
    case "income":
      return `income:${link.incomeId}:${link.day}`;
    case "expense":
    case "refund":
      return `${link.kind}:${link.expenseId}:${link.day}`;
    case "transfer":
      return `transfer:${link.transfer}:${link.day}`;
    case "fixed":
      return null;
  }
}

/** A planned or booked change of one account's balance. */
export interface Change {
  day: Day;
  /** HH:MM, spendings, one-off incomes and savings transfers only. Without one it counts before any checkpoint that day. */
  time: string | null;
  name: string;
  /** Signed: negative is money out. */
  amount: number;
  kind: ChangeKind;
  /** A planned occurrence that no bank line is linked to: counted as planned. */
  planned?: boolean;
  /**
   * A bank line linked to a planned occurrence: its planned day and amount (null when the item is no longer in
   * the plan) and the real amount of all lines linked to it together, so deviations show.
   */
  plan?: { day: Day; amount: number | null; real: number };
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
  /** What happened between the checkpoint before and this one, in order; empty for the first. */
  changes: Change[];
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
export const changePosition = (change: Pick<Change, "day" | "time">) =>
  change.day * 1441 + (change.time ? minutes(change.time) : 0);
export const checkpointPosition = (checkpoint: Pick<Checkpoint, "day" | "time">) =>
  checkpoint.day * 1441 + (checkpoint.time ? minutes(checkpoint.time) : 1440);

/**
 * Changes of the current or fixed-costs account in (after, until] from the plan and the bank lines linked to it:
 * a planned occurrence with at least one linked line is replaced by its lines (real day, real amount; the
 * fixed-costs side the other way round), the rest counts as planned. `lines` are all linked lines, whatever
 * their day, so an occurrence paid outside the range is still replaced. Charges of the fixed-costs account are
 * never linked: they aren't on the current account's statement.
 */
export function planChanges(
  input: PlanInput,
  account: "current" | "fixed",
  after: Day,
  until: Day,
  lines: PlanLine[] = [],
): Change[] {
  const planned: (Change & { key: string | null })[] = [];
  const add = (
    key: string | null,
    day: Day,
    name: string,
    amount: number,
    kind: ChangeKind,
  ) =>
    planned.push({ key, day, time: null, name, amount, kind, planned: true });
  for (const movement of movementsBetween(input, after, until)) {
    const { day, name, amount, kind, itemId } = movement;
    const key = (k: string) =>
      itemId === undefined ? null : `${k}:${itemId}:${day}`;
    if (account === "current") {
      if (kind === "income") add(key("income"), day, name, amount, "income");
      if (kind === "transfer")
        add(`transfer:${name}:${day}`, day, name, -amount, "transfer");
      if (kind === "refund") add(key("refund"), day, name, amount, "refund");
    } else {
      if (kind === "transfer")
        add(`transfer:${name}:${day}`, day, name, amount, "transfer");
      if (kind === "charge") add(null, day, name, -amount, "charge");
      if (kind === "refund") add(key("refund"), day, name, -amount, "refund");
    }
  }
  if (account === "current") {
    for (const expense of input.expenses) {
      if (expense.account !== "current") continue;
      for (const day of occurrencesBetween(expense.cycle, after, until)) {
        add(
          expense.id === undefined ? null : `expense:${expense.id}:${day}`,
          day,
          expense.name,
          -expense.amount,
          "expense",
        );
      }
    }
  }

  const sign = account === "current" ? 1 : -1;
  const real = new Map<string, number>();
  for (const line of lines) {
    const key = occurrenceKey(line.link);
    if (key !== null) real.set(key, (real.get(key) ?? 0) + sign * line.amount);
  }
  const changes: Change[] = planned
    .filter((change) => change.key === null || !real.has(change.key))
    .map(({ key: _key, ...change }) => change);
  for (const line of lines) {
    if (line.day <= after || line.day > until) continue;
    const { link } = line;
    if (
      account === "fixed" &&
      (link.kind === "income" || link.kind === "expense")
    )
      continue;
    const change: Change = {
      day: line.day,
      time: null,
      name: line.name,
      amount: sign * line.amount,
      kind: link.kind === "fixed" ? "unplannedTransfer" : link.kind,
    };
    if (link.kind !== "fixed") {
      change.plan = {
        day: link.day,
        amount: plannedAmount(input, account, link),
        real: real.get(occurrenceKey(link)!)!,
      };
    }
    changes.push(change);
  }
  return changes;
}

/** The planned amount of a linked occurrence on this account's side; null when the item isn't in the plan. */
function plannedAmount(
  input: PlanInput,
  account: "current" | "fixed",
  link: Exclude<PlanLink, { kind: "fixed" }>,
) {
  const sign = account === "current" ? 1 : -1;
  switch (link.kind) {
    case "income": {
      const income = input.incomes.find((item) => item.id === link.incomeId);
      return income ? income.amount : null;
    }
    case "expense": {
      const expense = input.expenses.find(
        (item) => item.id === link.expenseId && item.account === "current",
      );
      return expense ? -expense.amount : null;
    }
    case "refund": {
      const expense = input.expenses.find(
        (item) => item.id === link.expenseId && item.account === "current",
      );
      return expense ? sign * expense.amount : null;
    }
    case "transfer": {
      const transfer = resolveTransfers(input, link.day).find(
        (item) => item.name === link.transfer,
      );
      return transfer ? -sign * transfer.amount : null;
    }
  }
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
      changes: running === null ? [] : since,
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
