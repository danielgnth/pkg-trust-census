/**
 * Content-addressed, gzipped response cache plus an integrity manifest.
 *
 * Payloads are git-ignored (npm packuments alone run to hundreds of MB per snapshot);
 * `manifest.jsonl` is committed, so a reviewer can verify byte-exact integrity and the
 * extract stage can be re-derived offline without re-fetching. See plan §7.
 */

import { createHash } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { CacheEntry, EcosystemId } from "../types.ts";

export const DATA_DIR = process.env.PKG_TRUST_DATA_DIR ?? "data";
const CACHE_DIR = join(DATA_DIR, "cache");
const MANIFEST = join(CACHE_DIR, "manifest.jsonl");

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

export function cachePath(ecosystem: EcosystemId, pkg: string, url: string): string {
  return join(CACHE_DIR, ecosystem, slug(pkg), `${sha256(url).slice(0, 32)}.json.gz`);
}

/**
 * Serialises manifest appends. Concurrent fetches would otherwise interleave partial
 * lines into the file that is supposed to be the integrity record.
 */
class ManifestWriter {
  #tail: Promise<void> = Promise.resolve();

  append(entry: CacheEntry): Promise<void> {
    this.#tail = this.#tail.then(async () => {
      await mkdir(dirname(MANIFEST), { recursive: true });
      await appendFile(MANIFEST, JSON.stringify(entry) + "\n", "utf8");
    });
    return this.#tail;
  }

  flush(): Promise<void> {
    return this.#tail;
  }
}

export class ResponseCache {
  #manifest = new ManifestWriter();
  /** In-memory index of the manifest, keyed by URL. */
  #index = new Map<string, CacheEntry>();
  #loaded = false;

  async load(): Promise<void> {
    if (this.#loaded) return;
    this.#loaded = true;
    const f = Bun.file(MANIFEST);
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

    const f = Bun.file(entry.path);
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
  }): Promise<CacheEntry> {
    const path = cachePath(args.ecosystem, args.package, args.url);
    await mkdir(dirname(path), { recursive: true });
    await Bun.write(path, Bun.gzipSync(new TextEncoder().encode(args.body)));

    const entry: CacheEntry = {
      url: args.url,
      sha256: sha256(args.body),
      bytes: Buffer.byteLength(args.body, "utf8"),
      httpStatus: args.httpStatus,
      fetchedAt: new Date().toISOString(),
      ecosystem: args.ecosystem,
      package: args.package,
      path,
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
