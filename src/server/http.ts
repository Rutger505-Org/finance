import { formatIssues } from "@/lib/finance/schemas";
import { HttpError } from "@/server/http-error";
import { ZodError } from "zod";

export { HttpError };

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

/** Turns thrown errors into JSON error responses. */
export async function handle(fn: () => Response | Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ZodError) {
      return json({ error: "Invalid input", issues: formatIssues(error) }, 400);
    }
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error(error);
    return json({ error: "Internal server error" }, 500);
  }
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    throw new HttpError(400, "Request body is not valid JSON");
  }
}

export function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) throw new HttpError(400, `Invalid id "${raw}"`);
  return id;
}

export type IdContext = { params: Promise<{ id: string }> };
