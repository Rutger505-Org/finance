import { settingsSchema } from "@/lib/finance/schemas";
import { repository } from "@/server/finance";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(() => json(repository.getSettings()));
}

export function PUT(request: Request) {
  return handle(async () => json(repository.putSettings(settingsSchema.parse(await readJson(request)))));
}
