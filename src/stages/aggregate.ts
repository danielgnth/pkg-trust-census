/**
 * Aggregate stage: the ecosystem × signal maturity matrix (latest versions), the quarterly
 * adoption series (anchor versions), and per-ecosystem coverage.
 *
 * Denominators are packages, not versions: each package contributes exactly one version
 * to a matrix cell (its latest) and at most one to a quarter (its anchor). `pct` divides
 * by every package in the cell, so `unknown` counts against adoption — a conservative
 * lower bound. `pctKnown` excludes unknowns and is reported alongside, never instead.
 */

import { and, eq } from "drizzle-orm";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { ECOSYSTEMS, SIGNALS, WITHDRAWAL_KINDS, type Availability, type EcosystemId, type SignalId, type WithdrawalKind } from "../types.ts";
import { snapshotAsOf, type Db } from "../db/open.ts";
import { packageVersions, packageWithdrawals, packages, signalAvailability, versionSignals } from "../db/schema.ts";
import { dataDir } from "../http/cache.ts";
import { quarterBoundaries, withdrawalWindowStart } from "../extract/quarters.ts";

export interface Counts {
  n: number;
  t: number;
  f: number;
  u: number;
  /** true / n — unknowns count against adoption. */
  pct: number | null;
  /** true / (true + false) — unknowns excluded. */
  pctKnown: number | null;
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

export function outDir(snapshotId: string): string {
  return join(dataDir(), "out", snapshotId);
}

export function aggregatePath(snapshotId: string): string {
  return join(outDir(snapshotId), "aggregate.json");
}

export function computeAggregate(db: Db, snapshotId: string): Aggregate {
  const asOf = snapshotAsOf(db, snapshotId);

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
    .all();

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
    asOf: asOf.toISOString(),
    generatedAt: new Date().toISOString(),
    quarters,
    coverage: coverage(db, snapshotId),
    matrix,
    series,
    categories: CATEGORIES,
    scores,
    scoreSeries,
    withdrawalWindowStart: withdrawalWindowStart(asOf).toISOString(),
    withdrawals: withdrawals(db, snapshotId),
  };
}

function withdrawals(db: Db, snapshotId: string): WithdrawalCell[] {
  const rows = db.select().from(packageWithdrawals).where(eq(packageWithdrawals.snapshotId, snapshotId)).all();
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

export async function runAggregate(db: Db, snapshotId: string): Promise<{ aggregate: Aggregate; path: string }> {
  const aggregate = computeAggregate(db, snapshotId);
  await mkdir(outDir(snapshotId), { recursive: true });
  const path = aggregatePath(snapshotId);
  await Bun.write(path, JSON.stringify(aggregate, null, 2) + "\n");
  return { aggregate, path };
}

function coverage(db: Db, snapshotId: string): Coverage[] {
  const rows = db
    .select({
      ecosystem: packages.ecosystem,
      rankFrame: packages.rankFrame,
      packageName: packages.packageName,
      fetchTimestamp: packages.fetchTimestamp,
      fetchError: packages.fetchError,
      extractError: packages.extractError,
      latestVersion: packages.latestVersion,
    })
    .from(packages)
    .where(eq(packages.snapshotId, snapshotId))
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
  return {
    n: values.length,
    t,
    f,
    u,
    pct: values.length ? t / values.length : null,
    pctKnown: t + f ? t / (t + f) : null,
  };
}
