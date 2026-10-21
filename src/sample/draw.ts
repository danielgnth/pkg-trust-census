/**
 * The random layer: a uniform sample of a registry's *active* packages (docs/methodology.md,
 * Random sample).
 *
 * Every package name is listed, the list is sorted and shuffled with a seeded generator, and the
 * shuffled list is walked in order. A name is accepted when the registry's own metadata shows a
 * release in the activity window; the first `n` accepted names are the sample. Drawing uniformly
 * from all names and rejecting inactive ones yields a uniform sample of active packages, and the
 * registry, not the list, decides what is active.
 *
 * The draw is deterministic: the same list and seed give the same order, so a restarted rank
 * stage repeats it, and its activity checks are cache hits.
 */

import { createHash } from "node:crypto";
import { uniformInt } from "pure-rand/distribution/uniformInt";
import { xoroshiro128plus } from "pure-rand/generator/xoroshiro128plus";
import type { Candidate, EcosystemId } from "../types.ts";
import type { BulkFile, HttpClient } from "../http/client.ts";

/** A release in the 36 months before the snapshot makes a package active: the 12 quarters reported on. */
export const ACTIVITY_MONTHS = 36;

export function activityWindowStart(asOf: Date): Date {
  const d = new Date(asOf);
  d.setUTCMonth(d.getUTCMonth() - ACTIVITY_MONTHS);
  return d;
}

/** Every package name of a registry, with where the list came from. */
export interface NameList {
  names: string[];
  /** What the list was read from: the files downloaded (URL, sha256, size) or the query run. */
  files: BulkFile[];
  /** How the list was built, in one line, for the draw record. */
  method: string;
  /**
   * Newest release at or before the snapshot per name, when the list itself carries dates (a
   * database dump, Go's index). The activity check then needs no request. A listed name missing
   * here has no release by the snapshot.
   */
  latestRelease?: Map<string, string>;
  /** Why a name missing from `latestRelease` is rejected, when "no release" would mislead. */
  noRelease?: string;
  /**
   * A list too long to download whole, served already in draw order by the source (deps.dev's,
   * shuffled inside BigQuery by the seed). `names` is then empty, and the draw reads pages until it
   * has enough; `files` describes what was read once it is done.
   */
  ordered?: {
    listed: number;
    pages(): AsyncGenerator<string[]>;
    files(): BulkFile[];
  };
}

export interface Activity {
  /** Newest release at or before the snapshot, yanked included; null when there is none. */
  latestRelease: string | null;
  /** Why a name is not a package after all (gone since the list was made), if it is not. */
  missing?: string;
}

/** What each registry contributes to the draw: its name list and its activity check. */
export interface DrawSource {
  readonly ecosystem: EcosystemId;
  /** Read once per snapshot, stored with its checksum and reused on a restart. */
  nameList(http: HttpClient, ctx: DrawContext): Promise<NameList>;
  /** Read from the registry's metadata for one package; only called when the list carries no dates. */
  activity?(name: string, http: HttpClient, ctx: DrawContext): Promise<Activity>;
}

export interface DrawContext {
  snapshotId: string;
  asOf: Date;
  /** The draw's seed, for sources that shuffle the list themselves (`NameList.ordered`). */
  seed: string;
  /** Where name lists and dumps for this snapshot are stored. */
  dir: string;
}

/**
 * The newest of `times` at or before `asOf`. Lists and metadata are read after the snapshot
 * instant, so a release made since then must not decide whether the package was active.
 */
export function newestBefore(times: Iterable<string | null | undefined>, asOf: Date): string | null {
  let best: number | null = null;
  for (const t of times) {
    const ms = t ? Date.parse(t) : NaN;
    if (Number.isFinite(ms) && ms <= asOf.getTime() && (best == null || ms > best)) best = ms;
  }
  return best == null ? null : new Date(best).toISOString();
}

export interface DrawRecord {
  ecosystem: EcosystemId;
  seed: string;
  windowStart: string;
  method: string;
  files: BulkFile[];
  listed: number;
  /** Names checked in draw order, accepted or not. */
  checked: number;
  /** Of those, names that are no package at all (gone, or not a valid name): outside the population. */
  notPackages: number;
  accepted: number;
  rejected: Array<{ name: string; reason: string; latestRelease: string | null; missing?: true }>;
}

/**
 * A seeded Fisher–Yates walk over `names`, yielding them in shuffled order. Only as much of the
 * shuffle is done as is consumed, and the prefix it yields is the prefix a full shuffle would
 * produce. The list is sorted first, so its order as served cannot change the draw.
 */
export function* shuffled(names: readonly string[], seed: string): Generator<string> {
  const pool = [...new Set(names)].sort();
  // 32 bits of the seed's hash: the generator takes a 32-bit integer.
  const rng = xoroshiro128plus(createHash("sha256").update(seed, "utf8").digest().readInt32BE(0));
  for (let i = 0; i < pool.length; i++) {
    const j = uniformInt(rng, i, pool.length - 1);
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    yield pool[i]!;
  }
}

/**
 * Draws `n` active packages. Activity checks run a batch ahead of the walk, so the host's queue
 * stays busy; a name checked past the `n`th acceptance is dropped from the record, as if never
 * checked, and costs nothing on a re-run (it is cached).
 */
export async function drawActive(
  source: DrawSource,
  n: number,
  seed: string,
  http: HttpClient,
  ctx: DrawContext,
  onProgress?: (message: string) => void,
): Promise<{ candidates: Candidate[]; record: DrawRecord }> {
  const list = await source.nameList(http, ctx);
  const since = activityWindowStart(ctx.asOf).getTime();
  const check = async (name: string): Promise<Activity> => {
    if (list.latestRelease) return { latestRelease: list.latestRelease.get(name) ?? null };
    if (!source.activity) throw new Error(`${source.ecosystem}: the name list has no dates and there is no activity check`);
    return source.activity(name, http, ctx);
  };

  const accepted: string[] = [];
  const rejected: DrawRecord["rejected"] = [];
  let checked = 0;
  const batch = list.latestRelease ? 1000 : 16;
  const walk = list.ordered ? inBatches(list.ordered.pages(), batch) : inBatches(pagesOf(shuffled(list.names, seed)), batch);
  while (accepted.length < n) {
    const next = await walk.next();
    if (next.done) break;
    const names = next.value;
    const results = await Promise.all(names.map(check));
    for (const [i, name] of names.entries()) {
      if (accepted.length >= n) break;
      checked++;
      const a = results[i]!;
      const t = a.latestRelease ? Date.parse(a.latestRelease) : NaN;
      if (a.missing) rejected.push({ name, reason: a.missing, latestRelease: null, missing: true });
      else if (!Number.isFinite(t)) rejected.push({ name, reason: list.noRelease ?? "no release by the snapshot", latestRelease: null });
      else if (t < since) rejected.push({ name, reason: "no release in the window", latestRelease: a.latestRelease });
      else accepted.push(name);
    }
    onProgress?.(`[${source.ecosystem}] drew ${accepted.length}/${n} active from ${checked} checked of ${list.names.length}`);
  }

  return {
    candidates: accepted.map((name, i) => ({
      ecosystem: source.ecosystem,
      name,
      layer: "random",
      rank: i + 1,
      rankFrame: "random",
      downloadCount: null,
      dependentCount: null,
    })),
    record: {
      ecosystem: source.ecosystem,
      seed,
      windowStart: new Date(since).toISOString(),
      method: list.method,
      files: list.ordered ? list.ordered.files() : list.files,
      listed: list.ordered ? list.ordered.listed : new Set(list.names).size,
      checked,
      notPackages: rejected.filter((r) => r.missing).length,
      accepted: accepted.length,
      rejected,
    },
  };
}

/** A lazy walk as one-name pages, so the shuffle goes no further than the draw. */
async function* pagesOf(items: Iterable<string>): AsyncGenerator<string[]> {
  for (const item of items) yield [item];
}

/**
 * Regroups pages of names into batches of `size`, consuming pages only as batches are taken: a
 * source that pages through a remote result is read no further than the draw walks.
 */
async function* inBatches(pages: AsyncGenerator<string[]> | AsyncIterable<string[]>, size: number): AsyncGenerator<string[]> {
  let buffer: string[] = [];
  for await (const page of pages) {
    for (const name of page) {
      buffer.push(name);
      if (buffer.length === size) {
        yield buffer;
        buffer = [];
      }
    }
  }
  if (buffer.length) yield buffer;
}
