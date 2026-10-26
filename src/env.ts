import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_SQLITE_PATH: z.string().optional().default("./data/db.sqlite"),
    /** "Today" is this time zone's calendar day. */
    TIME_ZONE: z.string().optional().default("Europe/Amsterdam"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .optional()
      .default("development"),
  },
  client: {},
  experimental__runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
