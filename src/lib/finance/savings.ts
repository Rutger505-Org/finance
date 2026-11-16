import { changePosition, checkpointPosition } from "./balances";
import { isoDay, parseDay, toYMD, type Day } from "./dates";
import type { Savings, SavingsAccountDto, SavingsWithdrawal } from "./schemas";

export interface SavingsSummary {
  /** Planned withdrawals after today, through the end of `until`, by date. Earlier ones are history. */
  withdrawals: SavingsWithdrawal[];
  /** Euros the withdrawals take. */
  reserved: number;
  /** Balance minus reserved; negative when the savings fall short. */
  free: number;
  /** Months from the one after today through `until`. */
  months: number;
  /** YYYY-MM of the first of those months, null when there are none. */
  firstMonth: string | null;
  /** Free euros per month, rounded down to the cent; null without months. */
  perMonth: number | null;
}

const monthIndex = (year: number, month: number) => year * 12 + month - 1;
const monthString = (index: number) => `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
const cents = (euros: number) => Math.round(euros * 100);

/**
 * What the savings can give per month once the planned withdrawals are covered. Only withdrawals after today
 * count: what already happened is in the balance as a real transfer.
 */
export function summarizeSavings(savings: Savings, today: Day): SavingsSummary {
  const end = `${savings.until}-31`;
  const after = isoDay(today);
  const withdrawals = savings.withdrawals
    .filter((w) => w.date > after && w.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, "nl"));
  const reserved = withdrawals.reduce((total, w) => total + cents(w.amount), 0);
  const free = cents(savings.balance) - reserved;
  const { year, month } = toYMD(today);
  const first = monthIndex(year, month) + 1;
  const [untilYear, untilMonth] = savings.until.split("-").map(Number) as [number, number];
  const months = Math.max(0, monthIndex(untilYear, untilMonth) - first + 1);
  return {
    withdrawals,
    reserved: reserved / 100,
    free: free / 100,
    months,
    firstMonth: months > 0 ? monthString(first) : null,
    perMonth: months > 0 ? Math.floor(free / months) / 100 : null,
  };
}

/** Items in a scenario: those without scenarios belong to all of them. */
export function inScenario<T extends { scenarioIds: number[] | null }>(items: T[], scenarioId: number): T[] {
  return items.filter((item) => item.scenarioIds === null || item.scenarioIds.includes(scenarioId));
}

/**
 * Euros on the account now: the latest checkpoint plus the transfers after it, ordered as `reconcile` does (a
 * transfer without a time is at the start of its day, a checkpoint without one at the end). Null without a checkpoint.
 */
export function savingsBalance(account: Pick<SavingsAccountDto, "balance" | "transfers">): number | null {
  const checkpoint = account.balance;
  if (!checkpoint) return null;
  const position = checkpointPosition({ day: parseDay(checkpoint.date), time: checkpoint.time });
  const moved = account.transfers
    .filter((t) => changePosition({ day: parseDay(t.date), time: t.time }) > position)
    .reduce((total, t) => total + cents(t.amount), 0);
  return (cents(checkpoint.amount) - moved) / 100;
}

/** The summary of a savings account that is spread (has `until`) and has a balance; null otherwise. */
export function summarizeAccount(account: SavingsAccountDto, today: Day): SavingsSummary | null {
  const balance = savingsBalance(account);
  if (!account.until || balance === null) return null;
  return summarizeSavings({ balance, until: account.until, withdrawals: account.withdrawals }, today);
}

/** Euros per month the spread savings accounts of a scenario add, null when none is spread. */
export function savingsPerMonth(accounts: SavingsAccountDto[], scenarioId: number, today: Day): number | null {
  const amounts = inScenario(accounts, scenarioId).flatMap((account) => summarizeAccount(account, today)?.perMonth ?? []);
  return amounts.length ? Math.round(amounts.reduce((total, amount) => total + amount, 0) * 100) / 100 : null;
}
