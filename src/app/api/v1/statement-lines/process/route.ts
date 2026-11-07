import { repository } from "@/server/finance";
import { handle, json } from "@/server/http";

export const dynamic = "force-dynamic";

export function POST() {
  return handle(() => json(repository.processStatementLines()));
}
