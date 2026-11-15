import { summarizeAccount } from "@/lib/finance/savings";
import { savingsAccountCreate } from "@/lib/finance/schemas";
import { repository, today } from "@/server/finance";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(() =>
    json(repository.listSavingsAccounts().map((account) => ({ ...account, summary: summarizeAccount(account, today()) }))),
  );
}

export function POST(request: Request) {
  return handle(async () =>
    json(repository.createSavingsAccount(savingsAccountCreate.parse(await readJson(request)), today()), 201),
  );
}
