/**
 * The committed record of a snapshot's requests. The full manifest (every URL, sha256 and
 * status) grows to tens of megabytes at scale, so it is published with the cache release
 * instead of committed; this summary, with the manifest's own sha256, is what git keeps.
 */

import { manifestPath } from "../http/cache.ts";
import { sha256File } from "../http/client.ts";
import type { CacheEntry } from "../types.ts";

export interface RequestSummary {
  snapshot_id: string;
  manifest: { sha256: string; entries: number; bytes: number };
  first_fetched: string | null;
  last_fetched: string | null;
  /** Responses per host and HTTP status, as the manifest records them (the last record per URL). */
  hosts: Record<string, Record<string, number>>;
}

export async function requestSummary(snapshotId: string): Promise<RequestSummary | null> {
  const path = manifestPath(snapshotId);
  const file = Bun.file(path);
  if (!(await file.exists())) return null;
  const lines = (await file.text()).split("\n").filter(Boolean);
  const latest = new Map<string, CacheEntry>();
  for (const line of lines) {
    try {
      const e = JSON.parse(line) as CacheEntry;
      latest.set(e.url, e);
    } catch {
      // A truncated last line from an interrupted run, as the cache itself skips it.
    }
  }
  const hosts: RequestSummary["hosts"] = {};
  let bytes = 0;
  const times: string[] = [];
  for (const e of latest.values()) {
    const host = new URL(e.url.replace(/^(HEAD|POST) /, "").split(" ")[0]!).host;
    hosts[host] ??= {};
    hosts[host][String(e.httpStatus)] = (hosts[host][String(e.httpStatus)] ?? 0) + 1;
    bytes += e.bytes;
    times.push(e.fetchedAt);
  }
  times.sort();
  return {
    snapshot_id: snapshotId,
    manifest: { sha256: await sha256File(path), entries: latest.size, bytes },
    first_fetched: times[0] ?? null,
    last_fetched: times.at(-1) ?? null,
    hosts: Object.fromEntries(Object.entries(hosts).sort(([a], [b]) => a.localeCompare(b))),
  };
}
