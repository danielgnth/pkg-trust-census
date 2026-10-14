/**
 * npm adapter.
 *
 * One full packument per package carries every version's `dist` block, the `time` map the
 * backfill needs, and `maintainers` — the abbreviated packument drops the last two, so the
 * multi-megabyte full form is mandatory (docs/registries.md#npm).
 *
 * Trusted publishing is *observable* on npm: versions published through it carry
 * `_npmUser.trustedPublisher`. Verified live against `sigstore@5.0.0` on 2026-10-13.
 *
 * MFA is inferred from npm's high-impact rule: maintainers of a package with more than 1M
 * weekly downloads or 500 dependents must have 2FA. Each kept release on or after the
 * rule's start costs one downloads request for the week npm would have judged it by.
 */

import type { Candidate, ExtractedPackage, ExtractedSignal, FetchResult } from "../types.ts";
import type { HttpClient, Source } from "../http/client.ts";
import { GatheringAdapter, type RunContext } from "./types.ts";
import { RANKING_CACHE_KEY, rankFromEcosystems } from "./ecosystems.ts";
import {
  type KeptVersion,
  type VersionRecord,
  cleanRepoUrl,
  observed,
  selectKeptVersions,
  signal,
  withdrawalIn,
} from "../extract/signals.ts";
import { withdrawalWindowStart } from "../extract/quarters.ts";
import { isSemverPrerelease } from "../extract/versions.ts";

const DOWNLOADS = "https://api.npmjs.org/downloads/point/last-month";

/** The bulk downloads endpoint accepts at most 128 unscoped names per call. */
const BULK_LIMIT = 128;

/** 2FA enforced for maintainers of every high-impact package from this date; see src/facts. */
export const NPM_HIGH_IMPACT_2FA = "2022-11-01T00:00:00Z";

/** "More than 1 million weekly downloads". The 500-dependents half is not in any public API. */
const HIGH_IMPACT_WEEKLY = 1_000_000;

/**
 * Maintainers are notified 15 days before 2FA is enforced, so a release counts only if its
 * package was already high-impact that long before it was published.
 */
const NOTICE_DAYS = 15;

const DAY_MS = 86_400_000;

/**
 * The week that decides a release's MFA signal, as `start:end` (inclusive days): the seven
 * days ending `NOTICE_DAYS` before its publication day. Null before the rule's start, where
 * no download count could make it `true`.
 */
export function highImpactWindow(publishedAt: string | null): string | null {
  const t = publishedAt ? Date.parse(publishedAt) : NaN;
  if (!Number.isFinite(t) || t < Date.parse(NPM_HIGH_IMPACT_2FA)) return null;
  const end = Math.floor(t / DAY_MS) * DAY_MS - NOTICE_DAYS * DAY_MS;
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return `${iso(end - 6 * DAY_MS)}:${iso(end)}`;
}

/** Scoped names keep their `/` here: unlike the packument, this endpoint accepts it. */
export function windowDownloadsUrl(name: string, window: string): string {
  return `https://api.npmjs.org/downloads/point/${window}/${name}`;
}

/** Scoped names keep their `@` but must encode the `/`, or the registry reads a path. */
export function packumentUrl(name: string): string {
  return `https://registry.npmjs.org/${name.replace("/", "%2F")}`;
}

interface Manifest {
  /** Set by `npm deprecate`: the version still installs, with a warning. */
  deprecated?: string;
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

interface NpmRecord extends VersionRecord {
  /** Downloads in the `highImpactWindow` week; null when npm has no count for it. */
  weekly?: { downloads: number | null; window: string; res: FetchResult };
}

interface Raw {
  doc: Packument;
  res: FetchResult;
  kept: KeptVersion<NpmRecord>[];
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

  protected async gather(candidate: Candidate, src: Source, ctx: RunContext): Promise<Raw> {
    const { data, res } = await src.getJson<Packument>(packumentUrl(candidate.name), {
      ecosystem: this.id,
      package: candidate.name,
      // Explicitly *not* the abbreviated install format, which drops `time` and `maintainers`.
      headers: { Accept: "application/json" },
    });
    if (!data?.versions) throw new Error(`npm has no package "${candidate.name}" (HTTP ${res.status})`);

    // Kept versions are chosen here rather than in `build`, because which downloads
    // windows to request depends on them and `fetch` must request the same ones.
    const records: NpmRecord[] = Object.keys(data.versions).map((version) => ({
      version,
      publishedAt: data.time?.[version] ?? null,
      prerelease: isSemverPrerelease(version),
    }));
    const kept = selectKeptVersions(records, data["dist-tags"]?.latest ?? null, ctx.asOf);
    for (const { record } of kept) {
      const window = highImpactWindow(record.publishedAt);
      if (!window) continue;
      const url = windowDownloadsUrl(candidate.name, window);
      const { data: point, res } = await src.getJson<{ downloads?: number }>(url, { ecosystem: this.id, package: candidate.name });
      record.weekly = { downloads: typeof point?.downloads === "number" ? point.downloads : null, window, res };
    }
    return { doc: data, res, kept };
  }

  protected build(candidate: Candidate, raw: Raw, ctx: RunContext): ExtractedPackage {
    const { doc, kept } = raw;
    const versions = doc.versions ?? {};
    const latest = kept.find((k) => k.isLatest)?.record;

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
        signals: [...signalsFor(versions[record.version] ?? {}, raw.res), mfaFor(record)],
      })),
      withdrawals: withdrawalsOf(doc, ctx.asOf),
    };
  }
}

function signalsFor(m: Manifest, res: FetchResult) {
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
      res,
    ),
    // The provenance bundle is a Sigstore signature over the tarball digest, made by the
    // publisher's CI identity. `dist.signatures` does not count here: the registry applies
    // it to every tarball, so a hijacked account's upload is "signed" too.
    observed("artifact_signature", att?.url ?? null, `${SRC}.dist.attestations (Sigstore, publisher CI identity)`, res),
    // Registry-applied on serve, including to 2016-era tarballs (docs/registries.md#npm).
    observed(
      "registry_integrity",
      sig ? `registry signature, keyid ${sig.keyid ?? "unknown"}` : null,
      `${SRC}.dist.signatures (registry-applied)`,
      res,
    ),
    observed("build_provenance", slsa, `${SRC}.dist.attestations.provenance.predicateType`, res),
    // SLSA provenance names the source repository and commit, signed by the builder.
    observed("source_link", slsa, `${SRC}.dist.attestations (SLSA resolvedDependencies)`, res),
    // npm provenance is only accepted from public repositories, and its statements are
    // logged in the public Rekor instance.
    observed("transparency_log", att?.url ?? null, `${SRC}.dist.attestations (Sigstore, Rekor-logged)`, res),
  ];
}

/**
 * The packument's `time` map keeps an entry for every version ever published, including
 * unpublished ones that `versions` no longer lists; `deprecated` marks the rest.
 */
function withdrawalsOf(doc: Packument, asOf: Date) {
  const since = withdrawalWindowStart(asOf);
  const all = Object.entries(doc.time ?? {})
    .filter(([k]) => k !== "created" && k !== "modified")
    .map(([version, publishedAt]) => ({ version, publishedAt }));
  const versions = doc.versions ?? {};
  return [
    withdrawalIn("unpublished", all.map((v) => ({ ...v, withdrawn: !(v.version in versions) })), since, asOf),
    withdrawalIn("deprecated", all.map((v) => ({ ...v, withdrawn: Boolean(versions[v.version]?.deprecated) })), since, asOf),
  ];
}

/**
 * `true` when the package was high-impact by downloads before the release, so its
 * maintainers had to have 2FA. Otherwise `unknown`, never `false`: the package may have
 * qualified by dependents, been in the earlier top-100/top-500 cohorts, or had a
 * maintainer with 2FA by choice. The per-package "require 2FA" setting is not exposed.
 */
function mfaFor(r: NpmRecord): ExtractedSignal {
  const policy = "npm high-impact rule: 2FA required above 1M weekly downloads or 500 dependents";
  const source = `policy: ${policy} (effective ${NPM_HIGH_IMPACT_2FA.slice(0, 10)}); api.npmjs.org/downloads/point/{week ending ${NOTICE_DAYS} days before publish}/{p}`;
  if (!r.weekly) return signal("mfa_enforced", "unknown", null, source, null);
  const { downloads, window, res } = r.weekly;
  return downloads != null && downloads > HIGH_IMPACT_WEEKLY
    ? signal("mfa_enforced", "true", `${downloads} downloads in ${window}`, source, res)
    : signal("mfa_enforced", "unknown", downloads != null ? `${downloads} downloads in ${window}` : null, source, res);
}
