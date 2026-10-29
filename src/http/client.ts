/**
 * The shared fetch path for every adapter: identifies the project, paces itself per host
 * (`HostLimiter`), retries transient failures (ky), and writes every response through the cache.
 *
 * Two behaviours matter for data integrity:
 *  - A 404 is a *fact* (the package or file does not exist) and is cached and returned.
 *    An exhausted retry budget is an *error* and throws, so it surfaces as `fetch_error`
 *    rather than becoming a silent `false`.
 *  - Resumability comes from the cache, not from bookkeeping: a warm URL is never re-fetched.
 */

import ky, { HTTPError } from "ky";
import { createHash } from "node:crypto";
import { mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import type { EcosystemId, FetchResult } from "../types.ts";
import { ResponseCache, sha256 } from "./cache.ts";
import { defaultTransport, type Transport } from "./transport.ts";
import { DEFAULT_RATE_LIMIT, HostLimiter, RateLimitedError, RETRYABLE, type HostPolicy, type RateLimitOptions } from "./limiter.ts";

export { RateLimitedError, type HostPolicy } from "./limiter.ts";

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

/**
 * ky's own cap on attempts. Server errors and transport failures get `maxRetries`; a 429 is retried
 * until the host's limiter gives up on it, which its patience bounds.
 */
const RETRY_CEILING = 100;

export const DEFAULT_POLICY: HostPolicy = { rps: 4, concurrency: 4 };

/**
 * Per-host pacing. crates.io publishes a crawler policy asking for a descriptive
 * User-Agent with contact info and roughly one request per second; the others are
 * CDN-backed but still get throttled deliberately.
 */
export const HOST_POLICIES: Record<string, HostPolicy> = {
  // Explicit crawler policy: identify yourself, ~1 req/s.
  "crates.io": { rps: 1, concurrency: 1 },
  "rubygems.org": { rps: 2, concurrency: 2 },
  // Community aggregator, not a first-party registry — be gentle.
  "packages.ecosyste.ms": { rps: 2, concurrency: 2 },
  "packagist.org": { rps: 2, concurrency: 2 },
  "search.maven.org": { rps: 2, concurrency: 2 },
  // Central limits its heaviest consumers and lowers the thresholds over time; a draw at 4 req/s met 429.
  "repo1.maven.org": { rps: 2, concurrency: 2 },
  "sum.golang.org": { rps: 4, concurrency: 4 },
  "proxy.golang.org": { rps: 4, concurrency: 4 },
  "pypi.org": { rps: 5, concurrency: 5 },
  "registry.npmjs.org": { rps: 5, concurrency: 5 },
  // The downloads API answered 5 req/s with HTTP 429 on two thirds of requests (2026-10-13).
  "api.npmjs.org": { rps: 1, concurrency: 1 },
  "raw.githubusercontent.com": { rps: 4, concurrency: 4 },
  // OSV publishes no rate limit; held to the same pace as the registries.
  "api.osv.dev": { rps: 4, concurrency: 4 },
  // deps.dev publishes no rate limit; its per-version API backs scripts/check-depsdev.ts.
  "api.deps.dev": { rps: 4, concurrency: 4 },
  // The random draw's activity checks and bulk inputs (src/sample/sources.ts).
  "repo.packagist.org": { rps: 4, concurrency: 4 },
  // Pages are sequential within a month of the index, so months are crawled side by side.
  // The crawl met 429 at 4 req/s.
  "index.golang.org": { rps: 2, concurrency: 2 },
  "static.crates.io": { rps: 1, concurrency: 1 },
  "s3-us-west-2.amazonaws.com": { rps: 1, concurrency: 1 },
};

export interface RequestOptions {
  ecosystem: EcosystemId;
  /** Package this request belongs to; determines the cache path. */
  package: string;
  headers?: Record<string, string>;
  method?: "GET" | "HEAD" | "POST";
  /** Request body of a POST. Part of the cache key, and recorded in the manifest. */
  body?: string;
  /** Re-fetch even on a cache hit. */
  force?: boolean;
  /** Treat these non-OK statuses as facts worth caching rather than errors. */
  acceptStatuses?: number[];
}

export class HttpClient {
  readonly cache: ResponseCache;
  readonly transport: Transport;
  #ky: typeof ky;
  #policies: Record<string, HostPolicy>;
  #rateLimit: RateLimitOptions;
  #onEvent: ((message: string) => void) | undefined;
  #limiters = new Map<string, HostLimiter>();

  stats = { fetched: 0, cacheHits: 0, retries: 0, errors: 0 };

  constructor(
    opts: {
      cache?: ResponseCache;
      maxRetries?: number;
      transport?: Transport;
      /** Per-host overrides of HOST_POLICIES. */
      policies?: Record<string, HostPolicy>;
      /** Overrides of how long and how a rate-limited host is waited for. */
      rateLimit?: Partial<RateLimitOptions>;
      /** Told when a host rate-limits, slows down or recovers. */
      onEvent?: (message: string) => void;
    } = {},
  ) {
    this.cache = opts.cache ?? new ResponseCache();
    this.transport = opts.transport ?? defaultTransport();
    this.#policies = { ...HOST_POLICIES, ...opts.policies };
    this.#rateLimit = { ...DEFAULT_RATE_LIMIT, ...opts.rateLimit };
    this.#onEvent = opts.onEvent;
    const maxRetries = opts.maxRetries ?? 4;
    this.#ky = ky.create({
      // Every attempt, retries included, waits for its host's next slot.
      fetch: (request) => this.#paced(request),
      headers: { "User-Agent": USER_AGENT },
      timeout: 120_000,
      retry: {
        limit: RETRY_CEILING,
        statusCodes: RETRYABLE,
        // POST is only used for queries (OSV), which are safe to repeat.
        methods: ["get", "head", "post"],
        // Exponential with jitter, capped so a long run cannot stall for minutes. A rate-limited
        // host's block is waited out by its limiter, before the retry is sent.
        delay: (attempt) => 1000 * 2 ** (attempt - 1),
        backoffLimit: 30_000,
        maxRetryAfter: this.#rateLimit.patienceMs,
        jitter: (d) => d + Math.random() * 250,
        retryOnTimeout: true,
        shouldRetry: ({ error, retryCount }) => {
          if (error instanceof RateLimitedError) return false;
          if (error instanceof HTTPError && error.response.status === 429) return !this.#limiter(new URL(error.request.url).host).givenUp;
          if (retryCount > maxRetries) return false;
          // A transport failure (connection reset, curl exit) is as transient as a 503.
          return error instanceof HTTPError ? undefined : true;
        },
      },
    });
  }

  /** One limiter per host: at most `concurrency` in flight, starts spaced 1/rps apart, blocks on 429. */
  #limiter(host: string): HostLimiter {
    let l = this.#limiters.get(host);
    if (!l) {
      l = new HostLimiter(host, this.#policies[host] ?? DEFAULT_POLICY, this.#rateLimit, this.#onEvent);
      this.#limiters.set(host, l);
    }
    return l;
  }

  async #paced(request: Request): Promise<Response> {
    const limiter = this.#limiter(new URL(request.url).host);
    const res = await limiter.run(() => this.transport.fetch(request));
    limiter.observe(res.status, res.headers.get("retry-after"));
    return res;
  }

  /** The error to report for a failed request: a host that is rate limiting says so, and until when. */
  #failure(url: string, attempts: number, err: unknown): Error {
    if (err instanceof RateLimitedError) return err;
    const limiter = this.#limiter(new URL(url).host);
    if (err instanceof HTTPError && err.response.status === 429 && limiter.givenUp) return limiter.error();
    const reason = err instanceof HTTPError ? `HTTP ${err.response.status}` : err instanceof Error ? err.message : String(err);
    return new Error(`fetch failed after ${attempts} attempts: ${url}: ${reason}`);
  }

  async get(url: string, opts: RequestOptions): Promise<FetchResult> {
    const key = cacheKey(url, opts.method, opts.body);
    if (!opts.force) {
      const hit = await this.cache.get(key);
      if (hit) {
        this.stats.cacheHits++;
        return { url, status: hit.entry.httpStatus, body: hit.body, fromCache: true, entry: hit.entry };
      }
    }

    const accept = new Set([200, 404, ...(opts.acceptStatuses ?? [])]);
    let attempts = 1;
    let res: Response;
    try {
      res = await this.#ky(url, {
        method: opts.method ?? "GET",
        headers: opts.body === undefined ? opts.headers : { "Content-Type": "application/json", ...opts.headers },
        body: opts.body,
        throwHttpErrors: (status) => !accept.has(status),
        hooks: {
          beforeRetry: [
            () => {
              attempts++;
              this.stats.retries++;
            },
          ],
        },
      });
    } catch (err) {
      this.stats.errors++;
      if (err instanceof HTTPError && !RETRYABLE.includes(err.response.status)) {
        throw new Error(`unexpected HTTP ${err.response.status} for ${url}`);
      }
      throw this.#failure(url, attempts, err);
    }

    // A HEAD has no body, so the headers worth keeping become the cached body. The
    // status is the signal (Maven .asc probing); Last-Modified dates the release.
    const body = opts.method === "HEAD" ? headBody(res.headers) : await res.text();
    this.stats.fetched++;
    const entry = await this.cache.put({
      url: key,
      body,
      httpStatus: res.status,
      ecosystem: opts.ecosystem,
      package: opts.package,
      requestBody: opts.body,
    });
    return { url, status: res.status, body, fromCache: false, entry };
  }

  async getJson<T = unknown>(url: string, opts: RequestOptions): Promise<{ data: T | null; res: FetchResult }> {
    return parseJsonResult<T>(await this.get(url, opts));
  }

  postJson<T = unknown>(url: string, body: unknown, opts: RequestOptions): Promise<{ data: T | null; res: FetchResult }> {
    return this.getJson<T>(url, { ...opts, method: "POST", body: JSON.stringify(body) });
  }

  /**
   * One request with the client's identity, pacing and retries, but outside the response cache:
   * for the rank stage's bulk inputs (name lists, dumps, index pages), which are stored as files
   * with their own checksums rather than as per-package responses.
   */
  async request(url: string, opts: { headers?: Record<string, string> } = {}): Promise<Response> {
    let attempts = 1;
    try {
      return await this.#ky(url, {
        headers: opts.headers,
        hooks: { beforeRetry: [() => void (attempts++, this.stats.retries++)] },
      });
    } catch (err) {
      this.stats.errors++;
      throw this.#failure(url, attempts, err);
    }
  }

  /**
   * Streams `url` to `dest` and records its sha256 next to it (`dest.json`). A file already
   * downloaded with a matching checksum is reused, so a restarted draw fetches nothing again.
   */
  async download(url: string, dest: string, opts: { headers?: Record<string, string> } = {}): Promise<BulkFile> {
    const sidecar = Bun.file(`${dest}.json`);
    if ((await sidecar.exists()) && (await Bun.file(dest).exists())) {
      const known = (await sidecar.json()) as BulkFile;
      if (known.url === url && (await sha256File(dest)) === known.sha256) return known;
    }
    await mkdir(dirname(dest), { recursive: true });
    const partial = `${dest}.partial`;
    const fetchedAt = new Date().toISOString();
    if (this.transport.download) {
      await this.#limiter(new URL(url).host).run(() => this.transport.download!(url, partial, { "User-Agent": USER_AGENT, ...opts.headers }));
    } else {
      const res = await this.request(url, opts);
      if (!res.body) throw new Error(`empty body: ${url}`);
      const sink = Bun.file(partial).writer();
      for await (const chunk of res.body) sink.write(chunk);
      await sink.end();
    }
    await rename(partial, dest);
    this.stats.fetched++;
    const file: BulkFile = { url, sha256: await sha256File(dest), bytes: Bun.file(dest).size, fetchedAt, path: dest };
    await Bun.write(sidecar, JSON.stringify(file, null, 2) + "\n");
    return file;
  }

  flush(): Promise<void> {
    return this.cache.flush();
  }
}

/** A file the rank stage read in bulk: a name list, a dump, or a stored crawl. */
export interface BulkFile {
  /** What was requested, or how the file was assembled (a paged crawl, a query). */
  url: string;
  sha256: string;
  bytes: number;
  fetchedAt: string;
  /** Local path; not part of the published record. */
  path?: string;
}

/** sha256 of a file, streamed: dumps run to gigabytes. */
export async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of Bun.file(path).stream()) hash.update(chunk);
  return hash.digest("hex");
}

/**
 * What adapters read through: the live client during `fetch`, the cache alone during
 * `extract`. One gathering routine serves both, so `extract` replays exactly the requests
 * `fetch` made — including the data-dependent ones (Go and Maven probe per release).
 */
export interface Source {
  get(url: string, opts: RequestOptions): Promise<FetchResult>;
  getJson<T = unknown>(url: string, opts: RequestOptions): Promise<{ data: T | null; res: FetchResult }>;
  /** POSTs `body` as JSON. Cached like a GET, keyed by the URL and the body's hash. */
  postJson<T = unknown>(url: string, body: unknown, opts: RequestOptions): Promise<{ data: T | null; res: FetchResult }>;
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
    const hit = await this.cache.get(cacheKey(url, opts.method, opts.body));
    if (!hit) throw new CacheMissError(opts.method === "POST" ? `POST ${url}` : url);
    return { url, status: hit.entry.httpStatus, body: hit.body, fromCache: true, entry: hit.entry };
  }

  async getJson<T = unknown>(url: string, opts: RequestOptions): Promise<{ data: T | null; res: FetchResult }> {
    return parseJsonResult<T>(await this.get(url, opts));
  }

  postJson<T = unknown>(url: string, body: unknown, opts: RequestOptions): Promise<{ data: T | null; res: FetchResult }> {
    return this.getJson<T>(url, { ...opts, method: "POST", body: JSON.stringify(body) });
  }
}

/**
 * HEAD and GET of one URL are different facts, so they must not share a cache entry. A POST
 * answers its body, so the body's hash is part of the key.
 */
export function cacheKey(url: string, method: RequestOptions["method"] = "GET", body?: string): string {
  if (method === "HEAD") return `HEAD ${url}`;
  if (method === "POST") return `POST ${url} ${sha256(body ?? "")}`;
  return url;
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

function headBody(headers: Headers): string {
  const kept: Record<string, string> = {};
  for (const h of HEAD_HEADERS) {
    const v = headers.get(h);
    if (v !== null) kept[h] = v;
  }
  return JSON.stringify(kept);
}
