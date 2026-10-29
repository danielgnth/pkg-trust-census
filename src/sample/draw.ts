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
 * stage repeats it. A draw that stops part-way (a registry rate-limiting its activity checks) keeps
 * every check made so far in a journal, and a restart with the same seed replays them without
 * reading a single response again; a different seed starts the journal over.
 */

import { createHash } from "node:crypto";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
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
   * Listed names the registry no longer serves as packages (a list read from a dump keeps them), and
   * why: they are recorded as no package, outside the population, like a name an activity check finds gone.
   */
  gone?: { names: Set<string>; reason: string };
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
  /** Told how a long name list (Go's index crawl) is getting on. */
  progress?: ((message: string) => void) | undefined;
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

/** Thrown when an activity check fails part-way through a draw; the checks made so far are kept. */
export class DrawInterruptedError extends Error {
  constructor(ecosystem: EcosystemId, name: string, checked: number, accepted: number, cause: unknown) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(`${ecosystem}: draw stopped at "${name}" after ${checked} names checked and ${accepted} accepted: ${reason}`, { cause });
    this.name = "DrawInterruptedError";
  }
}

/**
 * The activity checks a draw has made, one JSON line each after a header naming the seed. A journal
 * written under another seed is started over.
 */
export async function openJournal(path: string, seed: string): Promise<{ known: Map<string, Activity>; add(entries: Array<[string, Activity]>): Promise<void> }> {
  const known = new Map<string, Activity>();
  const file = Bun.file(path);
  const lines = (await file.exists()) ? (await file.text()).split("\n") : [];
  let header: { seed?: string } | null = null;
  try {
    header = lines[0] ? (JSON.parse(lines[0]) as { seed?: string }) : null;
  } catch {
    header = null;
  }
  if (header?.seed === seed) {
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      try {
        const { name, ...activity } = JSON.parse(line) as { name: string } & Activity;
        known.set(name, activity);
      } catch {
        // A truncated last line from an interrupted run: that check is made again.
      }
    }
  } else {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify({ seed }) + "\n");
  }
  return {
    known,
    async add(entries) {
      if (entries.length === 0) return;
      for (const [name, a] of entries) known.set(name, a);
      await appendFile(path, entries.map(([name, a]) => JSON.stringify({ name, ...a }) + "\n").join(""));
    },
  };
}

/**
 * Draws `n` active packages. Activity checks run a batch ahead of the walk, so the host's queue
 * stays busy; a name checked past the `n`th acceptance is dropped from the record, as if never
 * checked, and costs nothing on a re-run (it is cached, and in the journal).
 *
 * A failed check stops the draw at that name, in walk order, after the batch's other checks are
 * journaled: a re-run continues exactly there, so the sample is the one an uninterrupted draw makes.
 */
export async function drawActive(
  source: DrawSource,
  n: number,
  seed: string,
  http: HttpClient,
  ctx: DrawContext,
  onProgress?: (message: string) => void,
  opts: { journal?: string } = {},
): Promise<{ candidates: Candidate[]; record: DrawRecord }> {
  onProgress?.(`[${source.ecosystem}] reading the name list`);
  const list = await source.nameList(http, { ...ctx, progress: onProgress });
  const since = activityWindowStart(ctx.asOf).getTime();
  // A list that carries its own dates needs no requests, so there is nothing to journal.
  const journal = opts.journal && !list.latestRelease ? await openJournal(opts.journal, seed) : null;
  if (journal?.known.size) onProgress?.(`[${source.ecosystem}] resuming: ${journal.known.size} activity checks journaled`);
  const check = async (name: string): Promise<Activity> => {
    if (list.gone?.names.has(name)) return { latestRelease: null, missing: list.gone.reason };
    if (list.latestRelease) return { latestRelease: list.latestRelease.get(name) ?? null };
    const known = journal?.known.get(name);
    if (known) return known;
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
    const settled = await Promise.allSettled(names.map(check));
    if (journal) {
      await journal.add(
        names.flatMap((name, i): Array<[string, Activity]> => {
          const r = settled[i]!;
          return r.status === "fulfilled" && !journal.known.has(name) ? [[name, r.value]] : [];
        }),
      );
    }
    for (const [i, name] of names.entries()) {
      if (accepted.length >= n) break;
      const r = settled[i]!;
      if (r.status === "rejected") throw new DrawInterruptedError(source.ecosystem, name, checked, accepted.length, r.reason);
      checked++;
      const a = r.value;
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
