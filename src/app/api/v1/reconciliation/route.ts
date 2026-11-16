import type { Change } from "@/lib/finance/balances";
import { isoDay, parseDay } from "@/lib/finance/dates";
import { balanceAccountSchema, isoDate } from "@/lib/finance/schemas";
import { repository, today } from "@/server/finance";
import { handle, HttpError, json } from "@/server/http";
import { z } from "zod";

export const dynamic = "force-dynamic";

const query = z.object({
  account: balanceAccountSchema,
  savingsAccountId: z.coerce.number().int().positive().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

const euros = <T extends number | null>(cents: T) =>
  (cents === null ? null : cents / 100) as T;

/** `planned`: a planned occurrence without a linked bank line; `plan`: what a linked line's occurrence was planned as. */
const change = (c: Change) => ({
  date: isoDay(c.day),
  time: c.time,
  name: c.name,
  amount: euros(c.amount),
  kind: c.kind,
  planned: c.planned ?? false,
  plan: c.plan
    ? {
        date: isoDay(c.plan.day),
        amount: euros(c.plan.amount),
        real: euros(c.plan.real),
      }
    : null,
});

/** Checkpoints compared with what they should have been, and the expected balance per day. */
export function GET(request: Request) {
  return handle(() => {
    const params = new URL(request.url).searchParams;
    const input = query.parse(Object.fromEntries(params));
    if ((input.account === "savings") !== (input.savingsAccountId !== undefined)) {
      throw new HttpError(400, "savingsAccountId is required for, and only for, account savings");
    }
    const now = today();
    const until = input.to ? parseDay(input.to) : now;
    const from = input.from ? parseDay(input.from) : until - 30;
    if (from > until || until - from > 3660) throw new HttpError(400, "from must be before to, at most 10 years apart");
    const result = repository.reconcile(input.account, input.savingsAccountId ?? null, from, until, now);
    return json({
      expected: euros(result.expected),
      checkpoints: result.checkpoints.map((c) => ({
        id: c.id,
        date: isoDay(c.day),
        time: c.time,
        amount: euros(c.amount),
        expected: euros(c.expected),
        difference: euros(c.difference),
        changes: c.changes.map(change),
      })),
      since: result.since.map(change),
      skippedLines:
        input.account === "savings" ? 0 : repository.countSkippedLines(),
      days: result.days.map((d) => ({
        date: isoDay(d.day),
        balance: euros(d.balance),
      })),
    });
  });
}
