/**
 * Rank stage: produce the candidate sample per ecosystem.
 *
 * Writes the candidate list to `data/rankings/` (the committed record of who was sampled
 * and why) and seeds the `packages` table with rank and count. Later stages fill in the
 * rest of each row.
 */

import type { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Candidate, EcosystemId } from "../types.ts";
import type { HttpClient } from "../http/client.ts";
import { getAdapter } from "../adapters/index.ts";
import { dataDir } from "../http/cache.ts";
import { ensureSnapshot } from "../db/open.ts";

export interface RankResult {
  ecosystem: EcosystemId;
  count: number;
  path: string;
}

export async function runRank(
  ecosystems: EcosystemId[],
  n: number,
  snapshotId: string,
  db: Database,
  http: HttpClient,
): Promise<RankResult[]> {
  const results: RankResult[] = [];
  const dir = join(dataDir(), "rankings");
  await mkdir(dir, { recursive: true });

  // `rank` is the stage that begins a snapshot, so it owns making the row exist —
  // `packages` has a foreign key onto it.
  ensureSnapshot(db, snapshotId, { n, ecosystems });

  for (const eco of ecosystems) {
    const adapter = getAdapter(eco);
    if (!adapter) {
      console.log(`  [${eco}] no adapter yet — skipping`);
      continue;
    }

    const candidates = await adapter.rank(n, http);
    const path = join(dir, `${eco}_${snapshotId}.json`);
    await Bun.write(
      path,
      JSON.stringify(
        {
          ecosystem: eco,
          snapshot_id: snapshotId,
          rank_frame: adapter.rankFrame,
          requested_n: n,
          returned: candidates.length,
          generated_at: new Date().toISOString(),
          candidates,
        },
        null,
        2,
      ) + "\n",
    );

    persistCandidates(db, snapshotId, candidates);
    results.push({ ecosystem: eco, count: candidates.length, path });
    console.log(`  [${eco}] ranked ${candidates.length} by ${adapter.rankFrame} -> ${path}`);
  }

  return results;
}

function persistCandidates(db: Database, snapshotId: string, candidates: Candidate[]): void {
  const stmt = db.query(
    `INSERT INTO packages
       (snapshot_id, ecosystem, package_name, rank_frame, rank, download_count, dependent_count)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (snapshot_id, ecosystem, package_name) DO UPDATE SET
       rank_frame = excluded.rank_frame,
       rank = excluded.rank,
       download_count = excluded.download_count,
       dependent_count = excluded.dependent_count`,
  );

  // One transaction: a partially-written ranking would misrepresent the sample.
  db.transaction(() => {
    for (const c of candidates) {
      stmt.run(
        snapshotId,
        c.ecosystem,
        c.name,
        c.rankFrame,
        c.rank,
        c.downloadCount,
        c.dependentCount,
      );
    }
  })();
}

/** Reads back the sample for a snapshot, so `fetch` can run as a separate invocation. */
export function loadCandidates(
  db: Database,
  snapshotId: string,
  ecosystem: EcosystemId,
): Candidate[] {
  const rows = db
    .query(
      `SELECT package_name, rank_frame, rank, download_count, dependent_count
         FROM packages
        WHERE snapshot_id = ? AND ecosystem = ?
        ORDER BY rank`,
    )
    .all(snapshotId, ecosystem) as Array<{
    package_name: string;
    rank_frame: "downloads" | "dependents";
    rank: number;
    download_count: number | null;
    dependent_count: number | null;
  }>;

  return rows.map((r) => ({
    ecosystem,
    name: r.package_name,
    rank: r.rank,
    rankFrame: r.rank_frame,
    downloadCount: r.download_count,
    dependentCount: r.dependent_count,
  }));
}
