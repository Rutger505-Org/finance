import { client } from "@/server/db";

export const dynamic = "force-dynamic";

export function GET() {
  client.query("SELECT 1").get();
  return Response.json({ status: "ok" });
}
