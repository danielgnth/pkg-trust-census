/**
 * Name lists read from deps.dev's BigQuery dataset for npm and Maven Central, whose own complete
 * lists are a feed of every change ever made and a 3.3 GB binary index. npm alone has over 12
 * million names in deps.dev, so the list is not downloaded:
 * BigQuery orders it by a fingerprint of the seed and each name, a deterministic shuffle, and the
 * draw reads pages of that order until it has enough active packages.
 *
 * The pages read are stored with the snapshot's other draw inputs (`data/names/`, git-ignored),
 * never committed: package names are data deps.dev aggregates from the registries, outside its
 * CC-BY 4.0 licence (which covers only the data it generates). The draw record keeps the query, the
 * deps.dev snapshot and the checksum of the names read.
 */

import { createHash } from "node:crypto";
import { join } from "node:path";
import type { Job } from "@google-cloud/bigquery";
import type { EcosystemId } from "../types.ts";
import type { DrawContext, NameList } from "../sample/draw.ts";
import { DATASET, depsdevSnapshot, queryKey, readPage, startQuery, type QueryStats } from "./client.ts";

const SYSTEM: Partial<Record<EcosystemId, string>> = { npm: "NPM", maven: "MAVEN" };

/** Names per page read from the ordered result. */
const PAGE = 5000;

/** Every name, ordered by the seeded fingerprint; ties (a fingerprint collision) by name. */
const SQL = `
SELECT name FROM (
  SELECT DISTINCT Name AS name
  FROM \`${DATASET}.PackageVersions\`
  WHERE SnapshotAt = TIMESTAMP(@snapshot) AND System = @system
)
ORDER BY FARM_FINGERPRINT(CONCAT(@seed, ':', name)), name
`;

interface Stored {
  key: string;
  sql: string;
  params: Record<string, unknown>;
  depsdevSnapshot: string;
  listed: number;
  stats: QueryStats;
  /** The prefix of the ordered list read so far. */
  names: string[];
}

export async function bigqueryNames(ecosystem: EcosystemId, ctx: DrawContext): Promise<NameList> {
  const system = SYSTEM[ecosystem];
  if (!system) throw new Error(`${ecosystem}: no deps.dev name list`);
  const snapshot = await depsdevSnapshot(ctx.snapshotId, ctx.asOf);
  const params = { system, seed: ctx.seed };
  const key = queryKey(SQL, params, snapshot);
  const path = join(ctx.dir, `${ecosystem}-depsdev-order.json`);

  const file = Bun.file(path);
  let stored: Stored | null = (await file.exists()) ? ((await file.json()) as Stored) : null;
  if (stored?.key !== key) stored = null;
  let job: Job | null = null;
  const run = async (): Promise<Job> => {
    // The partition filter (`SnapshotAt` is the table's partitioning column) keeps the scan to one snapshot.
    const started = await startQuery(SQL, { ...params, snapshot });
    job = started.job;
    stored ??= { key, sql: SQL, params, depsdevSnapshot: snapshot, listed: started.totalRows, stats: started.stats, names: [] };
    return started.job;
  };
  if (!stored) await run();
  const state = stored!;

  async function* pages(): AsyncGenerator<string[]> {
    let read = 0;
    while (read < state.listed) {
      if (read >= state.names.length) {
        const rows = await readPage<{ name: string }>(job ?? (await run()), state.names.length, PAGE);
        if (rows.length === 0) return;
        state.names.push(...rows.map((r) => r.name));
        await Bun.write(path, JSON.stringify(state));
      }
      const page = state.names.slice(read, read + PAGE);
      read += page.length;
      yield page;
    }
  }

  return {
    names: [],
    files: [],
    method: `deps.dev BigQuery: every ${system} package name in its snapshot of ${snapshot.slice(0, 10)}, ordered by FARM_FINGERPRINT(seed:name)`,
    ordered: {
      listed: state.listed,
      pages,
      files: () => {
        const text = state.names.join("\n");
        return [
          {
            url: `${DATASET}.PackageVersions, System = ${system}, SnapshotAt = ${snapshot}: first ${state.names.length} of ${state.listed} names in seeded order (${state.stats.bytesProcessed} bytes processed)`,
            sha256: createHash("sha256").update(text, "utf8").digest("hex"),
            bytes: Buffer.byteLength(text, "utf8"),
            fetchedAt: state.stats.ranAt,
          },
        ];
      },
    },
  };
}
