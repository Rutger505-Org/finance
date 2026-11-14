import { summarizeSavings } from "@/lib/finance/savings";
import { savingsSchema, type Savings } from "@/lib/finance/schemas";
import { repository, today } from "@/server/finance";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

const body = (plan: Savings | null) => ({ plan, summary: plan && summarizeSavings(plan, today()) });

export function GET() {
  return handle(() => json(body(repository.getSavings())));
}

export function PUT(request: Request) {
  return handle(async () => json(body(repository.putSavings(savingsSchema.parse(await readJson(request))))));
}
