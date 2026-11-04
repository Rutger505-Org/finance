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

export interface PlanTransfer {
  name: string;
  cycle: Cycle;
  /** Cents, "auto", or the whole amount of the income with that id. */
  amount: number | "auto" | { income: number };
}

export interface PlanInput {
  incomes: PlanIncome[];
  expenses: PlanExpense[];
  transfers: PlanTransfer[];
}

export interface TransferLine {
  name: string;
  cycle: Cycle;
  /** Per transfer, resolved. */
  amount: number;
  source: "auto" | "fixed" | "income";
  /** Name of the linked income. */
  income?: string;
  next: Day;
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
  /** Sorted by next date. */
  transfers: TransferLine[];
  upcoming: Movement[];
  window: number;
  nextIncomes: Movement[];
  /** Average per month; `costs` is what the transfers must cover. */
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
  transfers: { day: Day; share: number }[],
  amount: number,
): number {
  const events = [
    ...charges.map((day) => ({ day, delta: amount, order: 0 })),
    ...transfers.map(({ day, share }) => ({ day, delta: -share, order: 1 })),
  ].sort((a, b) => a.day - b.day || a.order - b.order);

  let balance = 0;
  let needed = 0;
  for (const event of events) {
    balance += event.delta;
    needed = Math.max(needed, balance);
  }
  return needed;
}

const perYear = (amount: number, cycle: Cycle) => amount * cyclesPerYear(cycle);

/** What the transfers must cover per year: every active expense. */
export function neededPerYear(input: Pick<PlanInput, "expenses">): number {
  return input.expenses.reduce((total, expense) => total + perYear(expense.amount, expense.cycle), 0);
}

/**
 * The amount of every transfer. Fixed amounts and linked incomes count first;
 * the auto transfers split what is left of the yearly need, the same amount
 * per transfer, rounded up to whole euros. A linked income that is missing or
 * inactive gives 0.
 */
export function resolveTransfers(input: PlanInput, today: Day): TransferLine[] {
  const incomes = new Map(input.incomes.flatMap((income) => (income.id === undefined ? [] : [[income.id, income]])));
  const lines = input.transfers.map((transfer): TransferLine => {
    const next = nextOccurrence(transfer.cycle, today - 1);
    const base = { name: transfer.name, cycle: transfer.cycle, next };
    if (transfer.amount === "auto") return { ...base, amount: 0, source: "auto" };
    if (typeof transfer.amount === "number") return { ...base, amount: transfer.amount, source: "fixed" };
    const income = incomes.get(transfer.amount.income);
    return { ...base, amount: income?.amount ?? 0, source: "income", income: income?.name };
  });

  const covered = lines.reduce((total, line) => total + perYear(line.amount, line.cycle), 0);
  const autos = lines.filter((line) => line.source === "auto");
  const autoPerYear = autos.reduce((total, line) => total + cyclesPerYear(line.cycle), 0);
  const rest = Math.max(0, neededPerYear(input) - covered);
  const auto = autoPerYear > 0 ? Math.ceil(rest / autoPerYear / 100) * 100 : 0;
  for (const line of autos) line.amount = auto;
  return lines;
}

/** Every planned movement in (after, until], sorted by day. */
export function movementsBetween(input: PlanInput, after: Day, until: Day): Movement[] {
  const transfers = resolveTransfers(input, after + 1).filter((transfer) => transfer.amount > 0);
  const movements: Movement[] = [
    ...input.incomes.flatMap((income) =>
      occurrencesBetween(income.cycle, after, until).map(
        (day): Movement => ({ day, name: income.name, amount: income.amount, kind: "income" }),
      ),
    ),
    ...transfers.flatMap((transfer) =>
      occurrencesBetween(transfer.cycle, after, until).map(
        (day): Movement => ({ day, name: transfer.name, amount: transfer.amount, kind: "transfer" }),
      ),
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
  const transfers = resolveTransfers(input, today);
  const transferredPerYear = transfers.reduce((total, t) => total + perYear(t.amount, t.cycle), 0);
  const needed = neededPerYear(input);
  // Every transfer carries the same fraction of each expense as of all
  // transferred money; anything above the need is buffer.
  const share = (amount: number) => (transferredPerYear > 0 ? amount / transferredPerYear : 0);
  const transferDays = transfers.flatMap((t) =>
    occurrencesBetween(t.cycle, today, horizon).map((day) => ({ day, fraction: share(t.amount) })),
  );

  const expenses = input.expenses.map((expense): ExpenseLine => {
    const yearly = perYear(expense.amount, expense.cycle);
    const charges = occurrencesBetween(expense.cycle, today, horizon);
    const shares = transferDays.map(({ day, fraction }) => ({ day, share: yearly * fraction }));
    return {
      id: expense.id,
      name: expense.name,
      account: expense.account,
      amount: expense.amount,
      monthly: yearly / 12,
      reserved: Math.round(reserveNeeded(charges, shares, expense.amount)),
      nextDue: nextOccurrence(expense.cycle, today - 1),
    };
  });

  const target = expenses.reduce((total, line) => total + line.reserved, 0);
  // 1 cent per year of slack for rounding.
  if (transferredPerYear + 1 < needed) {
    warnings.push(
      `De overboekingen zijn te laag: er is gemiddeld ${(needed / 1200).toFixed(2)} euro per maand nodig, je boekt ${(transferredPerYear / 1200).toFixed(2)} euro over.`,
    );
  }
  for (const transfer of transfers) {
    if (transfer.source === "income" && transfer.income === undefined) {
      warnings.push(`Overboeking "${transfer.name}" hangt aan een inkomen dat niet (meer) actief is, dus 0 euro.`);
    }
  }

  const overview: Overview = {
    today,
    expenses,
    target,
    transfers: [...transfers].sort((a, b) => a.next - b.next || a.name.localeCompare(b.name)),
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
      transfer: transferredPerYear / 12,
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
