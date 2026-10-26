import { incomePatch } from "@/lib/finance/schemas";
import { repository } from "@/server/finance";
import { handle, type IdContext, json, noContent, parseId, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

export function GET(_request: Request, { params }: IdContext) {
  return handle(async () => json(repository.getIncome(parseId((await params).id))));
}

export function PATCH(request: Request, { params }: IdContext) {
  return handle(async () => {
    const id = parseId((await params).id);
    return json(repository.updateIncome(id, incomePatch.parse(await readJson(request))));
  });
}

export function DELETE(_request: Request, { params }: IdContext) {
  return handle(async () => {
    repository.deleteIncome(parseId((await params).id));
    return noContent();
  });
}
