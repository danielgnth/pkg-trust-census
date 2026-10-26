/**
 * Known advisories per sampled release, from OSV (osv.dev), which aggregates the GitHub
 * Advisory Database, the ecosystems' own databases (PYSEC, RUSTSEC, GO) and the OpenSSF
 * malicious-packages reports (MAL) under one schema and one query API.
 *
 * Per package, one `querybatch` asks for every version the dataset stores plus every version the
 * registry shows as withdrawn; it answers with advisory ids only, so each record is then read
 * from `/v1/vulns/{id}`. Like an adapter's `gather`, `gatherAdvisories` runs twice: against the
 * network in `fetch`, against the cache in `extract`. The query body is built from the same
 * sorted version list both times, so the cache key matches.
 */

import type { Source } from "../http/client.ts";
import type { EcosystemId, ExtractedPackage, FetchResult, ResponseRef } from "../types.ts";
import type { PersonalData } from "../publish/redact.ts";

export const OSV_API = "https://api.osv.dev/v1";

/** OSV's names for the ecosystems (the schema's `affected[].package.ecosystem` values). */
export const OSV_ECOSYSTEM: Record<EcosystemId, string> = {
  pypi: "PyPI",
  npm: "npm",
  crates: "crates.io",
  rubygems: "RubyGems",
  go: "Go",
  maven: "Maven",
  packagist: "Packagist",
};

/** A query set paginates past ~3,000 results; a package's handful of versions never comes close. */
const MAX_PAGES = 20;

interface BatchResponse {
  results: Array<{ vulns?: Array<{ id: string; modified: string }>; next_page_token?: string }>;
}

/** The fields of an OSV record this project reads. */
export interface OsvRecord {
  id: string;
  aliases?: string[];
  published?: string;
  modified: string;
  withdrawn?: string;
  summary?: string;
}

export interface Advisory {
  id: string;
  aliases: string[];
  /** When the record was published in its database; null if the record does not say. */
  published: string | null;
  modified: string;
  /** Set when the database has withdrawn the record: it no longer claims anything. */
  withdrawn: string | null;
  /** An OpenSSF malicious-packages report (MAL-…), or a record aliasing one. */
  malicious: boolean;
  summary: string | null;
  response: ResponseRef;
}

export interface PackageAdvisories {
  /** When OSV answered the first query for this package. */
  queriedAt: string;
  /** Every version asked about, matched or not: a version absent from `matches` has no advisory. */
  versions: string[];
  matches: Array<{ version: string; advisoryId: string }>;
  advisories: Advisory[];
  /** The querybatch responses the matches were read from. */
  responses: ResponseRef[];
}

/** The versions to ask about: those the dataset stores, and those the registry withdrew. */
export function advisoryVersions(pkg: Pick<ExtractedPackage, "versions" | "withdrawals">): string[] {
  const all = new Set([...pkg.versions.map((v) => v.version), ...(pkg.withdrawals ?? []).flatMap((w) => w.withdrawn)]);
  return [...all].sort();
}

/** A cached response as a reference; a POST is named by its cache key, which includes the body's hash. */
function ref(res: FetchResult): ResponseRef {
  return { url: res.entry.url, sha256: res.entry.sha256 };
}

export const isMalicious = (r: Pick<OsvRecord, "id" | "aliases">) => [r.id, ...(r.aliases ?? [])].some((id) => id.startsWith("MAL-"));

/** Null when there is nothing to ask about. */
export async function gatherAdvisories(
  src: Source,
  ecosystem: EcosystemId,
  name: string,
  versions: string[],
): Promise<PackageAdvisories | null> {
  if (versions.length === 0) return null;
  const opts = { ecosystem, package: name };
  const query = (version: string) => ({ package: { ecosystem: OSV_ECOSYSTEM[ecosystem], name }, version });

  const matches = new Map<string, { version: string; advisoryId: string }>();
  const batches: FetchResult[] = [];
  let pending = versions.map((version) => ({ version, q: query(version) as ReturnType<typeof query> & { page_token?: string } }));
  for (let page = 0; pending.length > 0; page++) {
    if (page === MAX_PAGES) throw new Error(`OSV querybatch for ${name} still paginating after ${MAX_PAGES} pages`);
    const { data, res } = await src.postJson<BatchResponse>(`${OSV_API}/querybatch`, { queries: pending.map((p) => p.q) }, opts);
    if (!data || data.results?.length !== pending.length) throw new Error(`OSV querybatch for ${name}: HTTP ${res.status}, ${data?.results?.length ?? 0} results for ${pending.length} queries`);
    batches.push(res);
    const next: typeof pending = [];
    data.results.forEach((r, k) => {
      const { version } = pending[k]!;
      for (const v of r.vulns ?? []) matches.set(`${version} ${v.id}`, { version, advisoryId: v.id });
      if (r.next_page_token) next.push({ version, q: { ...query(version), page_token: r.next_page_token } });
    });
    pending = next;
  }

  const ids = [...new Set([...matches.values()].map((m) => m.advisoryId))].sort();
  const advisories = await Promise.all(
    ids.map(async (id): Promise<Advisory> => {
      const { data, res } = await src.getJson<OsvRecord>(`${OSV_API}/vulns/${encodeURIComponent(id)}`, opts);
      // OSV listed the id a moment ago, so a missing record is an error, not "no advisory".
      if (!data) throw new Error(`OSV returned ${id} for ${name} but has no record for it (HTTP ${res.status})`);
      return {
        id: data.id,
        aliases: [...(data.aliases ?? [])].sort(),
        published: data.published ?? null,
        modified: data.modified,
        withdrawn: data.withdrawn ?? null,
        malicious: isMalicious(data),
        summary: data.summary ?? null,
        response: ref(res),
      };
    }),
  );

  return {
    queriedAt: batches.map((b) => b.entry.fetchedAt).sort()[0]!,
    versions,
    matches: [...matches.values()].sort((a, b) => a.version.localeCompare(b.version) || a.advisoryId.localeCompare(b.advisoryId)),
    advisories,
    responses: batches.map(ref),
  };
}

/**
 * Groups records that describe one vulnerability. Databases cross-reference each other in
 * `aliases` (a GHSA record lists its CVE and PYSEC ids), so records sharing any id are one
 * group. Withdrawn records are left out. Each group is named by its earliest-published member,
 * so the name is the first advisory anyone published.
 */
export function aliasGroups(advisories: ReadonlyArray<Pick<Advisory, "id" | "aliases" | "published" | "withdrawn">>): Map<string, string> {
  const live = advisories.filter((a) => !a.withdrawn);
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let root = x;
    while (parent.has(root) && parent.get(root) !== root) root = parent.get(root)!;
    parent.set(x, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const [ra, rb] = [find(a), find(b)];
    if (ra !== rb) parent.set(rb, ra);
  };
  for (const a of live) {
    parent.set(a.id, find(a.id));
    for (const alias of a.aliases) union(a.id, alias);
  }

  const members = new Map<string, typeof live>();
  for (const a of live) members.set(find(a.id), [...(members.get(find(a.id)) ?? []), a]);
  const order = (a: (typeof live)[number]) => a.published ?? "9999";
  const out = new Map<string, string>();
  for (const group of members.values()) {
    const first = [...group].sort((a, b) => order(a).localeCompare(order(b)) || a.id.localeCompare(b.id))[0]!;
    for (const a of group) out.set(a.id, first.id);
  }
  return out;
}

/** "GHSA", "PYSEC", "MAL", …: the database an OSV id belongs to. */
export function databaseOf(id: string): string {
  return /^[A-Z]+/.exec(id)?.[0] ?? id;
}

/** OSV records credit the people who found or fixed a vulnerability, with contact addresses. */
export const PERSONAL_DATA: PersonalData[] = [
  {
    ecosystem: "any",
    endpoint: "api.osv.dev /v1/vulns/{id}",
    matches: (url) => url.startsWith("https://api.osv.dev/v1/vulns/"),
    paths: ["credits"],
    keep: ["type"],
  },
]
