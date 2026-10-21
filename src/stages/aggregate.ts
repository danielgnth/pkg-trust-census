/**
 * Aggregate stage: the ecosystem × signal maturity matrix (latest versions), the quarterly
 * adoption series (anchor versions), and per-ecosystem coverage.
 *
 * Denominators are packages, not versions: each package contributes exactly one version
 * to a matrix cell (its latest) and at most one to a quarter (its anchor). `pct` divides
 * by every package in the cell, so `unknown` counts against adoption — a conservative
 * lower bound. `pctKnown` excludes unknowns and is reported alongside, never instead.
 */

import { and, eq, isNotNull } from "drizzle-orm";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { ECOSYSTEMS, SIGNALS, WITHDRAWAL_KINDS, type Availability, type EcosystemId, type SampleLayer, type SignalId, type WithdrawalKind } from "../types.ts";
import { snapshotAsOf, type Db } from "../db/open.ts";
import { advisories, advisoryMatches, packageVersions, packageWithdrawals, packages, sampleMembers, signalAvailability, versionSignals } from "../db/schema.ts";
import { dataDir } from "../http/cache.ts";
import { quarterBoundaries, withdrawalWindowStart } from "../extract/quarters.ts";
import { aliasGroups, databaseOf } from "../advisories/osv.ts";
import { layerMembers } from "./rank.ts";

export interface Counts {
  n: number;
  t: number;
  f: number;
  u: number;
  /** true / n — unknowns count against adoption. */
  pct: number | null;
  /** true / (true + false) — unknowns excluded. */
  pctKnown: number | null;
  /** 95% Wilson interval around `pct`; null when n = 0. */
  lo: number | null;
  hi: number | null;
}

export interface MatrixCell extends Counts {
  ecosystem: EcosystemId;
  signal: SignalId;
  availability: Availability;
  mandatory: boolean;
}

export interface SeriesPoint extends Counts {
  quarter: string;
  ecosystem: EcosystemId;
  signal: SignalId;
}

export interface Coverage {
  ecosystem: EcosystemId;
  rankFrame: string;
  sampled: number;
  fetched: number;
  fetchErrors: number;
  extracted: number;
  extractErrors: number;
}

/**
 * Per-platform trust summary. Two numbers, never one, because "the platform offers it"
 * and "packages use it" are different findings — the same split the matrix makes per cell.
 * Every number is a share of the score categories (`CATEGORIES`), each worth 0, ½ or 1.
 */
export interface Score {
  ecosystem: EcosystemId;
  /** Mean over categories of the strongest level the platform offers at all (not no_mechanism). */
  capability: number;
  /** The same, counting only levels whose adoption the public API reveals (observable or inferred). */
  auditable: number;
  /** Mean over packages of the share of category points their release has, counting unknown as absent. */
  assuranceLow: number | null;
  /** The same, counting unknown as present: the ceiling the data cannot rule out. */
  assuranceHigh: number | null;
  n: number;
  categories: CategoryScore[];
}

/** One category of a platform's score, on the same 0–1 scale. */
export interface CategoryScore {
  category: CategoryId;
  capability: number;
  auditable: number;
  assuranceLow: number | null;
  assuranceHigh: number | null;
  /** Packages by level, from which `assuranceLow` follows: (strong + ½ × weak) / n. */
  counts: LevelCounts;
}

/**
 * Packages per level in one category. `strong` and `weak` are known levels; `weakOrStrong`
 * are weak but could be strong, `unknown` have no known level but could have one. Both
 * count at their known level in the low end and at the possible one in the high end.
 */
export interface LevelCounts {
  strong: number;
  weak: number;
  weakOrStrong: number;
  unknown: number;
  none: number;
}

export interface ScorePoint {
  quarter: string;
  ecosystem: EcosystemId;
  assuranceLow: number;
  assuranceHigh: number;
  n: number;
}

export interface Aggregate {
  snapshotId: string;
  /** The sample this aggregate describes; every number below counts its packages only. */
  layer: SampleLayer;
  asOf: string;
  generatedAt: string;
  quarters: string[];
  coverage: Coverage[];
  matrix: MatrixCell[];
  series: SeriesPoint[];
  categories: typeof CATEGORIES;
  scores: Score[];
  scoreSeries: ScorePoint[];
  /** Start of the window withdrawn versions are counted in (`withdrawalWindowStart`). */
  withdrawalWindowStart: string;
  withdrawals: WithdrawalCell[];
  advisories: AdvisorySummary;
}

/**
 * Known advisories (OSV) for the sampled versions. A vulnerability listed by several databases
 * counts once (its alias group), and counts as known from its group's first publication.
 * Packages OSV was not asked about are left out of every denominator.
 */
export interface AdvisorySummary {
  /** When OSV was queried: the earliest and latest query of the snapshot. */
  queriedFrom: string | null;
  queriedTo: string | null;
  exposure: AdvisoryExposure[];
  series: AdvisoryPoint[];
  withdrawn: WithdrawnMalicious[];
  databases: DatabaseLag[];
  malicious: MaliciousRelease[];
}

export interface AdvisoryExposure {
  ecosystem: EcosystemId;
  /** Packages whose latest version OSV was asked about: the denominator. */
  checked: number;
  /** Latest versions with at least one advisory published by the snapshot. */
  affected: number;
  /** Of those, latest versions with a malicious-package report. */
  malicious: number;
  /** Distinct vulnerabilities (alias groups) affecting them. */
  vulnerabilities: number;
}

export interface AdvisoryPoint {
  quarter: string;
  ecosystem: EcosystemId;
  /** Packages with an anchor this quarter that OSV was asked about. */
  n: number;
  /** Anchors with an advisory published by the quarter's end: known when a default install chose them. */
  knownThen: number;
  /** Anchors with an advisory published by the snapshot. */
  knownNow: number;
}

export interface WithdrawnMalicious {
  ecosystem: EcosystemId;
  kind: WithdrawalKind;
  /** Withdrawn versions of packages OSV was asked about. */
  withdrawn: number;
  /** Of those, versions with a malicious-package report. */
  malicious: number;
}

export interface DatabaseLag {
  ecosystem: EcosystemId;
  /** OSV id prefix: GHSA, PYSEC, RUSTSEC, GO, MAL, … */
  database: string;
  /** Vulnerabilities affecting sampled versions that this database lists. */
  vulnerabilities: number;
  /** Of those, the ones it published first (a tie counts for each database in it). */
  first: number;
  /** Median days behind the first publication, over the ones it did not publish first. */
  medianLagDays: number | null;
}

export interface MaliciousRelease {
  ecosystem: EcosystemId;
  package: string;
  version: string;
  /** The alias group's name (its first-published record) and every record in it. */
  advisory: string;
  ids: string[];
  releasedAt: string | null;
  /** First publication of the report. */
  reportedAt: string | null;
  /** Hours from release to report. */
  hours: number | null;
  /** How the registry withdrew the version, if it did. */
  withdrawn: WithdrawalKind[];
}

/**
 * How often one withdrawal mechanism was used, per ecosystem: packages that withdrew at
 * least one version in the window, and the version share where the registry dates them.
 */
export interface WithdrawalCell {
  ecosystem: EcosystemId;
  kind: WithdrawalKind;
  /** Packages with a row for this kind: the denominator. */
  packages: number;
  packagesWithdrawing: number;
  withdrawnVersions: number;
  /** Null where the registry dates too few versions to count the window (Go). */
  versionsInWindow: number | null;
}

/**
 * The score's categories. Several signals are read from one mechanism (on npm and PyPI the
 * publisher signature, transparency log and, on npm, SLSA provenance and source link all
 * come from the same Sigstore bundle), so scoring every signal separately would count one
 * fact several times. Each category instead asks one question, and a release scores the
 * strongest signal it has for it: 1 for the strong level, ½ for the weak one. Transparency
 * log is in no category: every Sigstore signature is logged, so it would count the
 * signature twice. The matrix still reports it.
 */
export const CATEGORIES = [
  {
    id: "publisher_auth",
    /** Was the upload authenticated by more than a stored secret? */
    levels: [
      { signal: "identity_publish", points: 1 },
      { signal: "mfa_enforced", points: 0.5 },
    ],
  },
  {
    id: "artifact_authenticity",
    /** Can a consumer check that the bytes are the publisher's? */
    levels: [
      { signal: "artifact_signature", points: 1 },
      { signal: "registry_integrity", points: 0.5 },
    ],
  },
  {
    id: "source_provenance",
    /** Can a consumer tie the artifact to its source? */
    levels: [
      { signal: "build_provenance", points: 1 },
      { signal: "source_link", points: 0.5 },
    ],
  },
] as const satisfies ReadonlyArray<{ id: string; levels: ReadonlyArray<{ signal: SignalId; points: number }> }>;
export type CategoryId = (typeof CATEGORIES)[number]["id"];

/** The strongest level among the signals that pass `holds`, or 0. */
function best(category: (typeof CATEGORIES)[number], holds: (s: SignalId) => boolean): number {
  return Math.max(0, ...category.levels.filter((l) => holds(l.signal)).map((l) => l.points));
}

/** The top layer's report is the snapshot's folder; another layer's is a folder inside it. */
export function outDir(snapshotId: string, layer: SampleLayer = "top"): string {
  const root = join(dataDir(), "out", snapshotId);
  return layer === "top" ? root : join(root, layer);
}

export function aggregatePath(snapshotId: string, layer: SampleLayer = "top"): string {
  return join(outDir(snapshotId, layer), "aggregate.json");
}

export function computeAggregate(db: Db, snapshotId: string, layer: SampleLayer = "top"): Aggregate {
  const asOf = snapshotAsOf(db, snapshotId);
  const members = layerMembers(db, snapshotId, layer);

  const availability = new Map(
    db.select().from(signalAvailability).all().map((r) => [`${r.ecosystem}/${r.signalId}`, r]),
  );

  const rows = db
    .select({
      ecosystem: versionSignals.ecosystem,
      packageName: versionSignals.packageName,
      signal: versionSignals.signalId,
      value: versionSignals.value,
      isLatest: packageVersions.isLatest,
      quarterAnchor: packageVersions.quarterAnchor,
    })
    .from(versionSignals)
    .innerJoin(
      packageVersions,
      and(
        eq(versionSignals.snapshotId, packageVersions.snapshotId),
        eq(versionSignals.ecosystem, packageVersions.ecosystem),
        eq(versionSignals.packageName, packageVersions.packageName),
        eq(versionSignals.version, packageVersions.version),
      ),
    )
    .where(eq(versionSignals.snapshotId, snapshotId))
    .all()
    .filter((r) => members.has(`${r.ecosystem}/${r.packageName}`));

  const latestBuckets = new Map<string, string[]>();
  const quarterBuckets = new Map<string, string[]>();
  /** "{scope}/{ecosystem}/{package}" → signal → value, for per-package scores. */
  const perPackage = new Map<string, Map<string, string>>();
  const record = (scope: string, r: (typeof rows)[number]) => {
    const key = `${scope}/${r.ecosystem}/${r.packageName}`;
    let m = perPackage.get(key);
    if (!m) perPackage.set(key, (m = new Map()));
    m.set(r.signal, r.value);
  };
  for (const r of rows) {
    if (r.isLatest) {
      push(latestBuckets, `${r.ecosystem}/${r.signal}`, r.value);
      record("latest", r);
    }
    for (const q of r.quarterAnchor?.split(",") ?? []) {
      push(quarterBuckets, `${q}/${r.ecosystem}/${r.signal}`, r.value);
      record(q, r);
    }
  }

  const present = ECOSYSTEMS.filter((e) => rows.some((r) => r.ecosystem === e));
  const quarters = quarterBoundaries(asOf).map((q) => q.label);

  const matrix: MatrixCell[] = [];
  for (const ecosystem of present) {
    for (const signal of SIGNALS) {
      const av = availability.get(`${ecosystem}/${signal}`);
      if (!av) throw new Error(`no signal_availability row for ${ecosystem}/${signal} — run \`extract\` to seed facts`);
      matrix.push({
        ecosystem,
        signal,
        availability: av.availability as Availability,
        mandatory: av.mandatory,
        ...count(latestBuckets.get(`${ecosystem}/${signal}`) ?? []),
      });
    }
  }

  const series: SeriesPoint[] = [];
  for (const quarter of quarters) {
    for (const ecosystem of present) {
      for (const signal of SIGNALS) {
        const values = quarterBuckets.get(`${quarter}/${ecosystem}/${signal}`);
        if (values) series.push({ quarter, ecosystem, signal, ...count(values) });
      }
    }
  }

  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  /** Per category, the mean over packages of the level known (low) and possible (high). */
  const assurance = (scope: string, ecosystem: EcosystemId) => {
    const prefix = `${scope}/${ecosystem}/`;
    const releases = [...perPackage].filter(([key]) => key.startsWith(prefix)).map(([, values]) => values);
    const categories = CATEGORIES.map((c) => {
      const levels = releases.map((v) => ({ low: best(c, (s) => v.get(s) === "true"), high: best(c, (s) => v.get(s) !== "false") }));
      const counts: LevelCounts = { strong: 0, weak: 0, weakOrStrong: 0, unknown: 0, none: 0 };
      for (const { low, high } of levels) {
        if (low === 1) counts.strong++;
        else if (low > 0) counts[high > low ? "weakOrStrong" : "weak"]++;
        else counts[high > 0 ? "unknown" : "none"]++;
      }
      return { category: c.id, low: mean(levels.map((l) => l.low)), high: mean(levels.map((l) => l.high)), counts };
    });
    return {
      categories,
      low: releases.length ? mean(categories.map((c) => c.low!)) : null,
      high: releases.length ? mean(categories.map((c) => c.high!)) : null,
      n: releases.length,
    };
  };

  const scores: Score[] = present.map((ecosystem) => {
    const av = (s: SignalId) => matrix.find((c) => c.ecosystem === ecosystem && c.signal === s)!.availability;
    const a = assurance("latest", ecosystem);
    const categories: CategoryScore[] = CATEGORIES.map((c, i) => ({
      category: c.id,
      capability: best(c, (s) => av(s) !== "no_mechanism"),
      auditable: best(c, (s) => av(s) === "observable" || av(s) === "inferred"),
      assuranceLow: a.categories[i]!.low,
      assuranceHigh: a.categories[i]!.high,
      counts: a.categories[i]!.counts,
    }));
    return {
      ecosystem,
      capability: mean(categories.map((c) => c.capability))!,
      auditable: mean(categories.map((c) => c.auditable))!,
      assuranceLow: a.low,
      assuranceHigh: a.high,
      n: a.n,
      categories,
    };
  });

  const scoreSeries: ScorePoint[] = [];
  for (const quarter of quarters) {
    for (const ecosystem of present) {
      const a = assurance(quarter, ecosystem);
      if (a.n > 0) scoreSeries.push({ quarter, ecosystem, assuranceLow: a.low!, assuranceHigh: a.high!, n: a.n });
    }
  }

  return {
    snapshotId,
    layer,
    asOf: asOf.toISOString(),
    generatedAt: new Date().toISOString(),
    quarters,
    coverage: coverage(db, snapshotId, layer),
    matrix,
    series,
    categories: CATEGORIES,
    scores,
    scoreSeries,
    withdrawalWindowStart: withdrawalWindowStart(asOf).toISOString(),
    withdrawals: withdrawals(db, snapshotId, members),
    advisories: advisorySummary(db, snapshotId, asOf, members),
  };
}

/** `members`: the layer's "{ecosystem}/{package}" keys; packages outside it are left out of every count. */
export function advisorySummary(db: Db, snapshotId: string, asOf: Date, members: Set<string>): AdvisorySummary {
  const records = db.select().from(advisories).where(eq(advisories.snapshotId, snapshotId)).all();
  const group = aliasGroups(records.map((r) => ({ id: r.advisoryId, aliases: r.aliases, published: r.published, withdrawn: r.withdrawn })));

  /** Per alias group: first publication (ms), whether it reports malware, and its records. */
  const groups = new Map<string, { first: number; malicious: boolean; members: typeof records }>();
  for (const r of records) {
    const g = group.get(r.advisoryId);
    if (!g) continue;
    const entry = groups.get(g) ?? { first: Number.POSITIVE_INFINITY, malicious: false, members: [] };
    if (r.published) entry.first = Math.min(entry.first, Date.parse(r.published));
    entry.malicious ||= r.malicious;
    entry.members.push(r);
    groups.set(g, entry);
  }

  const checkedRows = db
    .select({ ecosystem: packages.ecosystem, name: packages.packageName, at: packages.osvQueriedAt })
    .from(packages)
    .where(and(eq(packages.snapshotId, snapshotId), isNotNull(packages.osvQueriedAt)))
    .all()
    .filter((r) => members.has(`${r.ecosystem}/${r.name}`));
  const checked = new Set(checkedRows.map((r) => `${r.ecosystem}/${r.name}`));
  const queried = checkedRows.map((r) => r.at!).sort();

  /** "{ecosystem}/{package}@{version}" → alias groups OSV lists for it. */
  const groupsOf = new Map<string, Set<string>>();
  const matchRows = db.select().from(advisoryMatches).where(eq(advisoryMatches.snapshotId, snapshotId)).all();
  for (const m of matchRows) {
    const g = group.get(m.advisoryId);
    if (!g) continue;
    const key = `${m.ecosystem}/${m.packageName}@${m.version}`;
    groupsOf.set(key, (groupsOf.get(key) ?? new Set()).add(g));
  }
  const known = (key: string, by: number) => [...(groupsOf.get(key) ?? [])].filter((g) => groups.get(g)!.first <= by);

  const versions = db
    .select({ ecosystem: packageVersions.ecosystem, name: packageVersions.packageName, version: packageVersions.version, isLatest: packageVersions.isLatest, quarterAnchor: packageVersions.quarterAnchor })
    .from(packageVersions)
    .where(eq(packageVersions.snapshotId, snapshotId))
    .all()
    .filter((v) => checked.has(`${v.ecosystem}/${v.name}`));
  const present = ECOSYSTEMS.filter((e) => versions.some((v) => v.ecosystem === e));
  const now = asOf.getTime();

  const exposure: AdvisoryExposure[] = present.map((ecosystem) => {
    const latest = versions.filter((v) => v.ecosystem === ecosystem && v.isLatest).map((v) => known(`${ecosystem}/${v.name}@${v.version}`, now));
    return {
      ecosystem,
      checked: latest.length,
      affected: latest.filter((gs) => gs.length > 0).length,
      malicious: latest.filter((gs) => gs.some((g) => groups.get(g)!.malicious)).length,
      vulnerabilities: new Set(latest.flat()).size,
    };
  });

  const series: AdvisoryPoint[] = [];
  for (const q of quarterBoundaries(asOf)) {
    for (const ecosystem of present) {
      const anchors = versions.filter((v) => v.ecosystem === ecosystem && v.quarterAnchor?.split(",").includes(q.label)).map((v) => `${ecosystem}/${v.name}@${v.version}`);
      if (anchors.length === 0) continue;
      series.push({
        quarter: q.label,
        ecosystem,
        n: anchors.length,
        knownThen: anchors.filter((k) => known(k, q.at.getTime()).length > 0).length,
        knownNow: anchors.filter((k) => known(k, now).length > 0).length,
      });
    }
  }

  const withdrawnRows = db.select().from(packageWithdrawals).where(eq(packageWithdrawals.snapshotId, snapshotId)).all().filter((w) => checked.has(`${w.ecosystem}/${w.packageName}`));
  const isMalicious = (key: string) => [...(groupsOf.get(key) ?? [])].some((g) => groups.get(g)!.malicious);
  const withdrawnCells = new Map<string, WithdrawnMalicious>();
  /** "{ecosystem}/{package}@{version}" → how it was withdrawn. */
  const withdrawnHow = new Map<string, WithdrawalKind[]>();
  for (const w of withdrawnRows) {
    const cell = withdrawnCells.get(`${w.ecosystem}/${w.kind}`) ?? { ecosystem: w.ecosystem as EcosystemId, kind: w.kind as WithdrawalKind, withdrawn: 0, malicious: 0 };
    for (const v of w.withdrawnVersions ? w.withdrawnVersions.split(",") : []) {
      const key = `${w.ecosystem}/${w.packageName}@${v}`;
      cell.withdrawn++;
      if (isMalicious(key)) cell.malicious++;
      withdrawnHow.set(key, [...(withdrawnHow.get(key) ?? []), w.kind as WithdrawalKind]);
    }
    withdrawnCells.set(`${w.ecosystem}/${w.kind}`, cell);
  }
  const kindOrder = (c: WithdrawnMalicious) => ECOSYSTEMS.indexOf(c.ecosystem) * 10 + WITHDRAWAL_KINDS.indexOf(c.kind);

  const databases: DatabaseLag[] = present.flatMap((ecosystem) => {
    const touched = new Set(matchRows.filter((m) => m.ecosystem === ecosystem && checked.has(`${m.ecosystem}/${m.packageName}`)).flatMap((m) => group.get(m.advisoryId) ?? []));
    const byDb = new Map<string, number[]>();
    for (const g of touched) {
      const { first, members } = groups.get(g)!;
      if (!Number.isFinite(first)) continue;
      const earliest = new Map<string, number>();
      for (const r of members) {
        if (!r.published) continue;
        const name = databaseOf(r.advisoryId);
        earliest.set(name, Math.min(earliest.get(name) ?? Number.POSITIVE_INFINITY, Date.parse(r.published)));
      }
      for (const [name, t] of earliest) byDb.set(name, [...(byDb.get(name) ?? []), (t - first) / 86_400_000]);
    }
    return [...byDb]
      .map(([database, lags]) => ({ ecosystem, database, vulnerabilities: lags.length, first: lags.filter((d) => d === 0).length, medianLagDays: median(lags.filter((d) => d > 0)) }))
      .sort((a, b) => b.vulnerabilities - a.vulnerabilities || a.database.localeCompare(b.database));
  });

  const malicious: MaliciousRelease[] = matchRows
    .filter((m) => checked.has(`${m.ecosystem}/${m.packageName}`) && groups.get(group.get(m.advisoryId) ?? "")?.malicious)
    // One row per version and vulnerability, however many of the group's records matched it.
    .filter((m, i, all) => all.findIndex((o) => o.ecosystem === m.ecosystem && o.packageName === m.packageName && o.version === m.version && group.get(o.advisoryId) === group.get(m.advisoryId)) === i)
    .map((m) => {
      const g = group.get(m.advisoryId)!;
      const { first, members } = groups.get(g)!;
      const reportedAt = Number.isFinite(first) ? new Date(first).toISOString() : null;
      const hours = reportedAt && m.releasedAt ? (first - Date.parse(m.releasedAt)) / 3_600_000 : null;
      return {
        ecosystem: m.ecosystem as EcosystemId,
        package: m.packageName,
        version: m.version,
        advisory: g,
        ids: members.map((r) => r.advisoryId).sort(),
        releasedAt: m.releasedAt,
        reportedAt,
        hours,
        withdrawn: withdrawnHow.get(`${m.ecosystem}/${m.packageName}@${m.version}`) ?? [],
      };
    })
    .sort((a, b) => ECOSYSTEMS.indexOf(a.ecosystem) - ECOSYSTEMS.indexOf(b.ecosystem) || a.package.localeCompare(b.package) || a.version.localeCompare(b.version));

  return {
    queriedFrom: queried[0] ?? null,
    queriedTo: queried.at(-1) ?? null,
    exposure,
    series,
    withdrawn: [...withdrawnCells.values()].sort((a, b) => kindOrder(a) - kindOrder(b)),
    databases,
    malicious,
  };
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function withdrawals(db: Db, snapshotId: string, members: Set<string>): WithdrawalCell[] {
  const rows = db.select().from(packageWithdrawals).where(eq(packageWithdrawals.snapshotId, snapshotId)).all().filter((r) => members.has(`${r.ecosystem}/${r.packageName}`));
  const cells = new Map<string, WithdrawalCell>();
  for (const r of rows) {
    const key = `${r.ecosystem}/${r.kind}`;
    const c = cells.get(key) ?? {
      ecosystem: r.ecosystem as EcosystemId,
      kind: r.kind as WithdrawalKind,
      packages: 0,
      packagesWithdrawing: 0,
      withdrawnVersions: 0,
      versionsInWindow: 0 as number | null,
    };
    c.packages++;
    if (r.withdrawnCount > 0) c.packagesWithdrawing++;
    c.withdrawnVersions += r.withdrawnCount;
    c.versionsInWindow = r.versionsInWindow == null || c.versionsInWindow == null ? null : c.versionsInWindow + r.versionsInWindow;
    cells.set(key, c);
  }
  const order = (c: WithdrawalCell) => ECOSYSTEMS.indexOf(c.ecosystem) * 10 + WITHDRAWAL_KINDS.indexOf(c.kind);
  return [...cells.values()].sort((a, b) => order(a) - order(b));
}

export async function runAggregate(db: Db, snapshotId: string, layer: SampleLayer = "top"): Promise<{ aggregate: Aggregate; path: string }> {
  const aggregate = computeAggregate(db, snapshotId, layer);
  await mkdir(outDir(snapshotId, layer), { recursive: true });
  const path = aggregatePath(snapshotId, layer);
  await Bun.write(path, JSON.stringify(aggregate, null, 2) + "\n");
  return { aggregate, path };
}

function coverage(db: Db, snapshotId: string, layer: SampleLayer): Coverage[] {
  const rows = db
    .select({
      ecosystem: packages.ecosystem,
      rankFrame: sampleMembers.rankFrame,
      packageName: packages.packageName,
      fetchTimestamp: packages.fetchTimestamp,
      fetchError: packages.fetchError,
      extractError: packages.extractError,
      latestVersion: packages.latestVersion,
    })
    .from(packages)
    .innerJoin(
      sampleMembers,
      and(eq(sampleMembers.snapshotId, packages.snapshotId), eq(sampleMembers.ecosystem, packages.ecosystem), eq(sampleMembers.packageName, packages.packageName)),
    )
    .where(and(eq(packages.snapshotId, snapshotId), eq(sampleMembers.layer, layer)))
    .all();

  const extracted = new Set(
    db
      .selectDistinct({ ecosystem: packageVersions.ecosystem, name: packageVersions.packageName })
      .from(packageVersions)
      .where(eq(packageVersions.snapshotId, snapshotId))
      .all()
      .map((r) => `${r.ecosystem}/${r.name}`),
  );

  return ECOSYSTEMS.filter((e) => rows.some((r) => r.ecosystem === e)).map((ecosystem) => {
    const mine = rows.filter((r) => r.ecosystem === ecosystem);
    return {
      ecosystem,
      rankFrame: mine[0]!.rankFrame,
      sampled: mine.length,
      fetched: mine.filter((r) => r.fetchTimestamp && !r.fetchError).length,
      fetchErrors: mine.filter((r) => r.fetchError).length,
      extracted: mine.filter((r) => extracted.has(`${ecosystem}/${r.packageName}`)).length,
      extractErrors: mine.filter((r) => r.extractError).length,
    };
  });
}

function push(map: Map<string, string[]>, key: string, value: string): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function count(values: string[]): Counts {
  const t = values.filter((v) => v === "true").length;
  const f = values.filter((v) => v === "false").length;
  const u = values.length - t - f;
  const [lo, hi] = wilson(t, values.length) ?? [null, null];
  return {
    n: values.length,
    t,
    f,
    u,
    pct: values.length ? t / values.length : null,
    pctKnown: t + f ? t / (t + f) : null,
    lo,
    hi,
  };
}

/** z for a two-sided 95% interval. */
const Z95 = 1.959964;

/**
 * The Wilson score interval for `k` successes in `n` trials (95% by default). Unlike the
 * normal approximation it stays inside [0, 1] and is not zero-width at 0% or 100%, which
 * matters for rare signals and small per-quarter samples.
 */
export function wilson(k: number, n: number, z = Z95): [number, number] | null {
  if (n === 0) return null;
  const p = k / n;
  const z2 = z * z;
  const centre = (p + z2 / (2 * n)) / (1 + z2 / n);
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  // Exact at the ends, where rounding would otherwise leave 0.9999… for 10 of 10.
  return [k === 0 ? 0 : Math.max(0, centre - half), k === n ? 1 : Math.min(1, centre + half)];
}
