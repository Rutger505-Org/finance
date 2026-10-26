import { parseDay } from "@/lib/finance/dates";
import { isoDate } from "@/lib/finance/schemas";
import { serializeOverview } from "@/lib/finance/serialize";
import { repository, today } from "@/server/finance";
import { handle, json } from "@/server/http";
import { z } from "zod";

export const dynamic = "force-dynamic";

const query = z.object({
  date: isoDate.optional(),
  days: z.coerce.number().int().min(0).max(366).optional(),
});

export function GET(request: Request) {
  return handle(() => {
    const params = new URL(request.url).searchParams;
    const { date, days } = query.parse({
      date: params.get("date") ?? undefined,
      days: params.get("days") ?? undefined,
    });
    const overview = repository.overview(date ? parseDay(date) : today(), days ?? 31);
    return json(serializeOverview(overview));
  });
}
