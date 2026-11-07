import { bookedLineFilter } from "@/lib/finance/schemas";
import { repository } from "@/server/finance";
import { handle, HttpError, json, noContent } from "@/server/http";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handle(() => {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    return json(repository.listBookedLines(bookedLineFilter.parse(params)));
  });
}

/** `?key=`: keys contain spaces and slashes, so not a path segment. */
export function DELETE(request: Request) {
  return handle(() => {
    const key = new URL(request.url).searchParams.get("key");
    if (!key) throw new HttpError(400, "key is required");
    repository.deleteBookedLine(key);
    return noContent();
  });
}
