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
import { runExtract } from "./stages/extract.ts";
import { runAggregate } from "./stages/aggregate.ts";
import { runReport } from "./stages/report.ts";
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

/**
 * clack's spinner redraws many times a second, which floods a CI log or a piped file.
 * Off a TTY the same calls print the start and stop lines, plus a progress line at most
 * every 15 seconds so a long unattended run still shows where it is.
 */
function spinner(): { start(m: string): void; message(m: string): void; stop(m: string): void } {
  if (isInteractive()) return p.spinner();
  let last = Date.now();
  return {
    start: (m) => p.log.step(m),
    message: (m) => {
      if (Date.now() - last < 15_000) return;
      last = Date.now();
      p.log.message(m);
    },
    stop: (m) => p.log.step(m),
  };
}

function banner(stage: string, snapshotId: string, ecosystems: EcosystemId[], transport: string) {
  p.intro(`pkg-trust-census · ${stage}`);
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

    const s = spinner();
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

    const s = spinner();
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

const extract = defineCommand({
  meta: { name: "extract", description: "Parse cached responses into versions and signals (offline)" },
  args: sharedArgs,
  async run({ args }) {
    const { runnable } = withAdapters(parseEcosystems(args.ecosystem));
    const db = openDb();
    const snapshotId = await resolveSnapshot(db, args.snapshot);
    const http = new HttpClient();
    await http.cache.load();
    banner("extract", snapshotId, runnable, "cache only");

    const s = spinner();
    s.start("extracting");
    try {
      const summaries = await runExtract(runnable, snapshotId, db, http.cache, (prog) => {
        s.message(`[${prog.ecosystem}] ${prog.index}/${prog.total} ${prog.package}`);
        if (prog.error) p.log.error(`${prog.package}: ${prog.error}`);
      });
      s.stop("extract complete");
      for (const sum of summaries) {
        const line = `${sum.ecosystem}: ${sum.extracted}/${sum.packages} packages, ${sum.versions} versions, ${sum.signals} signals, ${sum.advisoryMatches} advisory matches`;
        if (sum.failed) p.log.warn(`${line} (${sum.failed} failed — recorded as extract_error)`);
        else p.log.success(line);
      }
      if (summaries.length === 0) p.log.warn("nothing to extract — run `rank` and `fetch` first");
    } catch (err) {
      s.stop("extract failed");
      throw err;
    } finally {
      closeDb(db);
    }
    p.outro(`next: bun run cli aggregate --snapshot ${snapshotId}`);
  },
});

const aggregate = defineCommand({
  meta: { name: "aggregate", description: "Compute the maturity matrix and adoption series" },
  args: { snapshot: sharedArgs.snapshot },
  async run({ args }) {
    const db = openDb();
    try {
      const snapshotId = await resolveSnapshot(db, args.snapshot);
      p.intro(`pkg-trust-census · aggregate · ${snapshotId}`);
      const { aggregate: agg, path } = await runAggregate(db, snapshotId);
      p.log.success(`${agg.matrix.length} matrix cells, ${agg.series.length} series points → ${path}`);
      p.outro(`next: bun run cli report --snapshot ${snapshotId}`);
    } finally {
      closeDb(db);
    }
  },
});

const report = defineCommand({
  meta: { name: "report", description: "Write summary, matrix, CSVs and charts" },
  args: { snapshot: sharedArgs.snapshot },
  async run({ args }) {
    const db = openDb();
    try {
      const snapshotId = await resolveSnapshot(db, args.snapshot);
      p.intro(`pkg-trust-census · report · ${snapshotId}`);
      const { dir, files } = await runReport(db, snapshotId);
      p.log.success(`${files.length} files → ${dir}`);
      p.outro(`open ${dir}/summary.md`);
    } finally {
      closeDb(db);
    }
  },
});

/** All five stages in order: the unattended path for a scheduled run. */
const run = defineCommand({
  meta: { name: "run", description: "rank → fetch → extract → aggregate → report, in one go" },
  args: {
    ...sharedArgs,
    n: { type: "string", description: "sample size per ecosystem", default: "50" },
  },
  async run({ args }) {
    const n = Number(args.n);
    if (!Number.isInteger(n) || n < 1) throw new Error("--n must be a positive integer");
    const snapshotId = args.snapshot ?? newSnapshotId();
    const shared = { ecosystem: args.ecosystem, snapshot: snapshotId };
    await rank.run!({ args: { ...shared, n: args.n }, rawArgs: [], cmd: rank } as never);
    await fetch.run!({ args: shared, rawArgs: [], cmd: fetch } as never);
    await extract.run!({ args: shared, rawArgs: [], cmd: extract } as never);
    await aggregate.run!({ args: { snapshot: snapshotId }, rawArgs: [], cmd: aggregate } as never);
    await report.run!({ args: { snapshot: snapshotId }, rawArgs: [], cmd: report } as never);
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

    p.intro("pkg-trust-census · status");
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
          extractErrors: sql<number>`SUM(CASE WHEN ${packages.extractError} IS NOT NULL THEN 1 ELSE 0 END)`,
        })
        .from(packages)
        .where(eq(packages.snapshotId, latest!))
        .groupBy(packages.ecosystem)
        .all();

      for (const c of coverage) {
        p.log.message(
          `  ${c.ecosystem}: ${c.total} sampled, ${c.fetched} fetched` +
            (c.errors ? `, ${c.errors} fetch errors` : "") +
            (c.extractErrors ? `, ${c.extractErrors} extract errors` : ""),
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
    name: "pkg-trust-census",
    version: TOOL_VERSION,
    description: "Census of trust-signal adoption across seven package registries",
  },
  subCommands: {
    rank,
    fetch,
    extract,
    aggregate,
    report,
    run,
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
