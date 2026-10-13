/**
 * Ranking via ecosyste.ms, for the registries that publish no ranking of their own.
 *
 * ecosyste.ms is a third-party aggregator, so it is used only to *seed* candidate lists
 * (plan §9). Where a registry publishes authoritative counts (npm), the adapter re-counts.
 * Go and Maven publish no download counts anywhere, which is why they rank by dependents.
 */

import type { EcosystemId } from "../types.ts";
import type { HttpClient } from "../http/client.ts";

const BASE = "https://packages.ecosyste.ms/api/v1/registries";

/** Cache key shared by every ranking response, as in the PyPI adapter. */
export const RANKING_CACHE_KEY = "_ranking";

export interface EcosystemsPackage {
  name: string;
  downloads: number | null;
  dependent_packages_count: number | null;
  repository_url?: string | null;
}

export async function rankFromEcosystems(
  http: HttpClient,
  opts: {
    ecosystem: EcosystemId;
    registry: string;
    sort: "downloads" | "dependent_packages_count";
    n: number;
  },
): Promise<EcosystemsPackage[]> {
  const perPage = 100;
  const seen = new Map<string, EcosystemsPackage>();

  for (let page = 1; seen.size < opts.n; page++) {
    const url =
      `${BASE}/${opts.registry}/packages?sort=${opts.sort}&order=desc` +
      `&per_page=${perPage}&page=${page}`;
    const { data } = await http.getJson<EcosystemsPackage[]>(url, {
      ecosystem: opts.ecosystem,
      package: RANKING_CACHE_KEY,
    });
    if (!Array.isArray(data) || data.length === 0) break;
    for (const p of data) if (p?.name && !seen.has(p.name)) seen.set(p.name, p);
    if (data.length < perPage) break;
  }

  if (seen.size === 0) throw new Error(`no packages from ecosyste.ms for ${opts.registry}`);
  // Sort defensively rather than trusting pagination to be stable across pages.
  return [...seen.values()]
    .sort((a, b) => (b[opts.sort] ?? -1) - (a[opts.sort] ?? -1))
    .slice(0, opts.n);
}
