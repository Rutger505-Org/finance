import { spendingPatch } from "@/lib/finance/schemas";
import { repository } from "@/server/finance";
import { handle, type IdContext, json, noContent, parseId, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

export function GET(_request: Request, { params }: IdContext) {
  return handle(async () => json(repository.getSpending(parseId((await params).id))));
}

export function PATCH(request: Request, { params }: IdContext) {
  return handle(async () => {
    const id = parseId((await params).id);
    return json(repository.updateSpending(id, spendingPatch.parse(await readJson(request))));
  });
}

export function DELETE(_request: Request, { params }: IdContext) {
  return handle(async () => {
    repository.deleteSpending(parseId((await params).id));
    return noContent();
  });
}
