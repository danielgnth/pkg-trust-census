/**
 * Per-host pacing. crates.io publishes a crawler policy asking for a descriptive
 * User-Agent with contact info and roughly one request per second; the others are
 * CDN-backed but still get throttled deliberately.
 */

export interface HostPolicy {
  /** Requests per second. */
  rps: number;
  /** Max in-flight requests to this host. */
  concurrency: number;
}

export const DEFAULT_POLICY: HostPolicy = { rps: 4, concurrency: 4 };

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
  "api.npmjs.org": { rps: 5, concurrency: 5 },
  "raw.githubusercontent.com": { rps: 4, concurrency: 4 },
};

export function policyFor(host: string): HostPolicy {
  return HOST_POLICIES[host] ?? DEFAULT_POLICY;
}

interface HostState {
  policy: HostPolicy;
  active: number;
  /** Earliest wall-clock time the next request to this host may start. */
  nextSlot: number;
  queue: Array<() => void>;
}

/**
 * Serialises requests per host: enforces both a minimum interval between starts and a
 * concurrency ceiling. Callers await `acquire()` and invoke the returned release fn.
 */
export class RateLimiter {
  #hosts = new Map<string, HostState>();

  constructor(private readonly overrides: Record<string, HostPolicy> = {}) {}

  #state(host: string): HostState {
    let s = this.#hosts.get(host);
    if (!s) {
      s = {
        policy: this.overrides[host] ?? policyFor(host),
        active: 0,
        nextSlot: 0,
        queue: [],
      };
      this.#hosts.set(host, s);
    }
    return s;
  }

  async acquire(host: string): Promise<() => void> {
    const s = this.#state(host);

    if (s.active >= s.policy.concurrency) {
      await new Promise<void>((resolve) => s.queue.push(resolve));
    }
    s.active++;

    const minInterval = 1000 / s.policy.rps;
    const now = Date.now();
    const start = Math.max(now, s.nextSlot);
    s.nextSlot = start + minInterval;
    if (start > now) await Bun.sleep(start - now);

    let released = false;
    return () => {
      if (released) return;
      released = true;
      s.active--;
      s.queue.shift()?.();
    };
  }

  /** Push the next allowed slot out, e.g. after a 429 with Retry-After. */
  penalise(host: string, ms: number): void {
    const s = this.#state(host);
    s.nextSlot = Math.max(s.nextSlot, Date.now() + ms);
  }
}
