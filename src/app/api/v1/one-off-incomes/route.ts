import { oneOffIncomeCreate, oneOffIncomeFilter } from "@/lib/finance/schemas";
import { repository, today } from "@/server/finance";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handle(() => {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    return json(repository.listOneOffIncomes(oneOffIncomeFilter.parse(params)));
  });
}

export function POST(request: Request) {
  return handle(async () =>
    json(repository.createOneOffIncome(oneOffIncomeCreate.parse(await readJson(request)), today()), 201),
  );
}
