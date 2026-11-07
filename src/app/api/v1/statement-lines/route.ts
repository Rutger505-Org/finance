import { statementLineFilter } from "@/lib/finance/schemas";
import { repository } from "@/server/finance";
import { handle, json } from "@/server/http";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handle(() => {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    return json(repository.listStatementLines(statementLineFilter.parse(params)));
  });
}
