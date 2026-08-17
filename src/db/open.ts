import { Database } from "bun:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dataDir } from "../http/cache.ts";

/** Resolved per call for the same reason as the cache paths — see `dataDir`. */
export function dbPath(): string {
  return process.env.PKG_TRUST_DB ?? join(dataDir(), "trust.sqlite");
}

const SCHEMA_PATH = fileURLToPath(new URL("./schema.sql", import.meta.url));

export function openDb(path: string = dbPath()): Database {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { create: true });
  db.exec(readFileSync(SCHEMA_PATH, "utf8"));
  return db;
}

/**
 * Registers a snapshot if it is not already present.
 *
 * `packages` has a foreign key onto `snapshots`, so this has to happen before any stage
 * writes rows. Idempotent, so re-running a stage against an existing snapshot is safe.
 */
export function ensureSnapshot(
  db: Database,
  snapshotId: string,
  config: Record<string, unknown> = {},
  toolVersion = "0.1.0",
): void {
  db.query(
    `INSERT OR IGNORE INTO snapshots (snapshot_id, started_at, tool_version, config_json)
     VALUES (?, ?, ?, ?)`,
  ).run(snapshotId, new Date().toISOString(), toolVersion, JSON.stringify(config));
}

/**
 * Snapshot ids are minute-resolution UTC timestamps: sortable, human-readable in output
 * paths, and stable across the stages of a single run.
 */
export function newSnapshotId(now: Date = new Date()): string {
  return now.toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-") + "Z";
}
