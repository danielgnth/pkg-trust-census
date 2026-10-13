/**
 * The shared fetch path for every adapter: identifies the project, paces itself per host,
 * retries transient failures, and writes every response through the cache.
 *
 * Two behaviours matter for data integrity:
 *  - A 404 is a *fact* (the package or file does not exist) and is cached and returned.
 *    An exhausted retry budget is an *error* and throws, so it surfaces as `fetch_error`
 *    rather than becoming a silent `false`.
 *  - Resumability comes from the cache, not from bookkeeping: a warm URL is never re-fetched.
 */

import type { EcosystemId, FetchResult } from "../types.ts";
import { ResponseCache } from "./cache.ts";
import { RateLimiter } from "./ratelimit.ts";
import { defaultTransport, type Transport } from "./transport.ts";

export const TOOL_VERSION = "0.1.0";

/**
 * Identifies the project to every registry. A contact address is added only from the
 * environment (`PKG_TRUST_CONTACT`, e.g. in a git-ignored `.env`), so no personal address
 * lives in the code and nobody re-running this sends requests in someone else's name.
 */
export const USER_AGENT =
  process.env.PKG_TRUST_UA ??
  `pkg-trust-census/${TOOL_VERSION} (SSCS Seminar WiSe 26/27; ` +
    `+https://github.com/danielgnth/pkg-trust-census` +
    (process.env.PKG_TRUST_CONTACT ? `; ${process.env.PKG_TRUST_CONTACT}` : "") +
    ")";

/** Retried: transient by nature. Anything else is returned to the caller as-is. */
const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

export interface RequestOptions {
  ecosystem: EcosystemId;
  /** Package this request belongs to; determines the cache path. */
  package: string;
  headers?: Record<string, string>;
  method?: "GET" | "HEAD";
  /** Re-fetch even on a cache hit. */
  force?: boolean;
  /** Treat these non-OK statuses as facts worth caching rather than errors. */
  acceptStatuses?: number[];
}

export class HttpClient {
  readonly cache: ResponseCache;
  readonly transport: Transport;
  #limiter: RateLimiter;
  #maxRetries: number;

  stats = { fetched: 0, cacheHits: 0, retries: 0, errors: 0 };

  constructor(
    opts: {
      cache?: ResponseCache;
      limiter?: RateLimiter;
      maxRetries?: number;
      transport?: Transport;
    } = {},
  ) {
    this.cache = opts.cache ?? new ResponseCache();
    this.transport = opts.transport ?? defaultTransport();
    this.#limiter = opts.limiter ?? new RateLimiter();
    this.#maxRetries = opts.maxRetries ?? 4;
  }

  async get(url: string, opts: RequestOptions): Promise<FetchResult> {
    const key = cacheKey(url, opts.method);
    if (!opts.force) {
      const hit = await this.cache.get(key);
      if (hit) {
        this.stats.cacheHits++;
        return { url, status: hit.entry.httpStatus, body: hit.body, fromCache: true, entry: hit.entry };
      }
    }

    const host = new URL(url).host;
    const accept = new Set([200, 404, ...(opts.acceptStatuses ?? [])]);
    let lastError = "";

    for (let attempt = 0; attempt <= this.#maxRetries; attempt++) {
      const release = await this.#limiter.acquire(host);
      let status = 0;
      let body = "";
      try {
        const res = await this.transport.request(url, {
          method: opts.method ?? "GET",
          headers: { "User-Agent": USER_AGENT, ...opts.headers },
        });
        status = res.status;
        // A HEAD has no body, so the headers worth keeping become the cached body. The
        // status is the signal (Maven .asc probing); Last-Modified dates the release.
        body = opts.method === "HEAD" ? headBody(res.headers) : res.body;

        if (RETRYABLE.has(status)) {
          const retryAfter = Number(res.headers.get("retry-after"));
          const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : backoffMs(attempt);
          this.#limiter.penalise(host, waitMs);
          lastError = `HTTP ${status}`;
          throw new RetryableError(lastError, waitMs);
        }
      } catch (err) {
        release();
        const retryable = err instanceof RetryableError;
        const waitMs = retryable ? err.waitMs : backoffMs(attempt);
        lastError = err instanceof Error ? err.message : String(err);
        if (attempt === this.#maxRetries) {
          this.stats.errors++;
          throw new Error(`fetch failed after ${attempt + 1} attempts: ${url}: ${lastError}`);
        }
        this.stats.retries++;
        await Bun.sleep(waitMs);
        continue;
      }
      release();

      if (!accept.has(status)) {
        this.stats.errors++;
        throw new Error(`unexpected HTTP ${status} for ${url}`);
      }

      this.stats.fetched++;
      const entry = await this.cache.put({
        url: key,
        body,
        httpStatus: status,
        ecosystem: opts.ecosystem,
        package: opts.package,
      });
      return { url, status, body, fromCache: false, entry };
    }

    // Unreachable: the loop either returns or throws on the final attempt.
    throw new Error(`fetch failed: ${url}: ${lastError}`);
  }

  async getJson<T = unknown>(url: string, opts: RequestOptions): Promise<{ data: T | null; res: FetchResult }> {
    return parseJsonResult<T>(await this.get(url, opts));
  }

  flush(): Promise<void> {
    return this.cache.flush();
  }
}

/**
 * What adapters read through: the live client during `fetch`, the cache alone during
 * `extract`. One gathering routine serves both, so `extract` replays exactly the requests
 * `fetch` made — including the data-dependent ones (Go and Maven probe per release).
 */
export interface Source {
  get(url: string, opts: RequestOptions): Promise<FetchResult>;
  getJson<T = unknown>(url: string, opts: RequestOptions): Promise<{ data: T | null; res: FetchResult }>;
}

/** Thrown by `CacheSource` when `extract` needs a response that `fetch` never stored. */
export class CacheMissError extends Error {
  constructor(readonly url: string) {
    super(`not in cache: ${url} — run \`fetch\` first`);
    this.name = "CacheMissError";
  }
}

/** Cache-only `Source`: never touches the network, which is what keeps `extract` pure. */
export class CacheSource implements Source {
  constructor(readonly cache: ResponseCache) {}

  async get(url: string, opts: RequestOptions): Promise<FetchResult> {
    const hit = await this.cache.get(cacheKey(url, opts.method));
    if (!hit) throw new CacheMissError(url);
    return { url, status: hit.entry.httpStatus, body: hit.body, fromCache: true, entry: hit.entry };
  }

  async getJson<T = unknown>(url: string, opts: RequestOptions): Promise<{ data: T | null; res: FetchResult }> {
    return parseJsonResult<T>(await this.get(url, opts));
  }
}

/** HEAD and GET of one URL are different facts, so they must not share a cache entry. */
export function cacheKey(url: string, method: RequestOptions["method"] = "GET"): string {
  return method === "HEAD" ? `HEAD ${url}` : url;
}

function parseJsonResult<T>(res: FetchResult): { data: T | null; res: FetchResult } {
  if (res.status === 404 || res.status === 410) return { data: null, res };
  try {
    return { data: JSON.parse(res.body) as T, res };
  } catch (err) {
    throw new Error(`invalid JSON from ${res.url}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Response headers kept for a HEAD request; everything else is transport noise. */
const HEAD_HEADERS = ["last-modified", "content-length", "etag"];

function headBody(headers: Map<string, string>): string {
  const kept: Record<string, string> = {};
  for (const h of HEAD_HEADERS) {
    const v = headers.get(h);
    if (v !== undefined) kept[h] = v;
  }
  return JSON.stringify(kept);
}

class RetryableError extends Error {
  constructor(message: string, readonly waitMs: number) {
    super(message);
    this.name = "RetryableError";
  }
}

/** Exponential backoff with jitter, capped so a long run cannot stall for minutes. */
export function backoffMs(attempt: number): number {
  const base = Math.min(2 ** attempt * 1000, 30_000);
  return base + Math.random() * 250;
}
