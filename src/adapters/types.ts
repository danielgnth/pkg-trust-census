import type { Candidate, EcosystemId, RankFrame } from "../types.ts";
import type { HttpClient } from "../http/client.ts";

/**
 * One implementation per ecosystem. Seven adapters, one contract.
 *
 * The split matters: `rank` and `fetch` are the only network-touching methods, and
 * `fetch` writes nothing but cache entries. Parsing lives in `extract` (added in M3),
 * which is pure and reads only from the cache, so refining a parser never re-hits a
 * registry.
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
  fetch(candidate: Candidate, http: HttpClient): Promise<void>;
}
