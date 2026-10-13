import type { Candidate, EcosystemId, ExtractedPackage, RankFrame } from "../types.ts";
import type { HttpClient, Source } from "../http/client.ts";

/**
 * Per-run context shared by `fetch` and `extract`.
 *
 * `asOf` is the snapshot's start time, never "now": quarter anchors and the versions they
 * select must come out identical whether `extract` runs a minute or a month after `fetch`,
 * or `extract` would ask the cache for responses that were never fetched.
 */
export interface RunContext {
  asOf: Date;
}

/**
 * One implementation per ecosystem. Seven adapters, one contract.
 *
 * `rank` and `fetch` are the only network-touching methods, and `fetch` writes nothing but
 * cache entries. `extract` is pure: it reads only from the cache, so refining a parser
 * never re-hits a registry.
 */
export interface EcosystemAdapter {
  readonly id: EcosystemId;

  /** Downloads where the registry publishes them; dependents for Go and Maven. */
  readonly rankFrame: RankFrame;

  /** Top `n` packages, already ordered and rank-numbered from 1. */
  rank(n: number, http: HttpClient): Promise<Candidate[]>;

  /**
   * Fetches everything `extract` will need for this package into the cache.
   * Cached URLs are skipped by the client, so this is safe to re-run.
   */
  fetch(candidate: Candidate, http: Source, ctx: RunContext): Promise<void>;

  /** Parses the cached responses into versions and signals. Never touches the network. */
  extract(candidate: Candidate, cache: Source, ctx: RunContext): Promise<ExtractedPackage>;
}

/**
 * Base for adapters whose `fetch` and `extract` walk the same requests.
 *
 * `gather` is written once and run twice — against the network to warm the cache, then
 * against the cache to parse — so the two stages cannot drift apart. That matters most
 * for Go and Maven, where which releases get probed depends on dates read mid-walk.
 */
export abstract class GatheringAdapter<Raw> implements EcosystemAdapter {
  abstract readonly id: EcosystemId;
  abstract readonly rankFrame: RankFrame;
  abstract rank(n: number, http: HttpClient): Promise<Candidate[]>;

  protected abstract gather(candidate: Candidate, src: Source, ctx: RunContext): Promise<Raw>;
  protected abstract build(candidate: Candidate, raw: Raw, ctx: RunContext): ExtractedPackage;

  async fetch(candidate: Candidate, http: Source, ctx: RunContext): Promise<void> {
    await this.gather(candidate, http, ctx);
  }

  async extract(candidate: Candidate, cache: Source, ctx: RunContext): Promise<ExtractedPackage> {
    return this.build(candidate, await this.gather(candidate, cache, ctx), ctx);
  }
}
