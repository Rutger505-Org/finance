import { configSchema } from "@/lib/finance/schemas";
import { repository } from "@/server/finance";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(() => json(repository.getConfig()));
}

export function PUT(request: Request) {
  return handle(async () => {
    repository.replaceConfig(configSchema.parse(await readJson(request)));
    return json(repository.getConfig());
  });
}
