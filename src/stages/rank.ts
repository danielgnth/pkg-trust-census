/**
 * Rank stage: produce the candidate sample per ecosystem, for one sample layer.
 *
 * `top` asks each adapter for its ranking. `random` draws active packages from the registry's
 * full name list (src/sample/draw.ts). Either way the stage writes the candidate list to
 * `data/rankings/` (the record of who was sampled and why) and seeds `packages` and
 * `sample_members`. Later stages fill in the rest of each package row.
 *
 * Re-running the stage on a snapshot keeps every sample it already has with the same size (and, for a
 * draw, the same seed), and continues an interrupted draw from its journal. One registry failing does
 * not stop the others; the stage ends with `RankIncompleteError` naming the ones still to do.
 */

import { and, asc, eq } from "drizzle-orm";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { SAMPLE_LAYERS, type Candidate, type EcosystemId, type SampleLayer } from "../types.ts";
import type { HttpClient } from "../http/client.ts";
import { getAdapter } from "../adapters/index.ts";
import { dataDir } from "../http/cache.ts";
import { ensureSnapshot, snapshotAsOf, type Db } from "../db/open.ts";
import { packages, sampleMembers } from "../db/schema.ts";
import { sampleMemberInsert, validateAll } from "../db/validation.ts";
import { drawActive } from "../sample/draw.ts";
import { getDrawSource } from "../sample/sources.ts";

export interface RankResult {
  ecosystem: EcosystemId;
  layer: SampleLayer;
  count: number;
  path: string;
  /** Kept from an earlier run of the stage on this snapshot, not ranked or drawn again. */
  reused?: boolean;
}

export interface RankOptions {
  layer?: SampleLayer;
  /** Seed of the random draw; defaults to the snapshot id, so a snapshot names its own draw. */
  seed?: string | undefined;
  /** Rank or draw again even where the snapshot already has the sample, discarding draw journals. */
  fresh?: boolean;
}

export interface RankFailure {
  ecosystem: EcosystemId;
  error: string;
}

/** Some registries were ranked, others failed; the failures are re-run on their own later. */
export class RankIncompleteError extends Error {
  constructor(
    readonly results: RankResult[],
    readonly failures: RankFailure[],
  ) {
    super(`ranking incomplete for ${failures.map((f) => f.ecosystem).join(", ")}`);
    this.name = "RankIncompleteError";
  }
}

export function rankingPath(ecosystem: EcosystemId, snapshotId: string, layer: SampleLayer): string {
  return join(dataDir(), "rankings", `${ecosystem}_${snapshotId}${layer === "top" ? "" : `_${layer}`}.json`);
}

/** Where a snapshot's name lists and dumps are stored, with their checksums. */
export function namesDir(snapshotId: string): string {
  return join(dataDir(), "names", snapshotId);
}

/** The draw's journal of activity checks, so an interrupted draw resumes (src/sample/draw.ts). */
export function journalPath(snapshotId: string, ecosystem: EcosystemId): string {
  return join(namesDir(snapshotId), `${ecosystem}-draw.jsonl`);
}

interface StoredRanking {
  layer: SampleLayer;
  requested_n: number;
  returned: number;
  draw?: { seed: string };
  candidates: Candidate[];
}

/** The sample an earlier run of the stage wrote for this layer, if it was made the same way. */
async function storedRanking(path: string, layer: SampleLayer, n: number, seed: string): Promise<Candidate[] | null> {
  const file = Bun.file(path);
  if (!(await file.exists())) return null;
  try {
    const stored = (await file.json()) as StoredRanking;
    if (stored.layer !== layer || stored.requested_n !== n || stored.returned !== stored.candidates.length) return null;
    if (layer === "random" && stored.draw?.seed !== seed) return null;
    return stored.candidates;
  } catch {
    return null;
  }
}

export async function runRank(
  ecosystems: EcosystemId[],
  n: number,
  snapshotId: string,
  db: Db,
  http: HttpClient,
  onProgress?: (message: string) => void,
  opts: RankOptions = {},
): Promise<RankResult[]> {
  const layer = opts.layer ?? "top";
  const results: RankResult[] = [];
  await mkdir(join(dataDir(), "rankings"), { recursive: true });

  // `rank` is the stage that begins a snapshot, so it owns making the row exist —
  // `packages` has a foreign key onto it.
  ensureSnapshot(db, snapshotId, { n, ecosystems });
  const seed = opts.seed ?? snapshotId;
  const ctx = { snapshotId, asOf: snapshotAsOf(db, snapshotId), dir: namesDir(snapshotId), seed };

  const failures: RankFailure[] = [];
  for (const eco of ecosystems) {
    const adapter = getAdapter(eco);
    if (!adapter) {
      onProgress?.(`[${eco}] no adapter yet — skipping`);
      continue;
    }

    const path = rankingPath(eco, snapshotId, layer);
    if (opts.fresh) await rm(journalPath(snapshotId, eco), { force: true });
    const stored = opts.fresh ? null : await storedRanking(path, layer, n, seed);
    if (stored) {
      // Written again in case an interrupted run wrote the file but not the rows.
      persistCandidates(db, snapshotId, eco, layer, stored);
      results.push({ ecosystem: eco, layer, count: stored.length, path, reused: true });
      onProgress?.(`[${eco}] ${layer}: kept the ${stored.length} already in ${path}`);
      continue;
    }

    let candidates: Candidate[];
    let record: Record<string, unknown>;
    try {
      if (layer === "top") {
        candidates = await adapter.rank(n, http);
        record = { rank_frame: adapter.rankFrame };
      } else {
        const source = getDrawSource(eco);
        if (!source) {
          onProgress?.(`[${eco}] no name list for a random draw yet — skipping`);
          continue;
        }
        const drawn = await drawActive(source, n, seed, http, ctx, onProgress, { journal: journalPath(snapshotId, eco) });
        candidates = drawn.candidates;
        record = { rank_frame: "random", draw: drawn.record };
      }
    } catch (err) {
      // One registry rate-limiting or down must not cost the others their sample.
      const error = err instanceof Error ? err.message : String(err);
      failures.push({ ecosystem: eco, error });
      onProgress?.(`[${eco}] ${layer} failed: ${error}`);
      continue;
    }

    await Bun.write(
      path,
      JSON.stringify(
        {
          ecosystem: eco,
          snapshot_id: snapshotId,
          layer,
          ...record,
          requested_n: n,
          returned: candidates.length,
          generated_at: new Date().toISOString(),
          candidates,
        },
        null,
        2,
      ) + "\n",
    );

    persistCandidates(db, snapshotId, eco, layer, candidates);
    results.push({ ecosystem: eco, layer, count: candidates.length, path });
    onProgress?.(`[${eco}] ${layer}: ${candidates.length} -> ${path}`);
  }

  if (failures.length) throw new RankIncompleteError(results, failures);
  return results;
}

function persistCandidates(db: Db, snapshotId: string, ecosystem: EcosystemId, layer: SampleLayer, candidates: Candidate[]): void {
  // Validated before the transaction opens: a bad row is an adapter bug, and it should
  // abort with a message naming the package rather than a bare CHECK violation mid-write.
  const rows = validateAll(
    sampleMemberInsert,
    candidates.map((c) => ({
      snapshotId,
      layer,
      ecosystem: c.ecosystem,
      packageName: c.name,
      rankFrame: c.rankFrame,
      rank: c.rank,
      downloadCount: c.downloadCount,
      dependentCount: c.dependentCount,
    })),
    "sample_members",
  );

  // One transaction, replacing the layer's previous sample: a partially-written or half-old
  // ranking would misrepresent the sample. A package another layer also drew keeps its row.
  db.transaction((tx) => {
    tx.delete(sampleMembers)
      .where(and(eq(sampleMembers.snapshotId, snapshotId), eq(sampleMembers.layer, layer), eq(sampleMembers.ecosystem, ecosystem)))
      .run();
    for (const row of rows) {
      tx.insert(packages).values({ snapshotId, ecosystem, packageName: row.packageName }).onConflictDoNothing().run();
      tx.insert(sampleMembers).values(row).run();
    }
  });
}

/**
 * Reads back the sample for a snapshot, so `fetch` can run as a separate invocation. Without a
 * layer, every package any layer drew, once, as its first layer lists it: `fetch` and `extract`
 * measure a package once however many samples hold it.
 */
export function loadCandidates(db: Db, snapshotId: string, ecosystem: EcosystemId, layer?: SampleLayer): Candidate[] {
  const rows = db
    .select()
    .from(sampleMembers)
    .where(and(eq(sampleMembers.snapshotId, snapshotId), eq(sampleMembers.ecosystem, ecosystem), layer ? eq(sampleMembers.layer, layer) : undefined))
    .orderBy(asc(sampleMembers.rank))
    .all()
    .sort((a, b) => SAMPLE_LAYERS.indexOf(a.layer as SampleLayer) - SAMPLE_LAYERS.indexOf(b.layer as SampleLayer));

  const seen = new Set<string>();
  return rows
    .filter((r) => !seen.has(r.packageName) && seen.add(r.packageName))
    .map((r) => ({
      ecosystem,
      name: r.packageName,
      layer: r.layer as SampleLayer,
      rank: r.rank,
      rankFrame: r.rankFrame as Candidate["rankFrame"],
      downloadCount: r.downloadCount,
      dependentCount: r.dependentCount,
    }));
}

/** The layers a snapshot holds, in `SAMPLE_LAYERS` order. */
export function snapshotLayers(db: Db, snapshotId: string): SampleLayer[] {
  const present = new Set(
    db.selectDistinct({ layer: sampleMembers.layer }).from(sampleMembers).where(eq(sampleMembers.snapshotId, snapshotId)).all().map((r) => r.layer),
  );
  return SAMPLE_LAYERS.filter((l) => present.has(l));
}

/** "{ecosystem}/{package}" of every package in one layer: the filter every per-layer number goes through. */
export function layerMembers(db: Db, snapshotId: string, layer: SampleLayer): Set<string> {
  return new Set(
    db
      .select({ ecosystem: sampleMembers.ecosystem, name: sampleMembers.packageName })
      .from(sampleMembers)
      .where(and(eq(sampleMembers.snapshotId, snapshotId), eq(sampleMembers.layer, layer)))
      .all()
      .map((r) => `${r.ecosystem}/${r.name}`),
  );
}
