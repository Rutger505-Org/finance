import { openApiDocument } from "@/server/openapi";

export function GET() {
  return Response.json(openApiDocument());
}
