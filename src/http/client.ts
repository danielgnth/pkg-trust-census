/**
 * The shared fetch path for every adapter: identifies the project, paces itself per host
 * (p-queue), retries transient failures (ky), and writes every response through the cache.
 *
 * Two behaviours matter for data integrity:
 *  - A 404 is a *fact* (the package or file does not exist) and is cached and returned.
 *    An exhausted retry budget is an *error* and throws, so it surfaces as `fetch_error`
 *    rather than becoming a silent `false`.
 *  - Resumability comes from the cache, not from bookkeeping: a warm URL is never re-fetched.
 */

import ky, { HTTPError } from "ky";
import PQueue from "p-queue";
import type { EcosystemId, FetchResult } from "../types.ts";
import { ResponseCache, sha256 } from "./cache.ts";
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
const RETRYABLE = [408, 425, 429, 500, 502, 503, 504];

export interface HostPolicy {
  /** Requests per second. */
  rps: number;
  /** Max in-flight requests to this host. */
  concurrency: number;
}

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
  "repo1.maven.org": { rps: 4, concurrency: 4 },
  "sum.golang.org": { rps: 4, concurrency: 4 },
  "proxy.golang.org": { rps: 4, concurrency: 4 },
  "pypi.org": { rps: 5, concurrency: 5 },
  "registry.npmjs.org": { rps: 5, concurrency: 5 },
  // The downloads API answered 5 req/s with HTTP 429 on two thirds of requests (2026-10-13).
  "api.npmjs.org": { rps: 1, concurrency: 1 },
  "raw.githubusercontent.com": { rps: 4, concurrency: 4 },
  // OSV publishes no rate limit; held to the same pace as the registries.
  "api.osv.dev": { rps: 4, concurrency: 4 },
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
  #queues = new Map<string, PQueue>();

  stats = { fetched: 0, cacheHits: 0, retries: 0, errors: 0 };

  constructor(
    opts: {
      cache?: ResponseCache;
      maxRetries?: number;
      transport?: Transport;
      /** Per-host overrides of HOST_POLICIES. */
      policies?: Record<string, HostPolicy>;
    } = {},
  ) {
    this.cache = opts.cache ?? new ResponseCache();
    this.transport = opts.transport ?? defaultTransport();
    this.#policies = { ...HOST_POLICIES, ...opts.policies };
    this.#ky = ky.create({
      // Every attempt, retries included, waits for its host's next slot.
      fetch: (request) => this.#paced(request),
      headers: { "User-Agent": USER_AGENT },
      timeout: 120_000,
      retry: {
        limit: opts.maxRetries ?? 4,
        statusCodes: RETRYABLE,
        // POST is only used for queries (OSV), which are safe to repeat.
        methods: ["get", "head", "post"],
        // Exponential with jitter, capped so a long run cannot stall for minutes.
        delay: (attempt) => 1000 * 2 ** (attempt - 1),
        backoffLimit: 30_000,
        jitter: (d) => d + Math.random() * 250,
        retryOnTimeout: true,
        // A transport failure (connection reset, curl exit) is as transient as a 503.
        shouldRetry: ({ error }) => (error instanceof HTTPError ? undefined : true),
      },
    });
  }

  /** One queue per host: at most `concurrency` in flight, starts spaced 1/rps apart. */
  #queue(host: string): PQueue {
    let q = this.#queues.get(host);
    if (!q) {
      const { rps, concurrency } = this.#policies[host] ?? DEFAULT_POLICY;
      q = new PQueue({ concurrency, intervalCap: 1, interval: 1000 / rps, strict: true });
      this.#queues.set(host, q);
    }
    return q;
  }

  async #paced(request: Request): Promise<Response> {
    const q = this.#queue(new URL(request.url).host);
    const res = await q.add(() => this.transport.fetch(request));
    // ky waits out Retry-After for this request; pausing the queue holds back the rest of
    // the host's traffic too, which is what the header asks for.
    const retryAfter = Number(res.headers.get("retry-after"));
    if (RETRYABLE.includes(res.status) && retryAfter > 0) {
      q.pause();
      setTimeout(() => q.start(), retryAfter * 1000);
    }
    return res;
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
      const reason = err instanceof HTTPError ? `HTTP ${err.response.status}` : err instanceof Error ? err.message : String(err);
      throw new Error(`fetch failed after ${attempts} attempts: ${url}: ${reason}`);
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
