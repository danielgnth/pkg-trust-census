/**
 * Go adapter.
 *
 * Go has no publisher accounts: the module proxy fetches from VCS on demand, and every
 * module version a client downloads is checked against the sum.golang.org transparency
 * log. So transparency-log inclusion is mandatory and observable, while identity, signing
 * and MFA have no mechanism at all — the case two booleans would score as zero.
 *
 * The proxy lists versions without dates, so release dates are probed per version via
 * `.info` and quarter anchors are found by binary search (src/extract/probe.ts).
 */

import type { Candidate, ExtractedPackage, FetchResult } from "../types.ts";
import type { HttpClient, Source } from "../http/client.ts";
import { GatheringAdapter, type RunContext } from "./types.ts";
import { rankFromEcosystems } from "./ecosystems.ts";
import { impliedBy, noMechanism, observed, selectKeptVersions, type KeptVersion, type VersionRecord } from "../extract/signals.ts";
import { probeAnchorDates } from "../extract/probe.ts";
import { compareSemver, isSemverPrerelease } from "../extract/versions.ts";

const PROXY = "https://proxy.golang.org";
const SUMDB = "https://sum.golang.org";

/**
 * Module proxy case-encoding: each uppercase letter becomes `!` plus its lowercase form,
 * so `github.com/BurntSushi/toml` is requested as `github.com/!burnt!sushi/toml`. Missing
 * this fetches a different (usually nonexistent) module without any error.
 */
export function escapeModulePath(path: string): string {
  return path.replace(/[A-Z]/g, (c) => `!${c.toLowerCase()}`);
}

interface Info {
  Version: string;
  Time?: string;
  Origin?: { VCS?: string; URL?: string; Ref?: string; Hash?: string };
}

interface Kept extends VersionRecord {
  info: Info | null;
}

interface Raw {
  kept: KeptVersion<Kept>[];
  sumdb: Map<string, FetchResult>;
  latest: Info | null;
}

export class GoAdapter extends GatheringAdapter<Raw> {
  readonly id = "go" as const;
  readonly rankFrame = "dependents" as const;

  /** Go publishes no download counts anywhere; dependents is the only available frame. */
  async rank(n: number, http: HttpClient): Promise<Candidate[]> {
    const rows = await rankFromEcosystems(http, {
      ecosystem: this.id,
      registry: "proxy.golang.org",
      sort: "dependent_packages_count",
      n,
    });
    return rows
      .filter((r) => r.dependent_packages_count != null)
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
    // The proxy answers 410 Gone for modules it cannot serve: a fact, not a failure.
    const opts = { ecosystem: this.id, package: candidate.name, acceptStatuses: [410] };
    const mod = escapeModulePath(candidate.name);

    const list = await src.get(`${PROXY}/${mod}/@v/list`, opts);
    const { data: latest } = await src.getJson<Info>(`${PROXY}/${mod}/@latest`, opts);
    if (list.status !== 200 && !latest) {
      throw new Error(`proxy.golang.org cannot serve "${candidate.name}" (HTTP ${list.status})`);
    }

    const infos = new Map<string, Info | null>();
    const infoOf = async (v: string): Promise<Info | null> => {
      if (!infos.has(v)) {
        const { data } = await src.getJson<Info>(`${PROXY}/${mod}/@v/${escapeModulePath(v)}.info`, opts);
        infos.set(v, data);
      }
      return infos.get(v)!;
    };

    const tags = list.status === 200 ? list.body.split("\n").map((s) => s.trim()).filter(Boolean) : [];
    const stable = tags.filter((t) => !isSemverPrerelease(t)).sort(compareSemver);
    const probed = await probeAnchorDates(stable, async (v) => (await infoOf(v))?.Time ?? null, ctx.asOf);

    const records: Kept[] = [...probed].map(([version, publishedAt]) => ({
      version,
      publishedAt,
      info: infos.get(version) ?? null,
    }));
    // `@latest` may name a pseudo-version for an untagged module; it is still what
    // `go get` resolves, so it is kept as the latest version.
    if (latest && !probed.has(latest.Version)) {
      records.push({ version: latest.Version, publishedAt: latest.Time ?? null, info: latest });
    }
    const kept = selectKeptVersions(records, latest?.Version ?? null, ctx.asOf);

    const sumdb = new Map<string, FetchResult>();
    for (const { record } of kept) {
      // 404 and 410 both mean "not in the log"; the client caches 404 as a fact already.
      sumdb.set(record.version, await src.get(`${SUMDB}/lookup/${mod}@${escapeModulePath(record.version)}`, opts));
    }
    return { kept, sumdb, latest };
  }

  protected build(candidate: Candidate, raw: Raw): ExtractedPackage {
    const latest = raw.kept.find((k) => k.isLatest)?.record;
    const origin = raw.latest?.Origin;

    return {
      ecosystem: this.id,
      name: candidate.name,
      latestVersion: latest?.version ?? raw.latest?.Version ?? null,
      latestPublishDate: latest?.publishedAt ?? null,
      maintainerCount: null,
      maintainerCountSource: "unavailable: Go has no publisher accounts",
      repositoryUrl: origin?.URL ?? forgeRoot(candidate.name),
      fetchError: null,
      versions: raw.kept.map(({ record, isLatest, quarterAnchor }) => {
        const lookup = raw.sumdb.get(record.version)!;
        const logged = lookup.status === 200 ? lookup.body.split("\n")[0] : null;
        const o = record.info?.Origin;
        return {
          version: record.version,
          publishedAt: record.publishedAt,
          isLatest,
          quarterAnchor,
          signals: [
            noMechanism("identity_publish", "Go has no publisher accounts; modules are served from VCS"),
            noMechanism("artifact_signature", "module authors cannot sign; integrity comes from the checksum database"),
            // The checksum database is Google vouching for the module's hash in a signed
            // tree head: the same role npm's registry signatures play.
            observed(
              "registry_integrity",
              logged ? `sum.golang.org signed tree head over ${logged}` : null,
              "sum.golang.org /lookup/{mod}@{v} (signed note)",
            ),
            noMechanism("build_provenance", "Go has no build step and no attestation format"),
            // The proxy's own record of the commit it fetched. Older versions predate
            // Origin, hence `unknown` rather than `false`.
            impliedBy(
              "source_link",
              o?.Hash ? `${o.VCS ?? "vcs"} ${o.URL ?? ""} ${o.Ref ?? ""} @ ${o.Hash}`.replace(/\s+/g, " ") : null,
              "proxy.golang.org /@v/{v}.info Origin (proxy-recorded VCS source)",
            ),
            observed(
              "transparency_log",
              logged ? `sum.golang.org record ${logged}` : null,
              "sum.golang.org /lookup/{mod}@{v} (HTTP 200 = logged)",
            ),
            noMechanism("mfa_enforced", "Go has no publisher accounts"),
          ],
          raw: { path: lookup.entry.path, sha256: lookup.entry.sha256 },
        };
      }),
    };
  }
}

/** Best-effort repository for forge-hosted module paths, when the proxy recorded no Origin. */
function forgeRoot(path: string): string | null {
  const m = /^((?:github\.com|gitlab\.com|bitbucket\.org)\/[^/]+\/[^/]+)/.exec(path);
  return m ? `https://${m[1]}` : null;
}
