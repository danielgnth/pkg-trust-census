/**
 * deps.dev's BigQuery dataset: the one source this project reads behind a login (a Google account,
 * the BigQuery sandbox; see CLAUDE.md and docs/development.md, BigQuery).
 *
 * BigQuery results are not HTTP responses, so they bypass the response cache. Each query is
 * stored instead, keyed by the hash of its SQL, parameters and the deps.dev snapshot it read, so a
 * rerun skips a query that already has a result. A query is dry-run first, and runs with a cap on
 * the bytes it may bill: the sandbox grants 1 TiB of processed data a month, and a dry run's
 * estimate is only an upper bound (often none at all, for the dataset's partitioned tables).
 */

import { BigQuery, type Job } from "@google-cloud/bigquery";
import { OAuth2Client } from "google-auth-library";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { dataDir } from "../http/cache.ts";

export const DATASET = "bigquery-public-data.deps_dev_v1";

/** Bytes one query may bill; `PKG_TRUST_BQ_MAX_GIB` overrides. */
export function maxBytes(): number {
  return Number(process.env.PKG_TRUST_BQ_MAX_GIB ?? 100) * 1024 ** 3;
}

let cached: BigQuery | null = null;

/**
 * Application-default credentials when set up; otherwise the gcloud CLI's own login, as a
 * short-lived token, so `gcloud auth login` alone is enough.
 */
async function client(): Promise<BigQuery> {
  if (cached) return cached;
  const projectId = process.env.PKG_TRUST_GCP_PROJECT;
  if (!projectId) throw new Error("set PKG_TRUST_GCP_PROJECT in .env to a Google Cloud project with the BigQuery API (docs/development.md, BigQuery)");
  const adc = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? join(homedir(), ".config", "gcloud", "application_default_credentials.json");
  if (await Bun.file(adc).exists()) return (cached = new BigQuery({ projectId }));
  const proc = Bun.spawn(["gcloud", "auth", "print-access-token"], { stdout: "pipe", stderr: "pipe" });
  const token = (await new Response(proc.stdout).text()).trim();
  if ((await proc.exited) !== 0 || !token) throw new Error(`no BigQuery credentials: run \`gcloud auth login\` (${(await new Response(proc.stderr).text()).trim()})`);
  const auth = new OAuth2Client();
  auth.setCredentials({ access_token: token });
  return (cached = new BigQuery({ projectId, authClient: auth }));
}

export interface QueryStats {
  /** The dry run's estimate; an upper bound, and 0 when BigQuery cannot estimate. */
  estimatedBytes: number;
  bytesProcessed: number;
  bytesBilled: number;
  runMs: number;
  ranAt: string;
  jobId: string;
}

export interface StoredQuery<T> {
  key: string;
  sql: string;
  params: Record<string, unknown>;
  /** The deps.dev snapshot the query reads (`SnapshotAt`), if it reads one. */
  depsdevSnapshot: string | null;
  stats: QueryStats;
  rows: T[];
}

export function queryKey(sql: string, params: Record<string, unknown>, depsdevSnapshot: string | null): string {
  return createHash("sha256").update(JSON.stringify([sql, params, depsdevSnapshot])).digest("hex");
}

/** Runs `sql` under the byte cap and returns its rows, with what it cost. */
export async function runQuery<T>(sql: string, params: Record<string, unknown> = {}): Promise<{ rows: T[]; stats: QueryStats }> {
  const bq = await client();
  const [dry] = await bq.createQueryJob({ query: sql, params, dryRun: true });
  const estimatedBytes = Number(dry.metadata?.statistics?.totalBytesProcessed ?? 0);
  if (estimatedBytes > maxBytes()) throw new Error(`query would process ${(estimatedBytes / 1024 ** 3).toFixed(1)} GiB, over the cap (PKG_TRUST_BQ_MAX_GIB)`);
  const started = Date.now();
  const [job] = await bq.createQueryJob({ query: sql, params, maximumBytesBilled: String(maxBytes()) });
  const [rows] = await job.getQueryResults({ autoPaginate: true });
  const [meta] = await job.getMetadata();
  const stats = meta.statistics?.query ?? {};
  return {
    rows: rows.map(plain) as T[],
    stats: {
      estimatedBytes,
      bytesProcessed: Number(stats.totalBytesProcessed ?? 0),
      bytesBilled: Number(stats.totalBytesBilled ?? 0),
      runMs: Date.now() - started,
      ranAt: new Date(started).toISOString(),
      jobId: job.id ?? "",
    },
  };
}

/**
 * Runs `sql` under the byte cap without reading its result: for an ordered result read only as
 * far as needed (`readPage`). The job's result stays readable for a day; after that, rerunning
 * the same deterministic query gives the same order.
 */
export async function startQuery(sql: string, params: Record<string, unknown>): Promise<{ job: Job; totalRows: number; stats: QueryStats }> {
  const bq = await client();
  const [dry] = await bq.createQueryJob({ query: sql, params, dryRun: true });
  const estimatedBytes = Number(dry.metadata?.statistics?.totalBytesProcessed ?? 0);
  if (estimatedBytes > maxBytes()) throw new Error(`query would process ${(estimatedBytes / 1024 ** 3).toFixed(1)} GiB, over the cap (PKG_TRUST_BQ_MAX_GIB)`);
  const started = Date.now();
  const [job] = await bq.createQueryJob({ query: sql, params, maximumBytesBilled: String(maxBytes()) });
  const [, , response] = await job.getQueryResults({ maxResults: 0, autoPaginate: false });
  const [meta] = await job.getMetadata();
  const stats = meta.statistics?.query ?? {};
  return {
    job,
    totalRows: Number(response?.totalRows ?? 0),
    stats: {
      estimatedBytes,
      bytesProcessed: Number(stats.totalBytesProcessed ?? 0),
      bytesBilled: Number(stats.totalBytesBilled ?? 0),
      runMs: Date.now() - started,
      ranAt: new Date(started).toISOString(),
      jobId: job.id ?? "",
    },
  };
}

export async function readPage<T>(job: Job, startIndex: number, size: number): Promise<T[]> {
  const [rows] = await job.getQueryResults({ startIndex: String(startIndex), maxResults: size, autoPaginate: false });
  return rows.map(plain) as T[];
}

/** BigQuery wraps timestamps and dates in objects; stored results keep their ISO text. */
function plain(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k, v && typeof v === "object" && "value" in v && Object.keys(v).length === 1 ? (v as { value: unknown }).value : v]),
  );
}

/** Where a snapshot's query results are stored: committed when they are aggregates. */
export function queriesDir(snapshotId: string): string {
  return join(dataDir(), "bigquery", snapshotId);
}

/**
 * A query's stored result, or the query run now and stored. `name` names the file; the key
 * inside it decides reuse, so a changed query runs again rather than reading a stale result.
 */
export async function storedQuery<T>(
  dir: string,
  name: string,
  sql: string,
  params: Record<string, unknown>,
  depsdevSnapshot: string | null,
): Promise<StoredQuery<T>> {
  const key = queryKey(sql, params, depsdevSnapshot);
  const path = join(dir, `${name}.json`);
  const file = Bun.file(path);
  if (await file.exists()) {
    const stored = (await file.json()) as StoredQuery<T>;
    if (stored.key === key) return stored;
  }
  const { rows, stats } = await runQuery<T>(sql, { ...params, ...(depsdevSnapshot ? { snapshot: depsdevSnapshot } : {}) });
  const result: StoredQuery<T> = { key, sql, params, depsdevSnapshot, stats, rows };
  await Bun.write(path, JSON.stringify(result, null, 2) + "\n");
  return result;
}

/**
 * The newest deps.dev snapshot taken at or before `asOf`: the one a query keyed to this
 * snapshot reads, whenever it runs.
 */
export async function depsdevSnapshot(snapshotId: string, asOf: Date): Promise<string> {
  const sql = `SELECT MAX(Time) AS time FROM \`${DATASET}.Snapshots\` WHERE Time <= TIMESTAMP(@asOf)`;
  const { rows } = await storedQuery<{ time: string | null }>(queriesDir(snapshotId), "snapshot", sql, { asOf: asOf.toISOString() }, null);
  if (!rows[0]?.time) throw new Error(`no deps.dev snapshot at or before ${asOf.toISOString()}`);
  // Microseconds, as BigQuery stores them: a millisecond `Date` would match no partition.
  return rows[0].time.replace(/(\.\d{1,6})\d*Z$/, "$1Z");
}
