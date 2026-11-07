import { statementLineSpending } from "@/lib/finance/schemas";
import { repository, today } from "@/server/finance";
import { handle, type IdContext, json, parseId, readOptionalJson } from "@/server/http";

export const dynamic = "force-dynamic";

/** Body may be empty: everything then comes from the line. */
export function POST(request: Request, { params }: IdContext) {
  return handle(async () => {
    const id = parseId((await params).id);
    const input = statementLineSpending.parse(await readOptionalJson(request));
    return json(repository.statementLineToSpending(id, input, today()), 201);
  });
}
