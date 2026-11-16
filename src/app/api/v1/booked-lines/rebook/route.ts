import { rebook } from "@/lib/finance/schemas";
import { repository, today } from "@/server/finance";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

/** Booked lines get a new booking, atomically; returns the created spending, one-off income or savings transfer (null for a plan item). */
export function POST(request: Request) {
  return handle(async () =>
    json(
      repository.rebook(rebook.parse(await readJson(request)), today()),
      201,
    ),
  );
}
