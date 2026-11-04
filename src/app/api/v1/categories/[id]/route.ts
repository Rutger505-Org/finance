import { categoryCreate } from "@/lib/finance/schemas";
import { repository } from "@/server/finance";
import { handle, type IdContext, json, noContent, parseId, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

export function PATCH(request: Request, { params }: IdContext) {
  return handle(async () => {
    const id = parseId((await params).id);
    return json(repository.renameCategory(id, categoryCreate.parse(await readJson(request))));
  });
}

export function DELETE(_request: Request, { params }: IdContext) {
  return handle(async () => {
    repository.deleteCategory(parseId((await params).id));
    return noContent();
  });
}
