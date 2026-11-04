import type { Day } from "./dates";
import { cyclesPerYear, nextOccurrence, occurrencesBetween } from "./schedule";
import type { Account, Cycle } from "./schemas";

/** Look this far ahead so every yearly expense is covered at least once. */
const HORIZON_DAYS = 2 * 366;

/** All amounts in this module are cents. */
export interface PlanIncome {
  id?: number;
  name: string;
  amount: number;
  cycle: Cycle;
  main: boolean;
}

export interface PlanExpense {
  id?: number;
  name: string;
  amount: number;
  cycle: Cycle;
  account: Account;
}

export interface PlanInput {
  incomes: PlanIncome[];
  expenses: PlanExpense[];
  transfer: { cycle: Cycle; amount: number | "auto" };
}

export interface BalanceInput {
  amount: number;
  date: Day;
}

export interface ExpenseLine {
  id?: number;
  name: string;
  account: Account;
  amount: number;
  /** Money that should be in the fixed-costs account for this expense at the end of today. */
  reserved: number;
  /** Share of every transfer that belongs to this expense. */
  perTransfer: number;
  /** Average per month. */
  monthly: number;
  nextDue: Day;
}

/**
 * - income: arrives on the current account
 * - transfer: current → fixed-costs account
 * - charge: direct debit from the fixed-costs account
 * - refund: fixed-costs → current account, for an expense paid from the current account
 */
export type MovementKind = "income" | "transfer" | "charge" | "refund";

export interface Movement {
  day: Day;
  name: string;
  amount: number;
  kind: MovementKind;
}

export interface Overview {
  today: Day;
  expenses: ExpenseLine[];
  /** Required balance of the fixed-costs account at the end of today. */
  target: number;
  transfer: { next: Day; amount: number; needed: number };
  upcoming: Movement[];
  window: number;
  nextIncomes: Movement[];
  monthly: { income: number; costs: number; transfer: number };
  fixed?: {
    balance: number;
    date: Day;
    /** Balance projected to the end of today with the planned movements since `date`. */
    expected: number;
    difference: number;
  };
  current?: {
    balance: number;
    date: Day;
    /** First day of the next period: the next payment of the main income. */
    periodEnd?: Day;
    daysLeft?: number;
    additions: Movement[];
    deductions: Movement[];
    free: number;
    perDay?: number;
  };
  warnings: string[];
}

export interface OverviewOptions {
  fixed?: BalanceInput;
  current?: BalanceInput;
  /** Days of upcoming movements to list. */
  window: number;
}

/**
 * Smallest starting balance so that, with this expense's share of each
 * transfer, its own envelope never goes negative. A charge on a transfer day
 * is counted before the transfer arrives.
 */
export function reserveNeeded(
  charges: Day[],
  transfers: Day[],
  amount: number,
  perTransfer: number,
): number {
  const events = [
    ...charges.map((day) => ({ day, delta: amount, order: 0 })),
    ...transfers.map((day) => ({ day, delta: -perTransfer, order: 1 })),
  ].sort((a, b) => a.day - b.day || a.order - b.order);

  let balance = 0;
  let needed = 0;
  for (const event of events) {
    balance += event.delta;
    needed = Math.max(needed, balance);
  }
  return needed;
}

export function transferAmount(input: PlanInput): { amount: number; needed: number } {
  const transfersPerYear = cyclesPerYear(input.transfer.cycle);
  const needed = Math.ceil(
    input.expenses.reduce(
      (sum, expense) => sum + (expense.amount * cyclesPerYear(expense.cycle)) / transfersPerYear,
      0,
    ),
  );
  const amount =
    input.transfer.amount === "auto" ? Math.ceil(needed / 100) * 100 : input.transfer.amount;
  return { amount, needed };
}

/** Every planned movement in (after, until], sorted by day. */
export function movementsBetween(input: PlanInput, after: Day, until: Day): Movement[] {
  const { amount } = transferAmount(input);
  const movements: Movement[] = [
    ...input.incomes.flatMap((income) =>
      occurrencesBetween(income.cycle, after, until).map(
        (day): Movement => ({ day, name: income.name, amount: income.amount, kind: "income" }),
      ),
    ),
    ...occurrencesBetween(input.transfer.cycle, after, until).map(
      (day): Movement => ({ day, name: "Overboeking naar vaste lasten", amount, kind: "transfer" }),
    ),
    ...input.expenses.flatMap((expense) =>
      occurrencesBetween(expense.cycle, after, until).map(
        (day): Movement => ({
          day,
          name: expense.name,
          amount: expense.amount,
          kind: expense.account === "fixed" ? "charge" : "refund",
        }),
      ),
    ),
  ];
  const order: Record<MovementKind, number> = { income: 0, transfer: 1, charge: 2, refund: 3 };
  return movements.sort(
    (a, b) => a.day - b.day || order[a.kind] - order[b.kind] || a.name.localeCompare(b.name),
  );
}

const sum = (movements: Movement[]) => movements.reduce((total, m) => total + m.amount, 0);

export function buildOverview(input: PlanInput, today: Day, options: OverviewOptions): Overview {
  const warnings: string[] = [];
  const horizon = today + HORIZON_DAYS;
  const transfersPerYear = cyclesPerYear(input.transfer.cycle);
  const transfers = occurrencesBetween(input.transfer.cycle, today, horizon);
  const transfer = transferAmount(input);

  const expenses = input.expenses.map((expense): ExpenseLine => {
    const perYear = cyclesPerYear(expense.cycle);
    const perTransfer = (expense.amount * perYear) / transfersPerYear;
    const charges = occurrencesBetween(expense.cycle, today, horizon);
    return {
      id: expense.id,
      name: expense.name,
      account: expense.account,
      amount: expense.amount,
      perTransfer,
      monthly: (expense.amount * perYear) / 12,
      reserved: Math.round(reserveNeeded(charges, transfers, expense.amount, perTransfer)),
      nextDue: nextOccurrence(expense.cycle, today - 1),
    };
  });

  const target = expenses.reduce((total, line) => total + line.reserved, 0);
  if (transfer.amount < transfer.needed) {
    warnings.push(
      `De overboeking is te laag: er is minstens ${(transfer.needed / 100).toFixed(2)} euro per keer nodig.`,
    );
  }

  const overview: Overview = {
    today,
    expenses,
    target,
    transfer: {
      next: nextOccurrence(input.transfer.cycle, today - 1),
      amount: transfer.amount,
      needed: transfer.needed,
    },
    upcoming: movementsBetween(input, today - 1, today + options.window),
    window: options.window,
    nextIncomes: input.incomes
      .map(
        (income): Movement => ({
          day: nextOccurrence(income.cycle, today - 1),
          name: income.name,
          amount: income.amount,
          kind: "income",
        }),
      )
      .sort((a, b) => a.day - b.day),
    monthly: {
      income: input.incomes.reduce(
        (total, income) => total + (income.amount * cyclesPerYear(income.cycle)) / 12,
        0,
      ),
      costs: expenses.reduce((total, line) => total + line.monthly, 0),
      transfer: (transfer.amount * transfersPerYear) / 12,
    },
    warnings,
  };

  if (options.fixed) {
    // The fixed-costs account only moves as planned, so its balance can be
    // projected from the last known value.
    const { amount, date } = options.fixed;
    const since = movementsBetween(input, date, today);
    const expected =
      amount +
      sum(since.filter((m) => m.kind === "transfer")) -
      sum(since.filter((m) => m.kind === "charge" || m.kind === "refund"));
    overview.fixed = { balance: amount, date, expected, difference: expected - target };
  }

  if (options.current) {
    const { amount, date } = options.current;
    const main = input.incomes.find((income) => income.main) ?? input.incomes[0];
    const periodEnd = main ? nextOccurrence(main.cycle, today) : undefined;
    // Refunds are not counted: that money is already spent on its expense.
    const movements = movementsBetween(input, date, periodEnd === undefined ? today : periodEnd - 1);
    const additions = movements.filter((m) => m.kind === "income");
    const deductions = movements.filter((m) => m.kind === "transfer");
    const free = amount + sum(additions) - sum(deductions);
    overview.current = { balance: amount, date, additions, deductions, free };
    if (periodEnd !== undefined) {
      const daysLeft = periodEnd - today;
      Object.assign(overview.current, { periodEnd, daysLeft, perDay: free / daysLeft });
    }
  }

  return overview;
}
