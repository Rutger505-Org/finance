import { readFileSync } from "node:fs";
import { join } from "node:path";

// Is this build behind main on GitHub? Only for images built with compose.yaml: it hands the
// .git directory to the Dockerfile, which writes the commit to commit.txt. Without that file
// (dev server, CI production image, which deploys every push anyway) there is nothing to compare.

const REPO = "Rutger505-Org/finance";
const TTL_MS = 60 * 60 * 1000;
const ERROR_TTL_MS = 5 * 60 * 1000;

export type UpdateStatus = {
  built: string | null;
  /** Commits on main that this build doesn't have. */
  behindBy: number;
  error: string | null;
};

function readBuiltCommit(): string | null {
  try {
    return (
      readFileSync(join(process.cwd(), "commit.txt"), "utf8").trim() || null
    );
  } catch {
    return null;
  }
}

const built = readBuiltCommit();
let cached: { status: UpdateStatus; until: number } | null = null;
let pending: Promise<UpdateStatus> | null = null;

async function check(): Promise<UpdateStatus> {
  if (!built) return { built, behindBy: 0, error: null };
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/compare/${built}...main`,
      {
        headers: { accept: "application/vnd.github+json" },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok)
      throw new Error(
        `GitHub compare ${built.slice(0, 7)}...main: ${res.status} ${await res.text()}`,
      );
    const body = (await res.json()) as { ahead_by: number };
    return { built, behindBy: body.ahead_by, error: null };
  } catch (error) {
    // Offline laptop or rate limit: no banner, just the log.
    console.error("update check:", error);
    return {
      built,
      behindBy: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function updateStatus(): Promise<UpdateStatus> {
  if (cached && Date.now() < cached.until) return cached.status;
  pending ??= check().finally(() => (pending = null));
  const status = await pending;
  cached = {
    status,
    until: Date.now() + (status.error ? ERROR_TTL_MS : TTL_MS),
  };
  return status;
}
