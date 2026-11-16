import { convertToSavings } from "@/lib/finance/schemas";
import { repository } from "@/server/finance";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

/** A skipped line (own-account transfer) becomes a savings transfer without un-booking it. */
export function POST(request: Request) {
  return handle(async () => json(repository.convertToSavings(convertToSavings.parse(await readJson(request))), 201));
}
