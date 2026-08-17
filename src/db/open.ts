import { Database } from "bun:sqlite";
import { desc, eq } from "drizzle-orm";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dataDir } from "../http/cache.ts";
import * as schema from "./schema.ts";
import { snapshotInsert } from "./validation.ts";

export type Db = BunSQLiteDatabase<typeof schema> & { $client: Database };

const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../drizzle", import.meta.url));

/** Resolved per call for the same reason as the cache paths — see `dataDir`. */
export function dbPath(): string {
  return process.env.PKG_TRUST_DB ?? join(dataDir(), "trust.sqlite");
}

export function openDb(path: string = dbPath()): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });

  const sqlite = new Database(path, { create: true });
  // WAL is a no-op for :memory: but materially faster for the real file during a run.
  if (path !== ":memory:") sqlite.exec("PRAGMA journal_mode = WAL;");
  // Off by default in SQLite; the composite FKs are load-bearing here.
  sqlite.exec("PRAGMA foreign_keys = ON;");

  const db = drizzle(sqlite, { schema }) as Db;
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}

export function closeDb(db: Db): void {
  db.$client.close();
}

/**
 * Registers a snapshot if it is not already present.
 *
 * `packages` has a foreign key onto `snapshots`, so this has to happen before any stage
 * writes rows. Idempotent, so re-running a stage against an existing snapshot is safe.
 */
export function ensureSnapshot(
  db: Db,
  snapshotId: string,
  config: Record<string, unknown> = {},
  toolVersion = "0.1.0",
): void {
  const row = snapshotInsert.parse({
    snapshotId,
    startedAt: new Date().toISOString(),
    toolVersion,
    configJson: JSON.stringify(config),
  });
  db.insert(schema.snapshots).values(row).onConflictDoNothing().run();
}

export function finishSnapshot(db: Db, snapshotId: string): void {
  db.update(schema.snapshots)
    .set({ finishedAt: new Date().toISOString() })
    .where(eq(schema.snapshots.snapshotId, snapshotId))
    .run();
}

/**
 * Snapshot ids are minute-resolution UTC timestamps: sortable, human-readable in output
 * paths, and stable across the stages of a single run.
 */
export function newSnapshotId(now: Date = new Date()): string {
  return now.toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-") + "Z";
}

export function latestSnapshot(db: Db): string | null {
  const row = db
    .select({ id: schema.snapshots.snapshotId })
    .from(schema.snapshots)
    .orderBy(desc(schema.snapshots.startedAt))
    .limit(1)
    .get();
  return row?.id ?? null;
}
