import { accountSchema, balanceCreate } from "@/lib/finance/schemas";
import { repository, today } from "@/server/finance";
import { handle, json, readJson } from "@/server/http";
import { z } from "zod";

export const dynamic = "force-dynamic";

const query = z.object({
  account: accountSchema.optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

export function GET(request: Request) {
  return handle(() => {
    const params = new URL(request.url).searchParams;
    const filter = query.parse({
      account: params.get("account") ?? undefined,
      limit: params.get("limit") ?? undefined,
    });
    return json(repository.listBalances(filter));
  });
}

export function POST(request: Request) {
  return handle(async () =>
    json(repository.createBalance(balanceCreate.parse(await readJson(request)), today()), 201),
  );
}
