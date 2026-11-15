import { summarizeAccount } from "@/lib/finance/savings";
import { savingsAccountPatch } from "@/lib/finance/schemas";
import { repository, today } from "@/server/finance";
import { handle, type IdContext, json, noContent, parseId, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

export function GET(_request: Request, { params }: IdContext) {
  return handle(async () => {
    const account = repository.getSavingsAccount(parseId((await params).id));
    return json({ ...account, summary: summarizeAccount(account, today()) });
  });
}

export function PATCH(request: Request, { params }: IdContext) {
  return handle(async () => {
    const id = parseId((await params).id);
    return json(repository.updateSavingsAccount(id, savingsAccountPatch.parse(await readJson(request))));
  });
}

export function DELETE(_request: Request, { params }: IdContext) {
  return handle(async () => {
    repository.deleteSavingsAccount(parseId((await params).id));
    return noContent();
  });
}
