/**
 * crates.io adapter.
 *
 * The only registry that reports trusted publishing *directly* (`trustpub_data`), and the
 * only one with no signing or attestation scheme at all — so it is the clean test of
 * whether the data model keeps "observable" and "no mechanism" apart.
 *
 * crates.io's crawler policy asks for ~1 request per second with an identifying
 * User-Agent, and enforces the latter with a 403. Both are configured in the HTTP layer.
 */

import type { Candidate, ExtractedPackage, FetchResult } from "../types.ts";
import type { HttpClient, Source } from "../http/client.ts";
import { GatheringAdapter, type RunContext } from "./types.ts";
import { RANKING_CACHE_KEY } from "./ecosystems.ts";
import {
  cleanRepoUrl,
  noMechanism,
  observed,
  selectKeptVersions,
  type VersionRecord,
  withdrawalIn,
} from "../extract/signals.ts";
import { quarterBoundaries, withdrawalWindowStart } from "../extract/quarters.ts";
import { isSemverPrerelease } from "../extract/versions.ts";

const API = "https://crates.io/api/v1";

interface CrateSummary {
  name: string;
  downloads: number;
  recent_downloads: number | null;
}

interface CrateVersion {
  num: string;
  created_at: string;
  yanked: boolean;
  trustpub_data?: { provider?: string; repository?: string; run_id?: string; sha?: string } | null;
}

interface VersionsPage {
  versions: CrateVersion[];
  meta?: { next_page?: string | null };
}

interface Raw {
  versions: Array<{ v: CrateVersion; res: FetchResult }>;
  crate: { default_version?: string; repository?: string | null } | null;
  owners: Array<{ kind?: string }> | null;
}

interface CrateRecord extends VersionRecord {
  v: CrateVersion;
  res: FetchResult;
}

const SRC = "crates.io /api/v1/crates/{c}/versions trustpub_data";

export class CratesAdapter extends GatheringAdapter<Raw> {
  readonly id = "crates" as const;
  readonly rankFrame = "downloads" as const;

  /**
   * Ranked by downloads over the last 90 days rather than all-time: all-time favours
   * crates that were central years ago, and every other ecosystem here uses a recent window.
   */
  async rank(n: number, http: HttpClient): Promise<Candidate[]> {
    const out: CrateSummary[] = [];
    let next: string | null = "?sort=recent-downloads&per_page=100";
    while (next && out.length < n) {
      const { data }: { data: { crates: CrateSummary[]; meta?: { next_page?: string | null } } | null } =
        await http.getJson(`${API}/crates${next}`, { ecosystem: this.id, package: RANKING_CACHE_KEY });
      if (!data?.crates?.length) break;
      out.push(...data.crates);
      next = data.meta?.next_page ?? null;
    }
    if (out.length === 0) throw new Error("no crates returned by crates.io ranking");

    return out
      .filter((c) => c.recent_downloads != null)
      .sort((a, b) => b.recent_downloads! - a.recent_downloads!)
      .slice(0, n)
      .map((c, i) => ({
        ecosystem: this.id,
        name: c.name,
        rank: i + 1,
        rankFrame: this.rankFrame,
        downloadCount: c.recent_downloads,
        dependentCount: null,
      }));
  }

  /**
   * Walks version pages newest-first and stops once it holds a stable release from before
   * the first quarter boundary — the oldest version any anchor can select. Most crates
   * need one page; the walk is deterministic, so `extract` replays the same pages.
   */
  protected async gather(candidate: Candidate, src: Source, ctx: RunContext): Promise<Raw> {
    const opts = { ecosystem: this.id, package: candidate.name };
    const enc = encodeURIComponent(candidate.name);
    const firstBoundary = quarterBoundaries(ctx.asOf)[0]?.at.getTime() ?? Date.parse(ctx.asOf.toISOString());

    const versions: Raw["versions"] = [];
    let next: string | null = "?per_page=100&sort=date";
    while (next) {
      const { data, res }: { data: VersionsPage | null; res: FetchResult } = await src.getJson<VersionsPage>(
        `${API}/crates/${enc}/versions${next}`,
        opts,
      );
      if (!data) throw new Error(`crates.io has no crate "${candidate.name}" (HTTP ${res.status})`);
      for (const v of data.versions) versions.push({ v, res });
      const reachedHistory = data.versions.some(
        (v) => !v.yanked && !isSemverPrerelease(v.num) && Date.parse(v.created_at) <= firstBoundary,
      );
      next = reachedHistory ? null : (data.meta?.next_page ?? null);
    }

    const { data: crate } = await src.getJson<{ crate?: Raw["crate"] }>(
      `${API}/crates/${enc}?include=default_version`,
      opts,
    );
    const { data: owners } = await src.getJson<{ users?: Raw["owners"] }>(`${API}/crates/${enc}/owners`, opts);
    return { versions, crate: crate?.crate ?? null, owners: owners?.users ?? null };
  }

  protected build(candidate: Candidate, raw: Raw, ctx: RunContext): ExtractedPackage {
    const records: CrateRecord[] = raw.versions.map(({ v, res }) => ({
      version: v.num,
      publishedAt: v.created_at,
      prerelease: isSemverPrerelease(v.num),
      yanked: v.yanked,
      v,
      res,
    }));
    const kept = selectKeptVersions(records, raw.crate?.default_version ?? null, ctx.asOf);
    const latest = kept.find((k) => k.isLatest)?.record;
    // Teams are groups of people with their own membership; counting them as one
    // maintainer would understate, counting their members needs GitHub — so users only.
    const users = raw.owners?.filter((o) => o.kind === "user");

    return {
      ecosystem: this.id,
      name: candidate.name,
      latestVersion: latest?.version ?? raw.crate?.default_version ?? null,
      latestPublishDate: latest?.publishedAt ?? null,
      maintainerCount: users ? users.length : null,
      maintainerCountSource: users ? "crates.io owners (users; teams excluded)" : "unavailable",
      repositoryUrl: cleanRepoUrl(raw.crate?.repository),
      fetchError: null,
      versions: kept.map(({ record, isLatest, quarterAnchor }) => {
        const tp = record.v.trustpub_data;
        return {
          version: record.version,
          publishedAt: record.publishedAt,
          isLatest,
          quarterAnchor,
          signals: [
            observed(
              "identity_publish",
              tp ? `${tp.provider}:${tp.repository} run ${tp.run_id} @ ${tp.sha}` : null,
              SRC,
            ),
            noMechanism("artifact_signature", "crates.io has no artifact signing scheme"),
            noMechanism("registry_integrity", "index checksums are served over TLS but not signed"),
            noMechanism("build_provenance", "crates.io has no attestation scheme"),
            // Taken by crates.io from the CI provider's signed OIDC token at publish time,
            // so the uploader cannot simply assert it.
            observed("source_link", tp?.sha ? `${tp.repository}@${tp.sha} (run ${tp.run_id})` : null, `${SRC}.sha`),
            noMechanism("transparency_log", "crates.io publishes to no transparency log"),
            noMechanism("mfa_enforced", "crates.io has no MFA; publishing authenticates with API tokens"),
          ],
          raw: { path: record.res.entry.path, sha256: record.res.entry.sha256 },
        };
      }),
      withdrawals: [
        withdrawalIn(
          "yanked",
          records.map((r) => ({ version: r.version, publishedAt: r.publishedAt, withdrawn: Boolean(r.yanked) })),
          withdrawalWindowStart(ctx.asOf),
          ctx.asOf,
        ),
      ],
    };
  }
}
