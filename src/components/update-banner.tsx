"use client";

import type { UpdateStatus } from "@/server/update";
import { useEffect, useState } from "react";

/** Docker Compose install behind main (src/server/update.ts): tells how to update. */
export function UpdateBanner() {
  const [behindBy, setBehindBy] = useState(0);

  useEffect(() => {
    fetch("/api/update", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<UpdateStatus>) : null))
      .then((status) => setBehindBy(status?.behindBy ?? 0))
      .catch(() => setBehindBy(0));
  }, []);

  if (behindBy <= 0) return null;
  return (
    <div className="border-b border-amber-200 bg-amber-50 text-sm text-amber-900">
      <p className="mx-auto max-w-5xl px-4 py-2">
        Nieuwe versie beschikbaar ({behindBy}{" "}
        {behindBy === 1 ? "commit" : "commits"} achter). Updaten:{" "}
        <code className="font-mono">
          git pull && docker compose up -d --build
        </code>
      </p>
    </div>
  );
}
