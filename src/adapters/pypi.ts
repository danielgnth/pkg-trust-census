/**
 * PyPI adapter.
 *
 * The cheapest of the seven: one Simple API call returns every file of every version
 * *with* its PEP 740 provenance URL, so the whole quarterly backfill costs a single
 * request. See docs/preflight.md §1.
 */

import type { Candidate } from "../types.ts";
import type { HttpClient } from "../http/client.ts";
import type { EcosystemAdapter } from "./types.ts";

/**
 * Community-maintained daily export of PyPI download counts from Google BigQuery.
 * PyPI publishes no ranking endpoint of its own, so this is the standard source.
 */
const RANKING_URL =
  "https://raw.githubusercontent.com/hugovk/top-pypi-packages/main/top-pypi-packages.json";

/** Pseudo-package name used to key the shared ranking response in the cache. */
export const RANKING_CACHE_KEY = "_ranking";

export const SIMPLE_ACCEPT = "application/vnd.pypi.simple.v1+json";

/** PEP 503: lowercase, and collapse runs of `-`, `_` and `.` to a single `-`. */
export function normalizeName(name: string): string {
  return name.replace(/[-_.]+/g, "-").toLowerCase();
}

export function simpleUrl(name: string): string {
  return `https://pypi.org/simple/${normalizeName(name)}/`;
}

export function jsonUrl(name: string): string {
  // The JSON API accepts the non-normalized name and redirects; normalizing keeps the
  // cache key stable across differently-spelled inputs for the same project.
  return `https://pypi.org/pypi/${normalizeName(name)}/json`;
}

interface RankingFile {
  last_update?: string;
  rows: Array<{ project: string; download_count: number }>;
}

export class PypiAdapter implements EcosystemAdapter {
  readonly id = "pypi" as const;
  readonly rankFrame = "downloads" as const;

  async rank(n: number, http: HttpClient): Promise<Candidate[]> {
    const { data } = await http.getJson<RankingFile>(RANKING_URL, {
      ecosystem: this.id,
      package: RANKING_CACHE_KEY,
    });
    if (!data?.rows?.length) throw new Error(`no rows in PyPI ranking source ${RANKING_URL}`);

    // Sort defensively rather than trusting the file's order.
    const rows = [...data.rows].sort((a, b) => b.download_count - a.download_count);

    return rows.slice(0, n).map((row, i) => ({
      ecosystem: this.id,
      name: normalizeName(row.project),
      rank: i + 1,
      rankFrame: this.rankFrame,
      downloadCount: row.download_count,
      dependentCount: null,
    }));
  }

  async fetch(candidate: Candidate, http: HttpClient): Promise<void> {
    const opts = { ecosystem: this.id, package: candidate.name };

    // Full version history + per-file provenance, in one call.
    await http.get(simpleUrl(candidate.name), {
      ...opts,
      headers: { Accept: SIMPLE_ACCEPT },
    });

    // Authoritative "latest version" plus repository URL. Saves implementing PEP 440
    // ordering just to work out which release is current.
    await http.get(jsonUrl(candidate.name), opts);
  }
}
