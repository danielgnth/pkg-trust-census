/**
 * One host's pacing, and how it answers rate limiting.
 *
 * p-queue spaces requests to the host's policy. A 429 then holds back the whole host, not just the
 * request that met it: every request waits out the block (`Retry-After` when the host sends one,
 * otherwise a backoff that doubles with each 429 in a row), and the host is slowed to one request at
 * a time at half its pace or less. It speeds up again in small steps, each after a run of successful
 * responses, and never back past 80% of the rate that met the 429: a host whose limit lies below its
 * policy settles under that limit instead of meeting it again and again.
 *
 * Waiting is bounded. Once a host has answered 429 for longer than the patience allows, its requests
 * fail with a `RateLimitedError` without being sent until the current block ends, so a stage records
 * them and moves on rather than probing a host that asked to be left alone. Maven Central warns that
 * retrying harder lengthens its blocks (source `mavenConsumptionLimits`).
 */

import PQueue from "p-queue";

export interface HostPolicy {
  /** Requests per second. */
  rps: number;
  /** Max in-flight requests to this host. */
  concurrency: number;
}

export interface RateLimitOptions {
  /** How long a host may keep answering 429 before its requests fail instead of waiting (ms). */
  patienceMs: number;
  /** The block after a 429 without `Retry-After`; it doubles with each 429 in a row (ms). */
  firstBlockMs: number;
  maxBlockMs: number;
  /** Successful responses after which a slowed host speeds up one step, of a tenth of its policy's rate. */
  recoverAfter: number;
  /** The slowest a host is slowed to: one request per this many ms. */
  maxSpacingMs: number;
}

const patienceMinutes = Number(process.env.PKG_TRUST_RATE_LIMIT_PATIENCE);

export const DEFAULT_RATE_LIMIT: RateLimitOptions = {
  patienceMs: (patienceMinutes > 0 ? patienceMinutes : 60) * 60_000,
  firstBlockMs: 30_000,
  maxBlockMs: 10 * 60_000,
  recoverAfter: 50,
  maxSpacingMs: 10_000,
};

/** Statuses that mean "not now" rather than an answer. */
export const RETRYABLE = [408, 425, 429, 500, 502, 503, 504];

export class RateLimitedError extends Error {
  constructor(
    readonly host: string,
    readonly until: Date,
    limitedForMs: number,
  ) {
    const since = limitedForMs >= 1000 ? ` for ${duration(limitedForMs)}` : "";
    super(`${host} is rate limiting (HTTP 429${since}); not retrying before ${until.toISOString()} — re-run the stage then`);
    this.name = "RateLimitedError";
  }
}

/** `Retry-After` as delay-seconds or an HTTP date, in ms from `now`; null when absent or unreadable. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (value === null) return null;
  const v = value.trim();
  if (/^\d+$/.test(v)) return Number(v) * 1000;
  const at = Date.parse(v);
  return Number.isFinite(at) ? Math.max(0, at - now) : null;
}

export class HostLimiter {
  readonly #queue: PQueue;
  readonly #interval: number;
  #blockedUntil = 0;
  #nextStart = 0;
  /** Spacing between request starts while slowed, on top of the policy's (ms); 0 when not slowed. */
  #spacing = 0;
  /** The fastest the host may go: 80% of the rate that last met a 429, else its policy (req/s). */
  #ceiling: number;
  /** First 429 since the last successful response; null when the host is not limiting. */
  #limitedSince: number | null = null;
  #blocks = 0;
  #okSinceSlowed = 0;
  #gaveUpUntil = 0;

  constructor(
    readonly host: string,
    readonly policy: HostPolicy,
    readonly opts: RateLimitOptions = DEFAULT_RATE_LIMIT,
    readonly onEvent?: (message: string) => void,
  ) {
    this.#interval = 1000 / policy.rps;
    this.#ceiling = policy.rps;
    this.#queue = new PQueue({ concurrency: policy.concurrency, intervalCap: 1, interval: this.#interval, strict: true });
  }

  /** Runs `fn` in the host's next slot, after any block; throws at once while the host is given up on. */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    this.#throwIfGivenUp();
    return this.#queue.add(async () => {
      await this.#gate();
      return fn();
    });
  }

  /** Whether requests to this host fail instead of waiting. */
  get givenUp(): boolean {
    return Date.now() < this.#gaveUpUntil;
  }

  error(): RateLimitedError {
    const now = Date.now();
    return new RateLimitedError(this.host, new Date(Math.max(this.#gaveUpUntil, now)), now - (this.#limitedSince ?? now));
  }

  /** Requests per second the host is currently held to. */
  get rate(): number {
    return 1000 / Math.max(this.#interval, this.#spacing);
  }

  /** Feeds a response's status back: a 429 blocks and slows the host, a success lets it recover. */
  observe(status: number, retryAfter: string | null): void {
    const now = Date.now();
    const after = parseRetryAfter(retryAfter, now);
    if (status === 429) return this.#limited(now, after);
    if (RETRYABLE.includes(status)) {
      if (after !== null) this.#blockedUntil = Math.max(this.#blockedUntil, now + after);
      return;
    }
    this.#limitedSince = null;
    this.#blocks = 0;
    if (this.#spacing > 0 && ++this.#okSinceSlowed >= this.opts.recoverAfter) this.#speedUp();
  }

  #limited(now: number, after: number | null): void {
    // Requests already in flight when the block began answer 429 too; they are the same block.
    const sameBlock = now < this.#blockedUntil;
    if (!sameBlock) this.#blocks++;
    this.#limitedSince ??= now;
    const wait = after ?? Math.min(this.opts.firstBlockMs * 2 ** (this.#blocks - 1), this.opts.maxBlockMs);
    this.#blockedUntil = Math.max(this.#blockedUntil, now + wait);
    if (sameBlock) return;

    this.#okSinceSlowed = 0;
    const slowest = 1000 / this.opts.maxSpacingMs;
    this.#ceiling = Math.max(Math.min(this.#ceiling, this.rate * 0.8), slowest);
    this.#spacing = Math.min(Math.max(this.#spacing * 2, this.#interval * 2, 1000 / this.#ceiling), this.opts.maxSpacingMs);
    this.#queue.concurrency = 1;
    if (this.#blockedUntil - this.#limitedSince > this.opts.patienceMs) {
      this.#gaveUpUntil = this.#blockedUntil;
      this.onEvent?.(`${this.host}: ${this.error().message}`);
    } else {
      this.onEvent?.(
        `${this.host}: HTTP 429, pausing ${duration(wait)} (${after !== null ? "Retry-After" : "backoff"}), ` +
          `then ${formatRate(this.rate)}, one at a time; staying under ${formatRate(this.#ceiling)} from now on`,
      );
    }
  }

  #speedUp(): void {
    this.#okSinceSlowed = 0;
    // The spacing paces request starts; with it in place, the policy's concurrency can return.
    this.#queue.concurrency = this.policy.concurrency;
    const before = this.rate;
    const next = Math.min(before + this.policy.rps / 10, this.#ceiling);
    if (next <= before) return;
    this.#spacing = next >= this.policy.rps ? 0 : 1000 / next;
    this.onEvent?.(`${this.host}: ${this.#spacing ? "speeding up to" : "back to"} ${formatRate(this.rate)}`);
  }

  /** Waits for the end of a block and the slowed pace, re-checking as both can change while waiting. */
  async #gate(): Promise<void> {
    for (;;) {
      this.#throwIfGivenUp();
      const now = Date.now();
      const at = Math.max(this.#blockedUntil, this.#nextStart);
      if (at <= now) {
        this.#nextStart = now + this.#spacing;
        return;
      }
      await Bun.sleep(Math.min(at - now, 1000));
    }
  }

  #throwIfGivenUp(): void {
    if (this.givenUp) throw this.error();
  }
}

function duration(ms: number): string {
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)} s`;
  return ms < 120_000 ? `${Math.round(ms / 1000)} s` : `${Math.round(ms / 60_000)} min`;
}

function formatRate(rps: number): string {
  return rps >= 1 ? `${Math.round(rps * 10) / 10} req/s` : `1 req per ${Math.round(1 / rps)} s`;
}
