/**
 * Fetch stage: pull everything `extract` will need into the cache.
 *
 * The only network-touching stage. Resumability is a property of the cache rather than of
 * bookkeeping here — a warm URL is never re-requested — so an interrupted run is resumed
 * simply by invoking the stage again.
 */

import type { Database } from "bun:sqlite";
import type { EcosystemId } from "../types.ts";
import type { HttpClient } from "../http/client.ts";
import { getAdapter } from "../adapters/index.ts";
import { loadCandidates } from "./rank.ts";

export interface FetchSummary {
  ecosystem: EcosystemId;
  attempted: number;
  succeeded: number;
  failed: number;
}

export async function runFetch(
  ecosystems: EcosystemId[],
  snapshotId: string,
  db: Database,
  http: HttpClient,
): Promise<FetchSummary[]> {
  const summaries: FetchSummary[] = [];

  const recordOk = db.query(
    `UPDATE packages SET fetch_timestamp = ?, fetch_error = NULL
      WHERE snapshot_id = ? AND ecosystem = ? AND package_name = ?`,
  );
  const recordErr = db.query(
    `UPDATE packages SET fetch_timestamp = ?, fetch_error = ?
      WHERE snapshot_id = ? AND ecosystem = ? AND package_name = ?`,
  );

  for (const eco of ecosystems) {
    const adapter = getAdapter(eco);
    if (!adapter) {
      console.log(`  [${eco}] no adapter yet — skipping`);
      continue;
    }

    const candidates = loadCandidates(db, snapshotId, eco);
    if (candidates.length === 0) {
      console.log(`  [${eco}] no candidates for snapshot ${snapshotId} — run \`rank\` first`);
      continue;
    }

    const summary: FetchSummary = { ecosystem: eco, attempted: 0, succeeded: 0, failed: 0 };

    for (const c of candidates) {
      summary.attempted++;
      const now = new Date().toISOString();
      try {
        await adapter.fetch(c, http);
        recordOk.run(now, snapshotId, eco, c.name);
        summary.succeeded++;
      } catch (err) {
        // Recorded rather than thrown: one unreachable package must not abort the run,
        // and the reason has to survive into the dataset instead of becoming a silent gap.
        const message = err instanceof Error ? err.message : String(err);
        recordErr.run(now, message, snapshotId, eco, c.name);
        summary.failed++;
        console.error(`  [${eco}] ${c.name}: ${message}`);
      }
    }

    // Flush per ecosystem so an interrupt cannot lose manifest lines for work already done.
    await http.flush();
    summaries.push(summary);
    console.log(
      `  [${eco}] fetched ${summary.succeeded}/${summary.attempted}` +
        (summary.failed ? ` (${summary.failed} failed)` : ""),
    );
  }

  return summaries;
}
