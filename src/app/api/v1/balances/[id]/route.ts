import { repository } from "@/server/finance";
import { handle, type IdContext, noContent, parseId } from "@/server/http";

export const dynamic = "force-dynamic";

export function DELETE(_request: Request, { params }: IdContext) {
  return handle(async () => {
    repository.deleteBalance(parseId((await params).id));
    return noContent();
  });
}
