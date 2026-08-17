/**
 * Rank stage: produce the candidate sample per ecosystem.
 *
 * Writes the candidate list to `data/rankings/` (the committed record of who was sampled
 * and why) and seeds the `packages` table with rank and count. Later stages fill in the
 * rest of each row.
 */

import { and, asc, eq } from "drizzle-orm";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Candidate, EcosystemId } from "../types.ts";
import type { HttpClient } from "../http/client.ts";
import { getAdapter } from "../adapters/index.ts";
import { dataDir } from "../http/cache.ts";
import { ensureSnapshot, type Db } from "../db/open.ts";
import { packages } from "../db/schema.ts";
import { packageInsert, validateAll } from "../db/validation.ts";

export interface RankResult {
  ecosystem: EcosystemId;
  count: number;
  path: string;
}

export async function runRank(
  ecosystems: EcosystemId[],
  n: number,
  snapshotId: string,
  db: Db,
  http: HttpClient,
  onProgress?: (message: string) => void,
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
      onProgress?.(`[${eco}] no adapter yet — skipping`);
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
    onProgress?.(`[${eco}] ranked ${candidates.length} by ${adapter.rankFrame} -> ${path}`);
  }

  return results;
}

function persistCandidates(db: Db, snapshotId: string, candidates: Candidate[]): void {
  // Validated before the transaction opens: a bad row is an adapter bug, and it should
  // abort with a message naming the package rather than a bare CHECK violation mid-write.
  const rows = validateAll(
    packageInsert,
    candidates.map((c) => ({
      snapshotId,
      ecosystem: c.ecosystem,
      packageName: c.name,
      rankFrame: c.rankFrame,
      rank: c.rank,
      downloadCount: c.downloadCount,
      dependentCount: c.dependentCount,
    })),
    "packages",
  );

  // One transaction: a partially-written ranking would misrepresent the sample.
  db.transaction((tx) => {
    for (const row of rows) {
      tx.insert(packages)
        .values(row)
        .onConflictDoUpdate({
          target: [packages.snapshotId, packages.ecosystem, packages.packageName],
          set: {
            rankFrame: row.rankFrame,
            rank: row.rank,
            downloadCount: row.downloadCount ?? null,
            dependentCount: row.dependentCount ?? null,
          },
        })
        .run();
    }
  });
}

/** Reads back the sample for a snapshot, so `fetch` can run as a separate invocation. */
export function loadCandidates(
  db: Db,
  snapshotId: string,
  ecosystem: EcosystemId,
): Candidate[] {
  const rows = db
    .select({
      name: packages.packageName,
      rankFrame: packages.rankFrame,
      rank: packages.rank,
      downloadCount: packages.downloadCount,
      dependentCount: packages.dependentCount,
    })
    .from(packages)
    .where(and(eq(packages.snapshotId, snapshotId), eq(packages.ecosystem, ecosystem)))
    .orderBy(asc(packages.rank))
    .all();

  return rows.map((r) => ({
    ecosystem,
    name: r.name,
    rank: r.rank,
    rankFrame: r.rankFrame as Candidate["rankFrame"],
    downloadCount: r.downloadCount,
    dependentCount: r.dependentCount,
  }));
}
