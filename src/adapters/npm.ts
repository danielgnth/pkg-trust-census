/**
 * npm adapter.
 *
 * One full packument per package carries every version's `dist` block, the `time` map the
 * backfill needs, and `maintainers` — the abbreviated packument drops the last two, so the
 * multi-megabyte full form is mandatory (preflight §4).
 *
 * Trusted publishing is *observable* on npm: versions published through it carry
 * `_npmUser.trustedPublisher`. Verified live against `sigstore@5.0.0` on 2026-10-13.
 */

import type { Candidate, ExtractedPackage, FetchResult } from "../types.ts";
import type { HttpClient, Source } from "../http/client.ts";
import { GatheringAdapter, type RunContext } from "./types.ts";
import { RANKING_CACHE_KEY, rankFromEcosystems } from "./ecosystems.ts";
import { cleanRepoUrl, notExposed, observed, selectKeptVersions } from "../extract/signals.ts";
import { isSemverPrerelease } from "../extract/versions.ts";

const DOWNLOADS = "https://api.npmjs.org/downloads/point/last-month";

/** The bulk downloads endpoint accepts at most 128 unscoped names per call. */
const BULK_LIMIT = 128;

/** Scoped names keep their `@` but must encode the `/`, or the registry reads a path. */
export function packumentUrl(name: string): string {
  return `https://registry.npmjs.org/${name.replace("/", "%2F")}`;
}

interface Manifest {
  _npmUser?: { name?: string; trustedPublisher?: { id?: string; oidcConfigId?: string } };
  dist?: {
    signatures?: Array<{ keyid?: string; sig?: string }>;
    attestations?: { url?: string; provenance?: { predicateType?: string } };
  };
}

interface Packument {
  "dist-tags"?: { latest?: string };
  time?: Record<string, string>;
  versions?: Record<string, Manifest>;
  maintainers?: unknown[];
  repository?: string | { url?: string };
}

interface Raw {
  doc: Packument;
  res: FetchResult;
}

const SRC = "registry.npmjs.org/{p} versions[v]";

export class NpmAdapter extends GatheringAdapter<Raw> {
  readonly id = "npm" as const;
  readonly rankFrame = "downloads" as const;

  /**
   * Seeds from ecosyste.ms, then re-counts with npm's own downloads API so the published
   * number is first-party. The seed is oversampled because re-counting can reorder it.
   */
  async rank(n: number, http: HttpClient): Promise<Candidate[]> {
    const seed = await rankFromEcosystems(http, {
      ecosystem: this.id,
      registry: "npmjs.org",
      sort: "downloads",
      n: Math.ceil(n * 1.2),
    });

    const counts = await this.#downloadCounts(seed.map((p) => p.name), http);
    return seed
      .map((p) => ({ name: p.name, downloads: counts.get(p.name) ?? p.downloads }))
      .filter((p): p is { name: string; downloads: number } => p.downloads != null)
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, n)
      .map((p, i) => ({
        ecosystem: this.id,
        name: p.name,
        rank: i + 1,
        rankFrame: this.rankFrame,
        downloadCount: p.downloads,
        dependentCount: null,
      }));
  }

  async #downloadCounts(names: string[], http: HttpClient): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    const opts = { ecosystem: this.id, package: RANKING_CACHE_KEY };
    // The bulk endpoint rejects scoped names, so those are counted one by one.
    const unscoped = names.filter((n) => !n.startsWith("@"));
    const scoped = names.filter((n) => n.startsWith("@"));

    for (let i = 0; i < unscoped.length; i += BULK_LIMIT) {
      const batch = unscoped.slice(i, i + BULK_LIMIT);
      const { data } = await http.getJson<Record<string, { downloads?: number } | null>>(
        `${DOWNLOADS}/${batch.join(",")}`,
        opts,
      );
      for (const [name, row] of Object.entries(data ?? {})) {
        if (typeof row?.downloads === "number") out.set(name, row.downloads);
      }
    }
    for (const name of scoped) {
      const { data } = await http.getJson<{ downloads?: number }>(`${DOWNLOADS}/${name}`, opts);
      if (typeof data?.downloads === "number") out.set(name, data.downloads);
    }
    return out;
  }

  protected async gather(candidate: Candidate, src: Source): Promise<Raw> {
    const { data, res } = await src.getJson<Packument>(packumentUrl(candidate.name), {
      ecosystem: this.id,
      package: candidate.name,
      // Explicitly *not* the abbreviated install format, which drops `time` and `maintainers`.
      headers: { Accept: "application/json" },
    });
    if (!data?.versions) throw new Error(`npm has no package "${candidate.name}" (HTTP ${res.status})`);
    return { doc: data, res };
  }

  protected build(candidate: Candidate, raw: Raw, ctx: RunContext): ExtractedPackage {
    const { doc } = raw;
    const versions = doc.versions ?? {};
    const records = Object.keys(versions).map((version) => ({
      version,
      publishedAt: doc.time?.[version] ?? null,
      prerelease: isSemverPrerelease(version),
    }));
    const kept = selectKeptVersions(records, doc["dist-tags"]?.latest ?? null, ctx.asOf);
    const latest = kept.find((k) => k.isLatest)?.record;
    const rawRef = { path: raw.res.entry.path, sha256: raw.res.entry.sha256 };

    return {
      ecosystem: this.id,
      name: candidate.name,
      latestVersion: latest?.version ?? doc["dist-tags"]?.latest ?? null,
      latestPublishDate: latest?.publishedAt ?? null,
      maintainerCount: Array.isArray(doc.maintainers) ? doc.maintainers.length : null,
      maintainerCountSource: Array.isArray(doc.maintainers) ? "packument maintainers[]" : "unavailable",
      repositoryUrl: cleanRepoUrl(typeof doc.repository === "string" ? doc.repository : doc.repository?.url),
      fetchError: null,
      versions: kept.map(({ record, isLatest, quarterAnchor }) => ({
        version: record.version,
        publishedAt: record.publishedAt,
        isLatest,
        quarterAnchor,
        signals: signalsFor(versions[record.version] ?? {}),
        raw: rawRef,
      })),
    };
  }
}

function signalsFor(m: Manifest) {
  const tp = m._npmUser?.trustedPublisher;
  const att = m.dist?.attestations;
  const predicate = att?.provenance?.predicateType;
  const slsa = att?.url && predicate?.includes("slsa.dev/provenance") ? `${att.url} (${predicate})` : null;
  const sig = m.dist?.signatures?.[0];

  return [
    observed(
      "identity_publish",
      tp ? `${tp.id ?? "unknown"} trusted publisher (${tp.oidcConfigId ?? "no config id"})` : null,
      `${SRC}._npmUser.trustedPublisher`,
    ),
    // The provenance bundle is a Sigstore signature over the tarball digest, made by the
    // publisher's CI identity. `dist.signatures` does not count here: the registry applies
    // it to every tarball, so a hijacked account's upload is "signed" too.
    observed("artifact_signature", att?.url ?? null, `${SRC}.dist.attestations (Sigstore, publisher CI identity)`),
    // Registry-applied on serve, including to 2016-era tarballs (preflight §3.4).
    observed(
      "registry_integrity",
      sig ? `registry signature, keyid ${sig.keyid ?? "unknown"}` : null,
      `${SRC}.dist.signatures (registry-applied)`,
    ),
    observed("build_provenance", slsa, `${SRC}.dist.attestations.provenance.predicateType`),
    // SLSA provenance names the source repository and commit, signed by the builder.
    observed("source_link", slsa, `${SRC}.dist.attestations (SLSA resolvedDependencies)`),
    // npm provenance is only accepted from public repositories, and its statements are
    // logged in the public Rekor instance.
    observed("transparency_log", att?.url ?? null, `${SRC}.dist.attestations (Sigstore, Rekor-logged)`),
    notExposed("mfa_enforced", "npm's per-package 'require 2FA' setting is not in the packument"),
  ];
}
