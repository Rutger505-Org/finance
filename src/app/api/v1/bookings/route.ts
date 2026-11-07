import { bookings } from "@/lib/finance/schemas";
import { repository, today } from "@/server/finance";
import { handle, json, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handle(async () => json(repository.book(bookings.parse(await readJson(request)), today()), 201));
}
