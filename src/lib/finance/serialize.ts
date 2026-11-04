import { isoDay } from "./dates";
import type { Movement, Overview } from "./plan";

const euros = (cents: number) => Math.round(cents) / 100;

function movement(m: Movement) {
  return { date: isoDay(m.day), name: m.name, amount: euros(m.amount), kind: m.kind };
}

/** The overview as API JSON: ISO dates and euros. */
export function serializeOverview(o: Overview) {
  return {
    date: isoDay(o.today),
    fixed: {
      target: euros(o.target),
      balance: o.fixed
        ? {
            amount: euros(o.fixed.balance),
            date: isoDay(o.fixed.date),
            expected: euros(o.fixed.expected),
            difference: euros(o.fixed.difference),
          }
        : null,
      expenses: o.expenses.map((line) => ({
        id: line.id ?? null,
        name: line.name,
        account: line.account,
        amount: euros(line.amount),
        reserved: euros(line.reserved),
        monthly: euros(line.monthly),
        nextDue: isoDay(line.nextDue),
      })),
    },
    transfers: o.transfers.map((t) => ({
      name: t.name,
      cycle: t.cycle,
      amount: euros(t.amount),
      source: t.source,
      income: t.income ?? null,
      next: isoDay(t.next),
    })),
    current: o.current
      ? {
          balance: euros(o.current.balance),
          date: isoDay(o.current.date),
          periodEnd: o.current.periodEnd === undefined ? null : isoDay(o.current.periodEnd),
          daysLeft: o.current.daysLeft ?? null,
          additions: o.current.additions.map(movement),
          deductions: o.current.deductions.map(movement),
          free: euros(o.current.free),
          perDay: o.current.perDay === undefined ? null : euros(o.current.perDay),
        }
      : null,
    nextIncomes: o.nextIncomes.map(movement),
    upcoming: { days: o.window, movements: o.upcoming.map(movement) },
    monthly: {
      income: euros(o.monthly.income),
      costs: euros(o.monthly.costs),
      transfer: euros(o.monthly.transfer),
      left: euros(o.monthly.income - o.monthly.transfer),
    },
    warnings: o.warnings,
  };
}
