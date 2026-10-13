/**
 * PyPI adapter.
 *
 * The cheapest of the seven: one Simple API call returns every file of every version
 * *with* its PEP 740 provenance URL, so the whole quarterly backfill costs a single
 * request. See docs/preflight.md §1.
 */

import type { Candidate, ExtractedPackage, FetchResult } from "../types.ts";
import type { HttpClient, Source } from "../http/client.ts";
import { GatheringAdapter, type RunContext } from "./types.ts";
import {
  cleanRepoUrl,
  earliest,
  impliedBy,
  noMechanism,
  observed,
  policySince,
  selectKeptVersions,
  signal,
  type KeptVersion,
  type VersionRecord,
} from "../extract/signals.ts";
import { fulcioSourceRef } from "../extract/fulcio.ts";
import { isPep440Prerelease } from "../extract/versions.ts";

/**
 * Community-maintained daily export of PyPI download counts from Google BigQuery.
 * PyPI publishes no ranking endpoint of its own, so this is the standard source.
 */
const RANKING_URL =
  "https://raw.githubusercontent.com/hugovk/top-pypi-packages/main/top-pypi-packages.json";

/** Pseudo-package name used to key the shared ranking response in the cache. */
export const RANKING_CACHE_KEY = "_ranking";

export const SIMPLE_ACCEPT = "application/vnd.pypi.simple.v1+json";

/** PyPI requires 2FA for every account from this date; see src/facts/ecosystems.ts. */
export const PYPI_2FA_MANDATE = "2024-01-01T00:00:00Z";

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

export interface SimpleFile {
  filename: string;
  provenance?: string | null;
  "upload-time"?: string;
  yanked?: boolean | string;
}

interface SimpleIndex {
  name?: string;
  versions?: string[];
  files: SimpleFile[];
}

interface JsonApi {
  info?: {
    version?: string;
    home_page?: string | null;
    project_urls?: Record<string, string> | null;
  };
}

/** PEP 740 provenance object, as served at a file's `provenance` URL. */
export interface Provenance {
  attestation_bundles?: Array<{
    publisher?: { kind?: string; repository?: string; workflow?: string };
    attestations?: Array<{
      verification_material?: { certificate?: string };
      envelope?: { statement?: string };
    }>;
  }>;
}

interface Raw {
  simple: SimpleIndex;
  simpleRes: FetchResult;
  json: JsonApi | null;
  kept: KeptVersion<PypiVersion>[];
  /** Provenance of one attested file per kept release, keyed by version. */
  provenance: Map<string, { data: Provenance | null; res: FetchResult }>;
}

interface PypiVersion extends VersionRecord {
  files: SimpleFile[];
}

const SOURCE = "pypi.org/simple/{p}/ (PEP 691 JSON) files[].provenance";

/**
 * Distribution archive suffixes, longest first so `.tar.gz` wins over `.gz`. Covers every
 * format PyPI has ever accepted, including the legacy installers older releases carry.
 */
const ARCHIVE_SUFFIXES = [".tar.gz", ".tar.bz2", ".tar.xz", ".tar.Z", ".tgz", ".zip", ".whl", ".egg", ".exe", ".msi", ".rpm", ".dmg", ".tar"];

/**
 * Attributes a distribution file to one of the project's versions.
 *
 * The Simple API lists files flat across all versions, so the version has to come from the
 * filename. The project-name prefix is matched in normalized form (filenames spell it with
 * underscores, mixed case, or the pre-PEP 625 original), and the remainder is matched
 * against the known version list rather than parsed — sdist versions may themselves
 * contain `-`, and installer suffixes (`.win32`) follow the version with a `.`.
 */
export function fileVersion(filename: string, project: string, versions: Set<string>): string | null {
  const suffix = ARCHIVE_SUFFIXES.find((s) => filename.toLowerCase().endsWith(s.toLowerCase()));
  const stem = suffix ? filename.slice(0, -suffix.length) : filename;
  const target = normalizeName(project);

  for (let i = stem.indexOf("-"); i !== -1; i = stem.indexOf("-", i + 1)) {
    if (normalizeName(stem.slice(0, i)) !== target) continue;
    const rest = stem.slice(i + 1);
    if (versions.has(rest)) return rest;
    // Wheels and eggs: `{version}-{python tag}-…`. Installers: `{version}.win32`.
    const head = rest.split("-")[0]!;
    if (versions.has(head)) return head;
    let best: string | null = null;
    for (const v of versions) {
      if (rest.startsWith(v) && /^([-._]|$)/.test(rest.slice(v.length)) && (!best || v.length > best.length)) {
        best = v;
      }
    }
    if (best) return best;
  }
  return null;
}

export class PypiAdapter extends GatheringAdapter<Raw> {
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

  protected async gather(candidate: Candidate, src: Source, ctx: RunContext): Promise<Raw> {
    const opts = { ecosystem: this.id, package: candidate.name };

    // Full version history + per-file provenance, in one call. Without the Accept header
    // PyPI serves HTML and `provenance` is unavailable entirely.
    const { data: simple, res: simpleRes } = await src.getJson<SimpleIndex>(simpleUrl(candidate.name), {
      ...opts,
      headers: { Accept: SIMPLE_ACCEPT },
    });

    // Authoritative "latest version" plus repository URL. Saves implementing PEP 440
    // ordering just to work out which release is current.
    const { data: json } = await src.getJson<JsonApi>(jsonUrl(candidate.name), opts);

    if (!simple) throw new Error(`PyPI has no project "${candidate.name}" (HTTP ${simpleRes.status})`);

    const kept = selectKeptVersions(groupByVersion(candidate.name, simple), json?.info?.version ?? null, ctx.asOf);

    // The index says *that* a file is attested; only the provenance object says *what* was
    // attested (publish vs SLSA predicate) and carries the certificate with the commit.
    // One attested file per release: publishing workflows attest every file the same way.
    const provenance: Raw["provenance"] = new Map();
    for (const { record } of kept) {
      const url = record.files.find((f) => f.provenance)?.provenance;
      if (url) provenance.set(record.version, await src.getJson<Provenance>(url, opts));
    }
    return { simple, simpleRes, json, kept, provenance };
  }

  protected build(candidate: Candidate, raw: Raw): ExtractedPackage {
    const latest = raw.json?.info?.version ?? null;
    const kept = raw.kept;
    const rawRef = { path: raw.simpleRes.entry.path, sha256: raw.simpleRes.entry.sha256 };

    const latestRecord = kept.find((k) => k.isLatest)?.record ?? null;
    return {
      ecosystem: this.id,
      name: candidate.name,
      latestVersion: latestRecord?.version ?? latest,
      latestPublishDate: latestRecord?.publishedAt ?? null,
      // PyPI exposes only free-text author/maintainer emails; parsing those into a count
      // would produce a number that looks real but is not (preflight §4).
      maintainerCount: null,
      maintainerCountSource: "unavailable",
      repositoryUrl: repositoryFrom(raw.json),
      fetchError: null,
      versions: kept.map(({ record, isLatest, quarterAnchor }) => ({
        version: record.version,
        publishedAt: record.publishedAt,
        isLatest,
        quarterAnchor,
        signals: signalsFor(record, raw.provenance.get(record.version)?.data ?? null),
        raw: rawRef,
      })),
    };
  }
}

function groupByVersion(project: string, simple: SimpleIndex): PypiVersion[] {
  const known = new Set(simple.versions ?? []);
  const byVersion = new Map<string, SimpleFile[]>();
  for (const v of known) byVersion.set(v, []);

  for (const f of simple.files ?? []) {
    const v = fileVersion(f.filename, simple.name ?? project, known);
    if (v) byVersion.get(v)!.push(f);
  }

  return [...byVersion].map(([version, files]) => ({
    version,
    files,
    publishedAt: earliest(files.map((f) => f["upload-time"])),
    prerelease: isPep440Prerelease(version),
    // PEP 592: a release is yanked when all of its files are.
    yanked: files.length > 0 && files.every((f) => f.yanked !== false && f.yanked !== undefined),
  }));
}

export const SLSA_PROVENANCE = "https://slsa.dev/provenance/v1";

/** Predicate types in a provenance object, decoded from each attestation's in-toto statement. */
export function predicateTypes(p: Provenance | null): string[] {
  const out: string[] = [];
  for (const b of p?.attestation_bundles ?? []) {
    for (const a of b.attestations ?? []) {
      try {
        const statement = JSON.parse(Buffer.from(a.envelope?.statement ?? "", "base64").toString("utf8"));
        if (typeof statement?.predicateType === "string") out.push(statement.predicateType);
      } catch {
        // An undecodable statement is not evidence of anything.
      }
    }
  }
  return out;
}

/**
 * A release counts as attested when *any* of its files carries a PEP 740 provenance URL.
 *
 * "Any" rather than "all": attestation is produced by the publishing workflow, so one
 * attested file proves the release went through it. Releases that pair an attested sdist
 * with wheels built elsewhere are common, and "all" would score them as non-adopters. The
 * attested/total file count is kept in `evidence`, so the stricter rule can be re-derived.
 */
function signalsFor(v: PypiVersion, prov: Provenance | null) {
  const mfa = policySince("mfa_enforced", v.publishedAt, PYPI_2FA_MANDATE, "PyPI requires 2FA for all accounts");
  const registry = noMechanism("registry_integrity", "PyPI serves sha256 digests over TLS but signs nothing (PEP 458 not deployed)");
  if (v.files.length === 0) {
    const why = `${SOURCE}: no files matched this version`;
    return [
      signal("identity_publish", "unknown", null, why),
      signal("artifact_signature", "unknown", null, why),
      registry,
      signal("build_provenance", "unknown", null, why),
      signal("source_link", "unknown", null, why),
      signal("transparency_log", "unknown", null, why),
      mfa,
    ];
  }

  const attested = v.files.filter((f) => f.provenance);
  const evidence = attested.length
    ? `${attested[0]!.provenance} (${attested.length}/${v.files.length} files attested)`
    : null;
  const rule = `${SOURCE} — any file of the release`;

  const bundle = prov?.attestation_bundles?.[0];
  const publisher = bundle?.publisher;
  const cert = fulcioSourceRef(bundle?.attestations?.[0]?.verification_material?.certificate);
  const slsa = predicateTypes(prov).includes(SLSA_PROVENANCE);
  // Attested, but the provenance object itself was unavailable: the details are unknown.
  const detailsMissing = attested.length > 0 && !prov;
  const provSource = "pypi.org/integrity/{p}/{v}/{file}/provenance";

  return [
    // PEP 740 attestations on PyPI are issued only through Trusted Publishing, but Trusted
    // Publishing does not always emit attestations, so absence proves nothing (preflight §3.5).
    impliedBy(
      "identity_publish",
      evidence && publisher ? `${publisher.kind} ${publisher.repository} ${publisher.workflow}` : evidence,
      `${rule}; attestation implies Trusted Publishing`,
    ),
    // The attestation is a Sigstore signature over the distribution file, made by the
    // publisher's CI. PyPI dropped GPG signatures in 2023.
    observed("artifact_signature", evidence, `${rule}; PEP 740 Sigstore signature`),
    registry,
    // Most PyPI attestations are the *publish* predicate, which is not SLSA provenance.
    detailsMissing
      ? signal("build_provenance", "unknown", null, `${provSource}: provenance object unavailable`)
      : observed("build_provenance", slsa ? `${SLSA_PROVENANCE} in ${attested[0]!.provenance}` : null, `${provSource} predicateType (one attested file)`),
    detailsMissing
      ? signal("source_link", "unknown", null, `${provSource}: provenance object unavailable`)
      : observed("source_link", cert ? `${cert.repository ?? "unknown repository"}@${cert.digest}` : null, `${provSource} Fulcio certificate source repository digest`),
    // Sigstore bundles are logged in Rekor; no other transparency log exists for PyPI.
    observed("transparency_log", evidence, `${rule}; Sigstore bundles are Rekor-logged`),
    mfa,
  ];
}

/** Prefers an explicitly labelled source link over a homepage that happens to be a forge. */
function repositoryFrom(json: JsonApi | null): string | null {
  const urls = json?.info?.project_urls ?? {};
  const labelled = Object.entries(urls).find(([k]) =>
    /^(source|source code|sourcecode|repository|repo|code|github|gitlab)$/i.test(k.trim()),
  );
  const isForge = (u: string | null | undefined) =>
    typeof u === "string" && /github\.com|gitlab\.com|bitbucket\.org|codeberg\.org/.test(u);
  const forge = Object.values(urls).find(isForge);
  const home = json?.info?.home_page;
  return cleanRepoUrl(labelled?.[1]) ?? cleanRepoUrl(forge) ?? (isForge(home) ? cleanRepoUrl(home) : null);
}
