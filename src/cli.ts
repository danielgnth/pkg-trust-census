#!/usr/bin/env bun
/**
 * Stage runner.
 *
 * Every stage is independently re-runnable and keyed by snapshot id, so an interrupted run
 * resumes from the cache and `extract` can be re-run offline as parsers are refined.
 *
 * Interactive prompts appear only on a TTY when a required choice was not supplied on the
 * command line — the pipeline has to stay runnable headless from a scheduled job.
 */

import { defineCommand, runMain } from "citty";
import * as p from "@clack/prompts";
import { ECOSYSTEMS, type EcosystemId } from "./types.ts";
import {
  closeDb,
  dbPath,
  ensureSnapshot,
  finishSnapshot,
  latestSnapshot,
  newSnapshotId,
  openDb,
  type Db,
} from "./db/open.ts";
import { packages, snapshots } from "./db/schema.ts";
import { HttpClient, TOOL_VERSION, USER_AGENT } from "./http/client.ts";
import { implementedEcosystems } from "./adapters/index.ts";
import { runRank } from "./stages/rank.ts";
import { runFetch } from "./stages/fetch.ts";
import { count, desc, eq, isNotNull, sql } from "drizzle-orm";

const isInteractive = () => process.stdout.isTTY === true && !process.env.CI;

const sharedArgs = {
  ecosystem: {
    type: "string" as const,
    description: `comma-separated ecosystems, or "all" (${ECOSYSTEMS.join(", ")})`,
    default: "all",
  },
  snapshot: {
    type: "string" as const,
    description: "snapshot id to operate on (defaults to the most recent)",
  },
};

function parseEcosystems(value: string): EcosystemId[] {
  if (value === "all") return [...ECOSYSTEMS];
  return value.split(",").map((raw) => {
    const e = raw.trim();
    if (!ECOSYSTEMS.includes(e as EcosystemId)) {
      throw new Error(`unknown ecosystem "${e}" (known: ${ECOSYSTEMS.join(", ")})`);
    }
    return e as EcosystemId;
  });
}

/**
 * Narrows the requested list to ecosystems that actually have an adapter, so a default of
 * "all" does something useful while adapters are still landing per milestone.
 */
function withAdapters(requested: EcosystemId[]): { runnable: EcosystemId[]; skipped: EcosystemId[] } {
  const available = new Set(implementedEcosystems());
  return {
    runnable: requested.filter((e) => available.has(e)),
    skipped: requested.filter((e) => !available.has(e)),
  };
}

/** Resolves the snapshot to operate on, prompting only when interactive and ambiguous. */
async function resolveSnapshot(db: Db, explicit: string | undefined): Promise<string> {
  if (explicit) return explicit;

  const rows = db
    .select({ id: snapshots.snapshotId, started: snapshots.startedAt })
    .from(snapshots)
    .orderBy(desc(snapshots.startedAt))
    .limit(10)
    .all();

  if (rows.length === 0) throw new Error("no snapshot found — run `rank` first");
  if (rows.length === 1 || !isInteractive()) return rows[0]!.id;

  const choice = await p.select({
    message: "Which snapshot?",
    options: rows.map((r, i) => ({
      value: r.id,
      label: r.id,
      hint: i === 0 ? "most recent" : r.started.slice(0, 19),
    })),
  });
  if (p.isCancel(choice)) {
    p.cancel("Cancelled.");
    process.exit(1);
  }
  return choice;
}

function banner(stage: string, snapshotId: string, ecosystems: EcosystemId[], transport: string) {
  p.intro(`pkg-trust-scraper · ${stage}`);
  p.log.info(
    [
      `snapshot   ${snapshotId}`,
      `ecosystems ${ecosystems.join(", ") || "(none)"}`,
      `transport  ${transport}`,
      `db         ${dbPath()}`,
    ].join("\n"),
  );
}

const rank = defineCommand({
  meta: { name: "rank", description: "Build the candidate sample per ecosystem" },
  args: {
    ...sharedArgs,
    n: { type: "string", description: "sample size per ecosystem", default: "50" },
  },
  async run({ args }) {
    const n = Number(args.n);
    if (!Number.isInteger(n) || n < 1) throw new Error("--n must be a positive integer");

    const requested = parseEcosystems(args.ecosystem);
    const { runnable, skipped } = withAdapters(requested);
    const db = openDb();
    // `rank` always begins a new snapshot unless one was named explicitly.
    const snapshotId = args.snapshot ?? newSnapshotId();
    ensureSnapshot(db, snapshotId, { n, ecosystems: runnable }, TOOL_VERSION);

    const http = new HttpClient();
    await http.cache.load();
    banner("rank", snapshotId, runnable, http.transport.name);
    if (skipped.length) p.log.warn(`no adapter yet: ${skipped.join(", ")}`);

    const s = p.spinner();
    s.start(`ranking top ${n}`);
    try {
      const results = await runRank(runnable, n, snapshotId, db, http, (m) => s.message(m));
      s.stop(`ranked ${results.reduce((a, r) => a + r.count, 0)} packages`);
      for (const r of results) p.log.success(`${r.ecosystem}: ${r.count} → ${r.path}`);
    } catch (err) {
      s.stop("ranking failed");
      throw err;
    } finally {
      await http.flush();
      finishSnapshot(db, snapshotId);
      closeDb(db);
    }
    p.outro(`snapshot ${snapshotId} — next: bun run cli fetch --snapshot ${snapshotId}`);
  },
});

const fetch = defineCommand({
  meta: { name: "fetch", description: "Warm the response cache for the sampled packages" },
  args: sharedArgs,
  async run({ args }) {
    const requested = parseEcosystems(args.ecosystem);
    const { runnable } = withAdapters(requested);
    const db = openDb();
    const snapshotId = await resolveSnapshot(db, args.snapshot);

    const http = new HttpClient();
    await http.cache.load();
    banner("fetch", snapshotId, runnable, http.transport.name);

    const s = p.spinner();
    s.start("fetching");
    try {
      const summaries = await runFetch(runnable, snapshotId, db, http, (prog) => {
        s.message(`[${prog.ecosystem}] ${prog.index}/${prog.total} ${prog.package}`);
        if (prog.error) p.log.error(`${prog.package}: ${prog.error}`);
      });
      s.stop("fetch complete");

      for (const sum of summaries) {
        const line = `${sum.ecosystem}: ${sum.succeeded}/${sum.attempted}`;
        if (sum.failed) p.log.warn(`${line} (${sum.failed} failed — recorded as fetch_error)`);
        else p.log.success(line);
      }
      if (summaries.length === 0) p.log.warn("nothing to fetch — run `rank` first");
    } catch (err) {
      s.stop("fetch failed");
      throw err;
    } finally {
      await http.flush();
      finishSnapshot(db, snapshotId);
      closeDb(db);
    }

    p.outro(
      `fetched=${http.stats.fetched} cached=${http.stats.cacheHits} ` +
        `retries=${http.stats.retries} errors=${http.stats.errors}`,
    );
  },
});

const pending = (name: string, milestone: string) =>
  defineCommand({
    meta: { name, description: `(${milestone}) not implemented yet` },
    run() {
      p.log.warn(`\`${name}\` lands in ${milestone}`);
    },
  });

const status = defineCommand({
  meta: { name: "status", description: "Show snapshots, cache and coverage" },
  async run() {
    const db = openDb();
    const http = new HttpClient();
    await http.cache.load();

    const snaps = db
      .select({
        id: snapshots.snapshotId,
        started: snapshots.startedAt,
        finished: snapshots.finishedAt,
      })
      .from(snapshots)
      .orderBy(desc(snapshots.startedAt))
      .all();

    p.intro("pkg-trust-scraper · status");
    p.log.info(`db ${dbPath()}\ncached responses ${http.cache.size}\ntransport ${http.transport.name}`);

    if (snaps.length === 0) {
      p.log.warn("no snapshots yet — run `rank`");
    } else {
      const latest = latestSnapshot(db);
      for (const s of snaps) {
        p.log.message(
          `${s.id}${s.id === latest ? " (latest)" : ""}  ` +
            `started ${s.started.slice(0, 19)}  ${s.finished ? "complete" : "INCOMPLETE"}`,
        );
      }

      const coverage = db
        .select({
          ecosystem: packages.ecosystem,
          total: count(),
          fetched: sql<number>`SUM(CASE WHEN ${packages.fetchTimestamp} IS NOT NULL THEN 1 ELSE 0 END)`,
          errors: sql<number>`SUM(CASE WHEN ${packages.fetchError} IS NOT NULL THEN 1 ELSE 0 END)`,
        })
        .from(packages)
        .where(eq(packages.snapshotId, latest!))
        .groupBy(packages.ecosystem)
        .all();

      for (const c of coverage) {
        p.log.message(
          `  ${c.ecosystem}: ${c.total} sampled, ${c.fetched} fetched` +
            (c.errors ? `, ${c.errors} errors` : ""),
        );
      }
    }

    const failures = db
      .select({ ecosystem: packages.ecosystem, name: packages.packageName, err: packages.fetchError })
      .from(packages)
      .where(isNotNull(packages.fetchError))
      .limit(5)
      .all();
    for (const f of failures) p.log.error(`${f.ecosystem}/${f.name}: ${f.err}`);

    closeDb(db);
    p.outro("ok");
  },
});

const main = defineCommand({
  meta: {
    name: "pkg-trust-scraper",
    version: TOOL_VERSION,
    description: "Cross-ecosystem package trust signal scraper",
  },
  subCommands: {
    rank,
    fetch,
    extract: pending("extract", "M3"),
    aggregate: pending("aggregate", "M3"),
    report: pending("report", "M3"),
    status,
  },
  setup() {
    if (process.env.PKG_TRUST_QUIET !== "1") {
      // Printed once per invocation: registries are entitled to know who is calling.
      process.stderr.write(`UA: ${USER_AGENT}\n`);
    }
  },
});

runMain(main);
