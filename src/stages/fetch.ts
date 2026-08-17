/**
 * Fetch stage: pull everything `extract` will need into the cache.
 *
 * The only network-touching stage. Resumability is a property of the cache rather than of
 * bookkeeping here — a warm URL is never re-requested — so an interrupted run is resumed
 * simply by invoking the stage again.
 */

import { and, eq } from "drizzle-orm";
import type { EcosystemId } from "../types.ts";
import type { HttpClient } from "../http/client.ts";
import { getAdapter } from "../adapters/index.ts";
import type { Db } from "../db/open.ts";
import { packages } from "../db/schema.ts";
import { loadCandidates } from "./rank.ts";

export interface FetchSummary {
  ecosystem: EcosystemId;
  attempted: number;
  succeeded: number;
  failed: number;
}

export interface FetchProgress {
  ecosystem: EcosystemId;
  index: number;
  total: number;
  package: string;
  error?: string;
}

export async function runFetch(
  ecosystems: EcosystemId[],
  snapshotId: string,
  db: Db,
  http: HttpClient,
  onProgress?: (p: FetchProgress) => void,
): Promise<FetchSummary[]> {
  const summaries: FetchSummary[] = [];

  for (const eco of ecosystems) {
    const adapter = getAdapter(eco);
    if (!adapter) continue;

    const candidates = loadCandidates(db, snapshotId, eco);
    if (candidates.length === 0) continue;

    const summary: FetchSummary = { ecosystem: eco, attempted: 0, succeeded: 0, failed: 0 };

    for (const [i, c] of candidates.entries()) {
      summary.attempted++;
      const now = new Date().toISOString();
      const where = and(
        eq(packages.snapshotId, snapshotId),
        eq(packages.ecosystem, eco),
        eq(packages.packageName, c.name),
      );

      try {
        await adapter.fetch(c, http);
        db.update(packages).set({ fetchTimestamp: now, fetchError: null }).where(where).run();
        summary.succeeded++;
        onProgress?.({ ecosystem: eco, index: i + 1, total: candidates.length, package: c.name });
      } catch (err) {
        // Recorded rather than thrown: one unreachable package must not abort the run,
        // and the reason has to survive into the dataset instead of becoming a silent gap.
        const message = err instanceof Error ? err.message : String(err);
        db.update(packages).set({ fetchTimestamp: now, fetchError: message }).where(where).run();
        summary.failed++;
        onProgress?.({
          ecosystem: eco,
          index: i + 1,
          total: candidates.length,
          package: c.name,
          error: message,
        });
      }
    }

    // Flush per ecosystem so an interrupt cannot lose manifest lines for work already done.
    await http.flush();
    summaries.push(summary);
  }

  return summaries;
}
