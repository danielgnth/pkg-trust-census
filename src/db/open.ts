import { Database } from "bun:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_DIR } from "../http/cache.ts";

export const DB_PATH = process.env.PKG_TRUST_DB ?? join(DATA_DIR, "trust.sqlite");

const SCHEMA_PATH = fileURLToPath(new URL("./schema.sql", import.meta.url));

export function openDb(path: string = DB_PATH): Database {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { create: true });
  db.exec(readFileSync(SCHEMA_PATH, "utf8"));
  return db;
}

/**
 * Snapshot ids are minute-resolution UTC timestamps: sortable, human-readable in output
 * paths, and stable across the stages of a single run.
 */
export function newSnapshotId(now: Date = new Date()): string {
  return now.toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-") + "Z";
}
