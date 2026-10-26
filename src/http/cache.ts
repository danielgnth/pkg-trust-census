/**
 * Content-addressed, gzipped response cache plus an integrity manifest, one per snapshot.
 *
 * A snapshot reads only its own responses (`data/cache/{snapshot}/`), so a new snapshot fetches
 * the registries afresh rather than reusing an older one's answers. Payloads and the manifest are
 * git-ignored (npm packuments alone run to hundreds of MB per snapshot); both are published with
 * the snapshot's cache release (src/publish/), and the report commits a summary of the manifest
 * with its sha256 (`requests.json`), so integrity can be checked against the release.
 */

import { createHash } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import type { CacheEntry, EcosystemId } from "../types.ts";

/**
 * Resolved per call rather than at module load: capturing the environment once means the
 * first importer wins, which silently pointed separate test files at a shared directory.
 */
export function dataDir(): string {
  return process.env.PKG_TRUST_DATA_DIR ?? "data";
}

export function cacheDir(): string {
  return join(dataDir(), "cache");
}

/** A snapshot's cache folder; without a snapshot, the shared root (tests, fixture capture). */
export function snapshotCacheDir(snapshotId?: string): string {
  return snapshotId ? join(cacheDir(), snapshotId) : cacheDir();
}

export function manifestPath(snapshotId?: string): string {
  return join(snapshotCacheDir(snapshotId), "manifest.jsonl");
}

export function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/**
 * Filesystem-safe rendering of a package name that stays human-browsable.
 *
 * Has to survive npm scoped names (`@scope/name`), Go module paths
 * (`github.com/!burnt!sushi/toml`) and Maven coordinates (`group:artifact`) — all of
 * which contain characters that are either path separators or illegal on some platforms.
 */
export function slug(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  // Distinct names must not collide after cleaning ("a/b" and "a_b"), and very long
  // Go module paths would otherwise blow past filename limits.
  const digest = sha256(name).slice(0, 8);
  return `${cleaned.slice(0, 80) || "pkg"}-${digest}`;
}

/**
 * Serialises manifest appends. Concurrent fetches would otherwise interleave partial
 * lines into the file that is supposed to be the integrity record.
 */
class ManifestWriter {
  #tail: Promise<void> = Promise.resolve();

  constructor(readonly path: string) {}

  append(entry: CacheEntry): Promise<void> {
    this.#tail = this.#tail.then(async () => {
      const path = this.path;
      await mkdir(dirname(path), { recursive: true });
      await appendFile(path, JSON.stringify(entry) + "\n", "utf8");
    });
    return this.#tail;
  }

  flush(): Promise<void> {
    return this.#tail;
  }
}

export class ResponseCache {
  #manifest: ManifestWriter;
  /** In-memory index of the manifest, keyed by URL. */
  #index = new Map<string, CacheEntry>();
  #loaded = false;
  readonly dir: string;
  /** A published cache records payload paths relative to its folder, so it can be unpacked anywhere. */
  #relative = false;

  /** `snapshotId`: whose responses this cache holds; omitted, the shared root (tests). */
  constructor(readonly snapshotId?: string) {
    this.dir = snapshotCacheDir(snapshotId);
    this.#manifest = new ManifestWriter(join(this.dir, "manifest.jsonl"));
  }

  /**
   * A cache in `dir` whose manifest names payloads relative to it: the layout of a published
   * cache release, so `extract --cache <dir>` can rebuild a snapshot from the release alone.
   */
  static at(dir: string): ResponseCache {
    const cache = new ResponseCache();
    (cache as { dir: string }).dir = dir;
    cache.#manifest = new ManifestWriter(join(dir, "manifest.jsonl"));
    cache.#relative = true;
    return cache;
  }

  /** The newest record of every URL, in manifest order. */
  async entries(): Promise<CacheEntry[]> {
    await this.load();
    return [...this.#index.values()];
  }

  /** Where a record's payload lies on disk. */
  payloadPath(entry: CacheEntry): string {
    return this.#relative ? join(this.dir, entry.path) : entry.path;
  }

  async load(): Promise<void> {
    if (this.#loaded) return;
    this.#loaded = true;
    const f = Bun.file(join(this.dir, "manifest.jsonl"));
    if (!(await f.exists())) return;
    for (const line of (await f.text()).split("\n")) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line) as CacheEntry;
        // Later lines win, so a re-fetch supersedes an earlier record of the same URL.
        this.#index.set(e.url, e);
      } catch {
        // A truncated final line from an interrupted run is recoverable: skip it.
      }
    }
  }

  /**
   * Returns the cached body for `url`, or null on a miss.
   *
   * Verifies the payload against the manifest's sha256 and treats a mismatch as a miss,
   * so a corrupt or half-written file causes a re-fetch rather than silently poisoning
   * the extract stage.
   */
  async get(url: string): Promise<{ body: string; entry: CacheEntry } | null> {
    await this.load();
    const entry = this.#index.get(url);
    if (!entry) return null;

    const f = Bun.file(this.payloadPath(entry));
    if (!(await f.exists())) return null;

    try {
      const body = Bun.gunzipSync(new Uint8Array(await f.arrayBuffer()));
      const text = new TextDecoder().decode(body);
      if (sha256(text) !== entry.sha256) return null;
      return { body: text, entry };
    } catch {
      return null;
    }
  }

  async put(args: {
    url: string;
    body: string;
    httpStatus: number;
    ecosystem: EcosystemId;
    package: string;
    /** The body of a POST, kept so the request can be replayed from the manifest. */
    requestBody?: string | undefined;
    /** When the response was fetched, if not now: a redacted copy keeps the original's time. */
    fetchedAt?: string | undefined;
    /** sha256 of the response as fetched, when this body is a redacted copy of it. */
    originalSha256?: string | undefined;
  }): Promise<CacheEntry> {
    const path = join(this.dir, args.ecosystem, slug(args.package), `${sha256(args.url).slice(0, 32)}.json.gz`);
    await mkdir(dirname(path), { recursive: true });
    await Bun.write(path, Bun.gzipSync(new TextEncoder().encode(args.body)));

    const entry: CacheEntry = {
      url: args.url,
      sha256: sha256(args.body),
      bytes: Buffer.byteLength(args.body, "utf8"),
      httpStatus: args.httpStatus,
      fetchedAt: args.fetchedAt ?? new Date().toISOString(),
      ecosystem: args.ecosystem,
      package: args.package,
      path: this.#relative ? relative(this.dir, path) : path,
      ...(args.requestBody !== undefined ? { requestBody: args.requestBody } : {}),
      ...(args.originalSha256 !== undefined ? { originalSha256: args.originalSha256 } : {}),
    };
    this.#index.set(entry.url, entry);
    await this.#manifest.append(entry);
    return entry;
  }

  flush(): Promise<void> {
    return this.#manifest.flush();
  }

  get size(): number {
    return this.#index.size;
  }
}
