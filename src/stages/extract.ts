/**
 * Extract stage: cached responses → `packages`, `package_versions`, `version_signals`,
 * `package_withdrawals`, and the OSV advisories matched to those versions.
 *
 * Pure: reads only through a `CacheSource`, so it never touches the network and can be
 * re-run in seconds while parsers are refined. Each package is rewritten wholesale inside
 * one transaction, so a re-run replaces rather than accumulates rows.
 */

import { and, eq } from "drizzle-orm";
import type { EcosystemId, ExtractedPackage } from "../types.ts";
import { advisoryVersions, gatherAdvisories, type PackageAdvisories } from "../advisories/osv.ts";
import { purlOf } from "../advisories/purl.ts";
import { CacheSource } from "../http/client.ts";
import type { ResponseCache } from "../http/cache.ts";
import { getAdapter } from "../adapters/index.ts";
import { snapshotAsOf, type Db } from "../db/open.ts";
import { advisories, advisoryMatches, packageVersions, packageWithdrawals, packages, versionSignals } from "../db/schema.ts";
import { advisoryInsert, advisoryMatchInsert, packageVersionInsert, packageWithdrawalInsert, validateAll, versionSignalInsert } from "../db/validation.ts";
import { seedFacts } from "../facts/index.ts";
import { loadCandidates } from "./rank.ts";

export interface ExtractSummary {
  ecosystem: EcosystemId;
  packages: number;
  extracted: number;
  failed: number;
  versions: number;
  signals: number;
  /** Version–advisory pairs OSV reported. */
  advisoryMatches: number;
}

export interface ExtractProgress {
  ecosystem: EcosystemId;
  index: number;
  total: number;
  package: string;
  error?: string;
}

export async function runExtract(
  ecosystems: EcosystemId[],
  snapshotId: string,
  db: Db,
  cache: ResponseCache,
  onProgress?: (p: ExtractProgress) => void,
): Promise<ExtractSummary[]> {
  seedFacts(db);
  const ctx = { asOf: snapshotAsOf(db, snapshotId) };
  const source = new CacheSource(cache);
  const summaries: ExtractSummary[] = [];

  for (const eco of ecosystems) {
    const adapter = getAdapter(eco);
    if (!adapter) continue;
    const candidates = loadCandidates(db, snapshotId, eco);
    if (candidates.length === 0) continue;

    const summary: ExtractSummary = { ecosystem: eco, packages: candidates.length, extracted: 0, failed: 0, versions: 0, signals: 0, advisoryMatches: 0 };
    for (const [i, c] of candidates.entries()) {
      const progress = { ecosystem: eco, index: i + 1, total: candidates.length, package: c.name };
      try {
        const pkg = await adapter.extract(c, source, ctx);
        const osv = await gatherAdvisories(source, eco, c.name, advisoryVersions(pkg));
        const written = persist(db, snapshotId, pkg, osv);
        summary.extracted++;
        summary.versions += written.versions;
        summary.signals += written.signals;
        summary.advisoryMatches += written.advisoryMatches;
        onProgress?.(progress);
      } catch (err) {
        // A package that cannot be extracted keeps its row with the reason attached, so
        // the gap is visible in the dataset rather than silently shrinking the sample.
        const message = err instanceof Error ? err.message : String(err);
        clearPackage(db, snapshotId, eco, c.name, message);
        summary.failed++;
        onProgress?.({ ...progress, error: message });
      }
    }
    summaries.push(summary);
  }
  return summaries;
}

function persist(db: Db, snapshotId: string, pkg: ExtractedPackage, osv: PackageAdvisories | null): { versions: number; signals: number; advisoryMatches: number } {
  const key = { snapshotId, ecosystem: pkg.ecosystem, packageName: pkg.name };

  // Validated before the transaction opens, so an adapter bug aborts with a message naming
  // the package and field rather than a bare constraint violation halfway through.
  const versionRows = validateAll(
    packageVersionInsert,
    pkg.versions.map((v) => ({
      ...key,
      version: v.version,
      publishedAt: v.publishedAt,
      isLatest: v.isLatest,
      quarterAnchor: v.quarterAnchor,
      purl: purlOf(pkg.ecosystem, pkg.name, v.version),
    })),
    "package_versions",
  );
  const signalRows = validateAll(
    versionSignalInsert,
    pkg.versions.flatMap((v) =>
      v.signals.map((s) => ({
        ...key,
        version: v.version,
        signalId: s.signal,
        value: s.value,
        evidence: s.evidence,
        signalSource: s.signalSource,
        responses: s.responses,
      })),
    ),
    "version_signals",
  );

  const withdrawalRows = validateAll(
    packageWithdrawalInsert,
    (pkg.withdrawals ?? []).map((w) => ({
      ...key,
      kind: w.kind,
      versionsInWindow: w.versionsInWindow,
      withdrawnCount: w.withdrawn.length,
      withdrawnVersions: w.withdrawn.join(","),
    })),
    "package_withdrawals",
  );

  const advisoryRows = validateAll(advisoryInsert, (osv?.advisories ?? []).map((a) => ({ snapshotId, advisoryId: a.id, ...a })), "advisories");
  const releasedAt = new Map<string, string | null>([
    ...(pkg.withdrawals ?? []).flatMap((w) => Object.entries(w.releasedAt ?? {})),
    ...pkg.versions.map((v): [string, string | null] => [v.version, v.publishedAt]),
  ]);
  const matchRows = validateAll(
    advisoryMatchInsert,
    (osv?.matches ?? []).map((m) => ({
      ...key,
      version: m.version,
      advisoryId: m.advisoryId,
      releasedAt: releasedAt.get(m.version) ?? null,
      responses: osv!.responses,
    })),
    "advisory_matches",
  );

  db.transaction((tx) => {
    deleteRows(tx as unknown as Db, snapshotId, pkg.ecosystem, pkg.name);
    tx.update(packages)
      .set({
        latestVersion: pkg.latestVersion,
        latestPublishDate: pkg.latestPublishDate,
        maintainerCount: pkg.maintainerCount,
        maintainerCountSource: pkg.maintainerCountSource,
        repositoryUrl: pkg.repositoryUrl,
        extractError: null,
        osvQueriedAt: osv?.queriedAt ?? null,
      })
      .where(packageWhere(snapshotId, pkg.ecosystem, pkg.name))
      .run();
    for (const row of versionRows) tx.insert(packageVersions).values(row).run();
    for (const row of signalRows) tx.insert(versionSignals).values(row).run();
    for (const row of withdrawalRows) tx.insert(packageWithdrawals).values(row).run();
    // Records are shared between packages; the copy read last is the one kept.
    for (const row of advisoryRows) {
      const { snapshotId: _s, advisoryId: _a, ...rest } = row;
      tx.insert(advisories).values(row).onConflictDoUpdate({ target: [advisories.snapshotId, advisories.advisoryId], set: rest }).run();
    }
    for (const row of matchRows) tx.insert(advisoryMatches).values(row).run();
  });
  return { versions: versionRows.length, signals: signalRows.length, advisoryMatches: matchRows.length };
}

function clearPackage(db: Db, snapshotId: string, ecosystem: EcosystemId, name: string, error: string): void {
  db.transaction((tx) => {
    deleteRows(tx as unknown as Db, snapshotId, ecosystem, name);
    tx.update(packages).set({ extractError: error, osvQueriedAt: null }).where(packageWhere(snapshotId, ecosystem, name)).run();
  });
}

/** Signals first: they reference versions through a foreign key. */
function deleteRows(db: Db, snapshotId: string, ecosystem: EcosystemId, name: string): void {
  db.delete(advisoryMatches)
    .where(and(eq(advisoryMatches.snapshotId, snapshotId), eq(advisoryMatches.ecosystem, ecosystem), eq(advisoryMatches.packageName, name)))
    .run();
  db.delete(packageWithdrawals)
    .where(and(eq(packageWithdrawals.snapshotId, snapshotId), eq(packageWithdrawals.ecosystem, ecosystem), eq(packageWithdrawals.packageName, name)))
    .run();
  db.delete(versionSignals)
    .where(and(eq(versionSignals.snapshotId, snapshotId), eq(versionSignals.ecosystem, ecosystem), eq(versionSignals.packageName, name)))
    .run();
  db.delete(packageVersions)
    .where(and(eq(packageVersions.snapshotId, snapshotId), eq(packageVersions.ecosystem, ecosystem), eq(packageVersions.packageName, name)))
    .run();
}

function packageWhere(snapshotId: string, ecosystem: EcosystemId, name: string) {
  return and(eq(packages.snapshotId, snapshotId), eq(packages.ecosystem, ecosystem), eq(packages.packageName, name));
}
