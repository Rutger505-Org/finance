import "server-only";

import { env } from "@/env";
import { todayIn } from "@/lib/finance/dates";
import { db } from "@/server/db";
import { createRepository } from "./repository";

export const repository = createRepository(db);

export function today() {
  return todayIn(env.TIME_ZONE);
}
