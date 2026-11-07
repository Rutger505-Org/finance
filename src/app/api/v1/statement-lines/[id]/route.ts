import { statementLinePatch } from "@/lib/finance/schemas";
import { repository } from "@/server/finance";
import { handle, type IdContext, json, parseId, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

export function GET(_request: Request, { params }: IdContext) {
  return handle(async () => json(repository.getStatementLine(parseId((await params).id))));
}

export function PATCH(request: Request, { params }: IdContext) {
  return handle(async () => {
    const id = parseId((await params).id);
    return json(repository.patchStatementLine(id, statementLinePatch.parse(await readJson(request))));
  });
}
