import { updateStatus } from "@/server/update";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await updateStatus(), {
    headers: { "cache-control": "no-store" },
  });
}
