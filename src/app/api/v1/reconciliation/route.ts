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

const euros = (cents: number | null) => (cents === null ? null : cents / 100);

/** Checkpoints compared with what they should have been, and the expected balance per day. */
export function GET(request: Request) {
  return handle(() => {
    const params = new URL(request.url).searchParams;
    const input = query.parse(Object.fromEntries(params));
    if ((input.account === "savings") !== (input.savingsAccountId !== undefined)) {
      throw new HttpError(400, "savingsAccountId is required for, and only for, account savings");
    }
    const until = input.to ? parseDay(input.to) : today();
    const from = input.from ? parseDay(input.from) : until - 30;
    if (from > until || until - from > 3660) throw new HttpError(400, "from must be before to, at most 10 years apart");
    const result = repository.reconcile(input.account, input.savingsAccountId ?? null, from, until);
    return json({
      expected: euros(result.expected),
      checkpoints: result.checkpoints.map((c) => ({
        id: c.id,
        date: isoDay(c.day),
        time: c.time,
        amount: euros(c.amount),
        expected: euros(c.expected),
        difference: euros(c.difference),
      })),
      since: result.since.map((c) => ({ date: isoDay(c.day), time: c.time, name: c.name, amount: euros(c.amount), kind: c.kind })),
      days: result.days.map((d) => ({ date: isoDay(d.day), balance: euros(d.balance) })),
    });
  });
}
