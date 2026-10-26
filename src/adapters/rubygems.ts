/**
 * RubyGems adapter.
 *
 * RubyGems has trusted publishing, but its public API exposes no per-version marker for it,
 * not even on Ruby Central's own test gem (docs/registries.md#rubygems). What it *does* expose:
 *
 *  - who pushed each version, on its web page ("Pushed by": a user, i.e. an API key, or a
 *    trusted publisher). Not in any JSON endpoint, so the page is read; versions pushed
 *    before rubygems.org recorded pushers have no such section and stay unknown;
 *  - Sigstore attestations, which rubygems.org accepts only from a trusted-publishing push
 *    (`Pusher#verify_sigstore`, since attestations were first accepted on 2024-11-14), so
 *    an attestation also implies trusted publishing — the same inference as PyPI's;
 *  - `metadata.rubygems_mfa_required` per version, which makes MFA enforcement backfillable;
 *  - the attestations themselves, per version at `/api/v1/attestations/{gem}-{version}.json`
 *    (`[]` when there are none). Found 2026-10-13; the M0 probe missed it because the
 *    versions and gem endpoints carry no hint that it exists.
 */

import type { Candidate, ExtractedPackage, ExtractedSignal, FetchResult } from "../types.ts";
import type { HttpClient, Source } from "../http/client.ts";
import { GatheringAdapter, type RunContext } from "./types.ts";
import { rankFromEcosystems } from "./ecosystems.ts";
import { fulcioSourceRef } from "../extract/fulcio.ts";
import {
  cleanRepoUrl,
  earliest,
  impliedBy,
  noMechanism,
  observed,
  selectKeptVersions,
  signal,
  type KeptVersion,
  type VersionRecord,
} from "../extract/signals.ts";
import type { PersonalData } from "../publish/redact.ts";

const API = "https://rubygems.org/api/v1";

interface GemVersion {
  number: string;
  platform?: string;
  created_at: string;
  prerelease?: boolean;
  metadata?: Record<string, string>;
}

interface GemInfo {
  version?: string;
  source_code_uri?: string | null;
  homepage_uri?: string | null;
}

interface Bundle {
  verificationMaterial?: {
    tlogEntries?: Array<{ logIndex?: string; kindVersion?: { kind?: string } }>;
    /** Bundle v0.3 */
    certificate?: { rawBytes?: string };
    /** Bundle v0.1 / v0.2 */
    x509CertificateChain?: { certificates?: Array<{ rawBytes?: string }> };
  };
  /** Present when the bundle carries an in-toto statement rather than a bare signature. */
  dsseEnvelope?: { payload?: string };
}

interface GemRecord extends VersionRecord {
  builds: GemVersion[];
}

interface Raw {
  kept: KeptVersion<GemRecord>[];
  attestations: Map<string, { bundles: Bundle[] | null; res: FetchResult }>;
  /** The version's web page, for its "Pushed by" section; null when it did not answer 200. */
  pages: Map<string, { html: string | null; res: FetchResult }>;
  versionsRes: FetchResult;
  gem: GemInfo | null;
  owners: unknown[] | null;
}

const MFA_SRC = "rubygems.org /api/v1/versions/{g}.json metadata.rubygems_mfa_required";
const ATT_SRC = "rubygems.org /api/v1/attestations/{g}-{v}.json";
const PUSHER_SRC = "rubygems.org /gems/{g}/versions/{v} \"Pushed by\"";

export type Pusher = { kind: "trusted_publisher"; name: string } | { kind: "user" };

/**
 * Reads the "Pushed by" section of a version page (`rubygems/_release_info.html.erb`). A
 * user push renders a profile link; a trusted-publisher push renders the publisher's icon
 * titled with its name ("GitHub Actions rails/rails @ .github/workflows/release.yml").
 * Returns null when the section is absent: the version predates pusher tracking.
 */
export function pusherOf(html: string | null): Pusher | null {
  if (!html) return null;
  const start = html.indexOf(">Pushed by</h3>");
  if (start < 0) return null;
  const next = html.indexOf("<h3", start + 1);
  const section = html.slice(start, next < 0 ? undefined : next);
  if (/href="\/profiles\//.test(section)) return { kind: "user" };
  const title = /alt="GitHub"[^>]*title="([^"]+)"|title="([^"]+)"[^>]*alt="GitHub"/.exec(section);
  if (title) return { kind: "trusted_publisher", name: (title[1] ?? title[2])!.replace(/&amp;/g, "&") };
  return null;
}

export class RubygemsAdapter extends GatheringAdapter<Raw> {
  readonly id = "rubygems" as const;
  readonly rankFrame = "downloads" as const;

  /** All-time downloads: neither RubyGems nor ecosyste.ms publishes a recent window. */
  async rank(n: number, http: HttpClient): Promise<Candidate[]> {
    const rows = await rankFromEcosystems(http, {
      ecosystem: this.id,
      registry: "rubygems.org",
      sort: "downloads",
      n,
    });
    return rows
      .filter((r) => r.downloads != null)
      .map((r, i) => ({
        ecosystem: this.id,
        name: r.name,
        layer: "top" as const,
        rank: i + 1,
        rankFrame: this.rankFrame,
        downloadCount: r.downloads,
        dependentCount: null,
      }));
  }

  protected async gather(candidate: Candidate, src: Source, ctx: RunContext): Promise<Raw> {
    const opts = { ecosystem: this.id, package: candidate.name };
    const enc = encodeURIComponent(candidate.name);
    const { data: versions, res: versionsRes } = await src.getJson<GemVersion[]>(`${API}/versions/${enc}.json`, opts);
    const { data: gem } = await src.getJson<GemInfo>(`${API}/gems/${enc}.json`, opts);
    const { data: owners } = await src.getJson<unknown[]>(`${API}/gems/${enc}/owners.json`, opts);
    if (!versions) throw new Error(`RubyGems has no gem "${candidate.name}" (HTTP ${versionsRes.status})`);

    // One release number can ship several platform gems (nokogiri's per-OS builds); they
    // are one release for adoption purposes, read through the pure-Ruby build when present.
    const byNumber = new Map<string, GemVersion[]>();
    for (const v of versions) byNumber.set(v.number, [...(byNumber.get(v.number) ?? []), v]);
    const records: GemRecord[] = [...byNumber].map(([version, builds]) => ({
      version,
      builds,
      publishedAt: earliest(builds.map((b) => b.created_at)),
      prerelease: builds.some((b) => b.prerelease),
    }));
    const kept = selectKeptVersions(records, gem?.version ?? null, ctx.asOf);

    const attestations: Raw["attestations"] = new Map();
    for (const { record } of kept) {
      const build = primaryBuild(record);
      const platform = build?.platform && build.platform !== "ruby" ? `-${build.platform}` : "";
      const { data, res } = await src.getJson<Bundle[]>(
        `${API}/attestations/${enc}-${encodeURIComponent(record.version)}${platform}.json`,
        opts,
      );
      attestations.set(record.version, { bundles: Array.isArray(data) ? data : null, res });
    }

    const pages: Raw["pages"] = new Map();
    for (const { record } of kept) {
      const build = primaryBuild(record);
      const platform = build?.platform && build.platform !== "ruby" ? `-${build.platform}` : "";
      const url = `https://rubygems.org/gems/${enc}/versions/${encodeURIComponent(record.version)}${platform}`;
      const res = await src.get(url, { ...opts, headers: { Accept: "text/html" } });
      pages.set(record.version, { html: res.status === 200 ? res.body : null, res });
    }
    return { kept, attestations, pages, versionsRes, gem, owners };
  }

  protected build(candidate: Candidate, raw: Raw): ExtractedPackage {
    const latest = raw.kept.find((k) => k.isLatest)?.record;
    const isForge = (u: string | null | undefined) => typeof u === "string" && /github\.com|gitlab\.com|codeberg\.org/.test(u);

    return {
      ecosystem: this.id,
      name: candidate.name,
      latestVersion: latest?.version ?? raw.gem?.version ?? null,
      latestPublishDate: latest?.publishedAt ?? null,
      maintainerCount: raw.owners ? raw.owners.length : null,
      maintainerCountSource: raw.owners ? "rubygems.org owners.json" : "unavailable",
      repositoryUrl:
        repoRoot(raw.gem?.source_code_uri) ?? (isForge(raw.gem?.homepage_uri) ? repoRoot(raw.gem?.homepage_uri) : null),
      fetchError: null,
      versions: raw.kept.map(({ record, isLatest, quarterAnchor }) => {
        const meta = primaryBuild(record)?.metadata ?? {};
        const att = raw.attestations.get(record.version)!;
        const evidence = attestationEvidence(att.bundles, att.res.url);
        const source = sourceRef(att.bundles);
        const slsa = slsaIn(att.bundles);
        return {
          version: record.version,
          publishedAt: record.publishedAt,
          isLatest,
          quarterAnchor,
          signals: [
            identityFor(raw.pages.get(record.version)!, att.res, evidence),
            // Sigstore signatures are observable; legacy `gem cert` X.509 signatures are
            // not, so an empty attestation list does not prove the gem is unsigned.
            impliedBy("artifact_signature", evidence, `${ATT_SRC} (Sigstore; gem cert signatures not exposed)`, att.res),
            noMechanism("registry_integrity", "RubyGems.org serves sha256 checksums over TLS but signs nothing"),
            // Bundles are usually bare message signatures; only an in-toto statement with an
            // SLSA predicate is build provenance.
            observed("build_provenance", slsa ? `${att.res.url} (${slsa})` : null, `${ATT_SRC} dsseEnvelope predicateType`, att.res),
            // The Fulcio certificate binds source repository and commit — the facts
            // RubyGems.org renders as "Provenance" on the gem page.
            observed(
              "source_link",
              source ? `${source.repository ?? "unknown repository"}@${source.digest}` : null,
              `${ATT_SRC} Fulcio certificate source repository digest`,
              att.res,
            ),
            observed("transparency_log", evidence, `${ATT_SRC} verificationMaterial.tlogEntries (Rekor)`, att.res),
            // The gem opts its owners into mandatory MFA for push; absence means it did not.
            observed(
              "mfa_enforced",
              meta.rubygems_mfa_required === "true" ? "metadata.rubygems_mfa_required=true" : null,
              MFA_SRC,
              raw.versionsRes,
            ),
          ],
        };
      }),
    };
  }
}

/**
 * The page's pusher decides; an attestation also proves trusted publishing, because
 * rubygems.org rejects one from any other push. A user push used that user's API key.
 * No pusher and no attestation: the version predates pusher tracking, so unknown.
 */
function identityFor(page: { html: string | null; res: FetchResult }, att: FetchResult, attestation: string | null): ExtractedSignal {
  const pusher = pusherOf(page.html);
  if (pusher?.kind === "trusted_publisher") return signal("identity_publish", "true", `trusted publisher: ${pusher.name}`, PUSHER_SRC, page.res);
  if (attestation) return signal("identity_publish", "true", attestation, `${ATT_SRC} (accepted only from trusted-publishing pushes)`, att);
  if (pusher?.kind === "user") return signal("identity_publish", "false", "pushed with a user API key", PUSHER_SRC, page.res);
  return signal("identity_publish", "unknown", null, `${PUSHER_SRC} (absent: pushed before rubygems.org recorded pushers)`, [page.res, att]);
}

function primaryBuild(r: GemRecord): GemVersion | undefined {
  return r.builds.find((b) => !b.platform || b.platform === "ruby") ?? r.builds[0];
}

function sourceRef(bundles: Bundle[] | null) {
  for (const b of bundles ?? []) {
    const vm = b.verificationMaterial;
    const ref = fulcioSourceRef(vm?.certificate?.rawBytes ?? vm?.x509CertificateChain?.certificates?.[0]?.rawBytes);
    if (ref) return ref;
  }
  return null;
}

function slsaIn(bundles: Bundle[] | null): string | null {
  for (const b of bundles ?? []) {
    try {
      const statement = JSON.parse(Buffer.from(b.dsseEnvelope?.payload ?? "", "base64").toString("utf8"));
      if (typeof statement?.predicateType === "string" && statement.predicateType.includes("slsa.dev/provenance")) {
        return statement.predicateType;
      }
    } catch {
      // Not a statement-carrying bundle.
    }
  }
  return null;
}

function attestationEvidence(bundles: Bundle[] | null, url: string): string | null {
  if (!bundles?.length) return null;
  const entry = bundles[0]?.verificationMaterial?.tlogEntries?.[0];
  return entry?.logIndex ? `${url} (Rekor logIndex ${entry.logIndex})` : url;
}

/** `source_code_uri` often points at a tag (`…/tree/v8.1.4`); keep the repository root. */
function repoRoot(u: string | null | undefined): string | null {
  const clean = cleanRepoUrl(u);
  if (!clean) return null;
  const m = /^(https:\/\/(?:github\.com|gitlab\.com|codeberg\.org)\/[^/]+\/[^/]+)/.exec(clean);
  return m ? m[1]! : clean;
}

/**
 * RubyGems names authors and owners in its JSON, and on each version page the pusher, the owners
 * (profile links with avatars) and the authors. A page keeps the shape `pusherOf` reads: a user
 * push still links to a profile, now `/profiles/redacted`, and a trusted publisher keeps its title.
 */
export const PERSONAL_DATA: PersonalData[] = [
  {
    ecosystem: "rubygems",
    endpoint: "rubygems.org /api/v1/versions/{g}.json, /api/v1/gems/{g}.json",
    matches: (url) => /^https:\/\/rubygems\.org\/api\/v1\/(versions|gems)\/[^/]+\.json$/.test(url),
    paths: ["authors", "*.authors"],
  },
  {
    ecosystem: "rubygems",
    endpoint: "rubygems.org /api/v1/gems/{g}/owners.json",
    matches: (url) => /^https:\/\/rubygems\.org\/api\/v1\/gems\/[^/]+\/owners\.json$/.test(url),
    paths: ["*"],
  },
  {
    ecosystem: "rubygems",
    endpoint: "rubygems.org /gems/{g}/versions/{v} (HTML)",
    matches: (url) => /^https:\/\/rubygems\.org\/gems\/[^/]+\/versions\//.test(url),
    text: (html) =>
      html
        .replace(/<a\b[^>]*href="\/profiles\/[^"]*"[^>]*>[\s\S]*?<\/a>/g, '<a href="/profiles/redacted"><span class="truncate">redacted</span></a>')
        .replace(/(>Authors<\/h3>\s*<p[^>]*>)[\s\S]*?(<\/p>)/g, "$1redacted$2"),
    textResidue: (html) => [
      ...[...html.matchAll(/href="\/profiles\/(?!redacted")[^"]*"/g)].map((m) => `profile link ${m[0]}`),
      ...[...html.matchAll(/\/users\/\d+\/avatar/g)].map((m) => `avatar ${m[0]}`),
      ...[...html.matchAll(/>Authors<\/h3>\s*<p[^>]*>(?!redacted<)/g)].map(() => "authors paragraph"),
    ],
  },
]
