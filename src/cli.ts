#!/usr/bin/env bun
/**
 * Stage runner. Every stage is independently re-runnable and keyed by snapshot id, so an
 * interrupted run resumes from the cache and `extract` can be re-run offline as parsers
 * are refined.
 *
 *   bun run src/cli.ts rank    --ecosystem pypi --n 50
 *   bun run src/cli.ts fetch   --ecosystem pypi --snapshot 20260817-1430Z
 *   bun run src/cli.ts extract --ecosystem pypi --snapshot 20260817-1430Z
 *   bun run src/cli.ts status
 */

import type { Database } from "bun:sqlite";
import { ECOSYSTEMS, type EcosystemId } from "./types.ts";
import { dbPath, ensureSnapshot, newSnapshotId, openDb } from "./db/open.ts";
import { HttpClient, TOOL_VERSION, USER_AGENT } from "./http/client.ts";
import { runRank } from "./stages/rank.ts";
import { runFetch } from "./stages/fetch.ts";

const STAGES = ["rank", "fetch", "extract", "aggregate", "report", "status"] as const;
type Stage = (typeof STAGES)[number];

interface Args {
  stage: Stage;
  ecosystems: EcosystemId[];
  n: number;
  snapshot: string | null;
  force: boolean;
}

function parseArgs(argv: string[]): Args {
  const [stage, ...rest] = argv;
  if (!stage || !STAGES.includes(stage as Stage)) {
    throw new Error(`usage: bun run src/cli.ts <${STAGES.join("|")}> [options]`);
  }

  const flags = new Map<string, string>();
  let force = false;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--force") {
      force = true;
      continue;
    }
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = rest[i + 1];
      if (val === undefined || val.startsWith("--")) throw new Error(`missing value for --${key}`);
      flags.set(key, val);
      i++;
    }
  }

  const ecoArg = flags.get("ecosystem") ?? "all";
  const ecosystems =
    ecoArg === "all"
      ? [...ECOSYSTEMS]
      : ecoArg.split(",").map((e) => {
          if (!ECOSYSTEMS.includes(e as EcosystemId)) {
            throw new Error(`unknown ecosystem "${e}" (known: ${ECOSYSTEMS.join(", ")})`);
          }
          return e as EcosystemId;
        });

  const n = Number(flags.get("n") ?? 50);
  if (!Number.isInteger(n) || n < 1) throw new Error(`--n must be a positive integer`);

  return { stage: stage as Stage, ecosystems, n, snapshot: flags.get("snapshot") ?? null, force };
}

async function main(): Promise<void> {
  const args = parseArgs(Bun.argv.slice(2));

  if (args.stage === "status") {
    await status();
    return;
  }

  const db = openDb();
  // Only `rank` starts a new snapshot. Later stages default to continuing the most recent
  // one, so `rank` then `fetch` works without having to copy an id between invocations.
  const snapshotId = args.snapshot ?? (args.stage === "rank" ? newSnapshotId() : latestSnapshot(db));
  if (!snapshotId) throw new Error(`no snapshot found — run \`rank\` first, or pass --snapshot`);
  ensureSnapshot(db, snapshotId, { n: args.n, ecosystems: args.ecosystems }, TOOL_VERSION);

  console.log(`snapshot ${snapshotId} | stage ${args.stage} | ${args.ecosystems.join(", ")} | n=${args.n}`);
  console.log(`UA: ${USER_AGENT}`);

  const http = new HttpClient();
  await http.cache.load();
  console.log(`transport: ${http.transport.name}`);

  switch (args.stage) {
    case "rank":
      await runRank(args.ecosystems, args.n, snapshotId, db, http);
      break;
    case "fetch":
      await runFetch(args.ecosystems, snapshotId, db, http);
      break;
    case "extract":
    case "aggregate":
    case "report":
      console.log(`  stage "${args.stage}" lands in M3`);
      break;
  }

  await http.flush();
  db.query(`UPDATE snapshots SET finished_at = ? WHERE snapshot_id = ?`).run(
    new Date().toISOString(),
    snapshotId,
  );
  console.log(
    `done | fetched=${http.stats.fetched} cacheHits=${http.stats.cacheHits} ` +
      `retries=${http.stats.retries} errors=${http.stats.errors}`,
  );
  db.close();
}

function latestSnapshot(db: Database): string | null {
  const row = db
    .query(`SELECT snapshot_id FROM snapshots ORDER BY started_at DESC LIMIT 1`)
    .get() as { snapshot_id: string } | null;
  return row?.snapshot_id ?? null;
}

async function status(): Promise<void> {
  const db = openDb();
  const snaps = db.query(`SELECT snapshot_id, started_at, finished_at FROM snapshots ORDER BY snapshot_id`).all();
  const pkgs = db.query(`SELECT ecosystem, COUNT(*) AS n FROM packages GROUP BY ecosystem`).all();
  const http = new HttpClient();
  await http.cache.load();

  console.log(`db: ${dbPath()}`);
  console.log(`snapshots: ${snaps.length}`);
  for (const s of snaps as Array<Record<string, string>>) {
    console.log(`  ${s.snapshot_id}  started=${s.started_at}  finished=${s.finished_at ?? "(incomplete)"}`);
  }
  console.log(`cached responses: ${http.cache.size}`);
  console.log(`packages by ecosystem: ${pkgs.length ? JSON.stringify(pkgs) : "(none yet)"}`);
  db.close();
}

main().catch((err: unknown) => {
  console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
