/**
 * Packagist adapter — the ecosystem with no trust mechanism of any kind.
 *
 * Packagist does not host artifacts: it indexes VCS tags, and Composer downloads the
 * archive from the forge. There is no upload step to authenticate, nothing to sign and no
 * attestation format, so four of five signals are `no_mechanism` by construction. That is
 * a substantive result, and the point of keeping this ecosystem in the sample.
 */

import type { Candidate, ExtractedPackage, FetchResult } from "../types.ts";
import type { HttpClient, Source } from "../http/client.ts";
import { GatheringAdapter, type RunContext } from "./types.ts";
import { RANKING_CACHE_KEY } from "./ecosystems.ts";
import { cleanRepoUrl, noMechanism, observed, selectKeptVersions } from "../extract/signals.ts";
import { isComposerBranch, isComposerPrerelease } from "../extract/versions.ts";
import type { PersonalData } from "../publish/redact.ts";

interface PopularPage {
  packages: Array<{ name: string; downloads: number }>;
  next?: string | null;
}

interface PackageDoc {
  package?: {
    versions?: Record<string, { time?: string; source?: { type?: string; url?: string; reference?: string } }>;
    maintainers?: unknown[];
    repository?: string;
  };
}

interface Raw {
  doc: NonNullable<PackageDoc["package"]>;
  res: FetchResult;
}

export class PackagistAdapter extends GatheringAdapter<Raw> {
  readonly id = "packagist" as const;
  readonly rankFrame = "downloads" as const;

  /** Packagist's own popularity order; the count it reports alongside is all-time. */
  async rank(n: number, http: HttpClient): Promise<Candidate[]> {
    const rows: PopularPage["packages"] = [];
    let url: string | null = "https://packagist.org/explore/popular.json?per_page=100";
    while (url && rows.length < n) {
      const { data }: { data: PopularPage | null } = await http.getJson<PopularPage>(url, {
        ecosystem: this.id,
        package: RANKING_CACHE_KEY,
      });
      if (!data?.packages?.length) break;
      rows.push(...data.packages);
      url = data.next ?? null;
    }
    if (rows.length === 0) throw new Error("no packages returned by Packagist popular.json");

    return rows.slice(0, n).map((r, i) => ({
      ecosystem: this.id,
      name: r.name,
      layer: "top" as const,
      rank: i + 1,
      rankFrame: this.rankFrame,
      downloadCount: r.downloads,
      dependentCount: null,
    }));
  }

  protected async gather(candidate: Candidate, src: Source): Promise<Raw> {
    const { data, res } = await src.getJson<PackageDoc>(`https://packagist.org/packages/${candidate.name}.json`, {
      ecosystem: this.id,
      package: candidate.name,
    });
    if (!data?.package) throw new Error(`Packagist has no package "${candidate.name}" (HTTP ${res.status})`);
    return { doc: data.package, res };
  }

  protected build(candidate: Candidate, raw: Raw, ctx: RunContext): ExtractedPackage {
    // Branch aliases (`dev-main`, `2.x-dev`) are moving targets, not releases.
    const records = Object.entries(raw.doc.versions ?? {})
      .filter(([v]) => !isComposerBranch(v))
      .map(([version, v]) => ({ version, publishedAt: v.time ?? null, prerelease: isComposerPrerelease(version) }));
    // Packagist names no current version; the newest stable tag is what Composer resolves.
    const kept = selectKeptVersions(records, null, ctx.asOf);
    const latest = kept.find((k) => k.isLatest)?.record;
    const maintainers = raw.doc.maintainers;

    return {
      ecosystem: this.id,
      name: candidate.name,
      latestVersion: latest?.version ?? null,
      latestPublishDate: latest?.publishedAt ?? null,
      maintainerCount: Array.isArray(maintainers) ? maintainers.length : null,
      maintainerCountSource: Array.isArray(maintainers) ? "packagist maintainers[]" : "unavailable",
      repositoryUrl: cleanRepoUrl(raw.doc.repository),
      fetchError: null,
      versions: kept.map(({ record, isLatest, quarterAnchor }) => {
        const src = raw.doc.versions?.[record.version]?.source;
        return {
          version: record.version,
          publishedAt: record.publishedAt,
          isLatest,
          quarterAnchor,
          signals: [
            noMechanism("identity_publish", "Packagist indexes VCS tags; there is no upload to authenticate"),
            noMechanism("artifact_signature", "Composer archives carry no signature"),
            noMechanism("registry_integrity", "Packagist does not sign metadata or archives"),
            noMechanism("build_provenance", "Packagist has no attestation format"),
            // Releases *are* VCS tags: Packagist resolves each to a commit itself, as Go's proxy does.
            observed(
              "source_link",
              src?.reference ? `${src.url ?? "vcs"}@${src.reference}` : null,
              "packagist.org /packages/{p}.json versions[v].source.reference",
              raw.res,
            ),
            noMechanism("transparency_log", "Packagist publishes to no transparency log"),
            noMechanism("mfa_enforced", "Packagist MFA is optional and not enforced"),
          ],
        };
      }),
    };
  }
}

/** Packagist names maintainers (with avatars) per package and authors per version, in both of its APIs. */
export const PERSONAL_DATA: PersonalData[] = [
  {
    ecosystem: "packagist",
    endpoint: "packagist.org /packages/{p}.json",
    matches: (url) => /^https:\/\/packagist\.org\/packages\/.+\.json$/.test(url),
    paths: ["package.maintainers", "package.versions.*.authors"],
  },
  {
    ecosystem: "packagist",
    endpoint: "repo.packagist.org /p2/{p}.json (the random draw's activity check)",
    matches: (url) => url.startsWith("https://repo.packagist.org/p2/"),
    paths: ["packages.*.*.authors"],
  },
]
