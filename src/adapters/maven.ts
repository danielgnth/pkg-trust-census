/**
 * Maven Central adapter.
 *
 * Maven Central has mandated GPG signatures for every deployed file since long before this
 * study, and accepts optional Sigstore bundles alongside them. Neither is reliably
 * discoverable from an index, so both are confirmed per release with a HEAD request.
 *
 * The plan's `search.maven.org` solrsearch path turned out to be unusable: on 2026-10-13
 * its newest Guava release was 33.4.8 (April 2025) while maven-metadata.xml listed 33.7.2.
 * The version list therefore comes from maven-metadata.xml, which is authoritative but
 * undated, and release dates from the `.pom`'s Last-Modified header, probed by binary
 * search exactly as for Go.
 */

import type { Candidate, ExtractedPackage, FetchResult } from "../types.ts";
import type { HttpClient, Source } from "../http/client.ts";
import { GatheringAdapter, type RunContext } from "./types.ts";
import { rankFromEcosystems } from "./ecosystems.ts";
import { noMechanism, observed, selectKeptVersions, type KeptVersion, type VersionRecord } from "../extract/signals.ts";
import { probeAnchorDates } from "../extract/probe.ts";
import { fulcioSourceRef } from "../extract/fulcio.ts";
import { isMavenPrerelease } from "../extract/versions.ts";

const REPO = "https://repo1.maven.org/maven2";

/** `group:artifact` → the artifact's directory in the repository layout. */
export function artifactBase(coordinates: string): string {
  const [group, artifact] = coordinates.split(":");
  if (!group || !artifact) throw new Error(`not a Maven coordinate: "${coordinates}"`);
  return `${REPO}/${group.replace(/\./g, "/")}/${artifact}`;
}

export function pomUrl(coordinates: string, version: string): string {
  const artifact = coordinates.split(":")[1]!;
  return `${artifactBase(coordinates)}/${version}/${artifact}-${version}.pom`;
}

/** Just enough XML: the metadata file is machine-written and flat. */
export function parseMetadata(xml: string): { versions: string[]; release: string | null } {
  const versions = [...xml.matchAll(/<version>\s*([^<\s]+)\s*<\/version>/g)].map((m) => m[1]!);
  const release = /<release>\s*([^<\s]+)\s*<\/release>/.exec(xml)?.[1] ?? null;
  return { versions, release };
}

interface Probe {
  asc: FetchResult;
  /** GET rather than HEAD: the bundle's certificate carries the source commit. */
  sigstore: FetchResult;
  /** slsa-github-generator's naming: `{artifactId}-{version}.jar.build.slsa`. */
  slsa: FetchResult;
}

interface SigstoreBundle {
  verificationMaterial?: {
    certificate?: { rawBytes?: string };
    x509CertificateChain?: { certificates?: Array<{ rawBytes?: string }> };
  };
}

interface Raw {
  kept: KeptVersion<VersionRecord>[];
  probes: Map<string, Probe>;
}

export class MavenAdapter extends GatheringAdapter<Raw> {
  readonly id = "maven" as const;
  readonly rankFrame = "dependents" as const;

  /** Maven Central publishes no download counts; dependents is the only available frame. */
  async rank(n: number, http: HttpClient): Promise<Candidate[]> {
    const rows = await rankFromEcosystems(http, {
      ecosystem: this.id,
      registry: "repo1.maven.org",
      sort: "dependent_packages_count",
      n,
    });
    return rows
      .filter((r) => r.dependent_packages_count != null && r.name.includes(":"))
      .map((r, i) => ({
        ecosystem: this.id,
        name: r.name,
        rank: i + 1,
        rankFrame: this.rankFrame,
        downloadCount: null,
        dependentCount: r.dependent_packages_count,
      }));
  }

  protected async gather(candidate: Candidate, src: Source, ctx: RunContext): Promise<Raw> {
    const opts = { ecosystem: this.id, package: candidate.name };
    const head = { ...opts, method: "HEAD" as const };

    const meta = await src.get(`${artifactBase(candidate.name)}/maven-metadata.xml`, opts);
    if (meta.status !== 200) throw new Error(`Maven Central has no "${candidate.name}" (HTTP ${meta.status})`);
    const { versions, release } = parseMetadata(meta.body);

    const dateOf = async (v: string): Promise<string | null> => {
      const res = await src.get(pomUrl(candidate.name, v), head);
      if (res.status !== 200) return null;
      const lm = (JSON.parse(res.body) as Record<string, string>)["last-modified"];
      return lm && Number.isFinite(Date.parse(lm)) ? new Date(lm).toISOString() : null;
    };

    // Metadata lists versions in deploy order, which is what the binary search needs.
    const stable = versions.filter((v) => !isMavenPrerelease(v));
    const probed = await probeAnchorDates(stable, dateOf, ctx.asOf);
    // `<release>` is simply the last non-SNAPSHOT deployed, which can be an alpha
    // (slf4j-api's is 2.1.0-alpha1); the newest stable is what a range resolves to.
    const latest = stable.at(-1) ?? release;
    if (latest && !probed.has(latest)) probed.set(latest, await dateOf(latest));

    const records = [...probed].map(([version, publishedAt]) => ({ version, publishedAt }));
    const kept = selectKeptVersions(records, latest, ctx.asOf);

    const probes = new Map<string, Probe>();
    for (const { record } of kept) {
      const pom = pomUrl(candidate.name, record.version);
      const artifact = candidate.name.split(":")[1]!;
      probes.set(record.version, {
        asc: await src.get(`${pom}.asc`, head),
        sigstore: await src.get(`${pom}.sigstore.json`, opts),
        slsa: await src.get(`${artifactBase(candidate.name)}/${record.version}/${artifact}-${record.version}.jar.build.slsa`, head),
      });
    }
    return { kept, probes };
  }

  protected build(candidate: Candidate, raw: Raw): ExtractedPackage {
    const latest = raw.kept.find((k) => k.isLatest)?.record;

    return {
      ecosystem: this.id,
      name: candidate.name,
      latestVersion: latest?.version ?? null,
      latestPublishDate: latest?.publishedAt ?? null,
      maintainerCount: null,
      maintainerCountSource: "unavailable: Maven Central exposes no publisher list",
      repositoryUrl: null,
      fetchError: null,
      versions: raw.kept.map(({ record, isLatest, quarterAnchor }) => {
        const p = raw.probes.get(record.version)!;
        const pom = pomUrl(candidate.name, record.version);
        const asc = p.asc.status === 200 ? `${pom}.asc` : null;
        const sigstore = p.sigstore.status === 200 ? `${pom}.sigstore.json` : null;
        const slsa = p.slsa.status === 200 ? p.slsa.url : null;
        const cert = sigstore ? certSource(p.sigstore.body) : null;
        return {
          version: record.version,
          publishedAt: record.publishedAt,
          isLatest,
          quarterAnchor,
          signals: [
            noMechanism("identity_publish", "the Central Portal authenticates deployments with user tokens only"),
            // The `ec` index cannot be trusted for this (preflight §3.3), hence the HEAD.
            observed(
              "artifact_signature",
              asc ?? sigstore,
              "repo1.maven.org HEAD {artifact}-{v}.pom.asc / .pom.sigstore.json (HTTP 200 = present)",
            ),
            noMechanism("registry_integrity", "Central serves publisher-uploaded checksums and signs nothing itself"),
            // Not validated or indexed by Central; found by slsa-github-generator's file name.
            observed("build_provenance", slsa, "repo1.maven.org HEAD {artifact}-{v}.jar.build.slsa (HTTP 200 = present)"),
            observed(
              "source_link",
              cert ? `${cert.repository ?? "unknown repository"}@${cert.digest}` : slsa,
              "repo1.maven.org .pom.sigstore.json Fulcio certificate, or .jar.build.slsa",
            ),
            observed(
              "transparency_log",
              sigstore,
              "repo1.maven.org HEAD {artifact}-{v}.pom.sigstore.json (Sigstore bundles are Rekor-logged)",
            ),
            noMechanism("mfa_enforced", "deployments authenticate with user tokens; account MFA is never required"),
          ],
          raw: { path: p.asc.entry.path, sha256: p.asc.entry.sha256 },
        };
      }),
    };
  }
}

function certSource(body: string) {
  try {
    const vm = (JSON.parse(body) as SigstoreBundle).verificationMaterial;
    return fulcioSourceRef(vm?.certificate?.rawBytes ?? vm?.x509CertificateChain?.certificates?.[0]?.rawBytes);
  } catch {
    return null;
  }
}
