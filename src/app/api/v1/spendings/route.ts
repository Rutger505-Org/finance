import { spendingCreate, spendingFilter } from "@/lib/finance/schemas";
import { repository, today } from "@/server/finance";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handle(() => {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    return json(repository.listSpendings(spendingFilter.parse(params)));
  });
}

export function POST(request: Request) {
  return handle(async () =>
    json(repository.createSpending(spendingCreate.parse(await readJson(request)), today()), 201),
  );
}
