import { statementImport } from "@/lib/finance/schemas";
import { repository } from "@/server/finance";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

/** JSON { account, text }, or the raw export as text/plain with ?account=. */
export function POST(request: Request) {
  return handle(async () => {
    const plain = request.headers.get("content-type")?.startsWith("text/plain");
    const input = plain
      ? { account: new URL(request.url).searchParams.get("account"), text: await request.text() }
      : await readJson(request);
    return json(repository.importStatement(statementImport.parse(input)), 201);
  });
}
