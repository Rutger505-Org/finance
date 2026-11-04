import { counterpartyCreate } from "@/lib/finance/schemas";
import { repository } from "@/server/finance";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(() => json(repository.listCounterparties()));
}

export function POST(request: Request) {
  return handle(async () => json(repository.createCounterparty(counterpartyCreate.parse(await readJson(request))), 201));
}
