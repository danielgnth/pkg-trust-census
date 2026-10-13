/**
 * Extract stage: cached responses → `packages`, `package_versions`, `version_signals`.
 *
 * Pure: reads only through a `CacheSource`, so it never touches the network and can be
 * re-run in seconds while parsers are refined. Each package is rewritten wholesale inside
 * one transaction, so a re-run replaces rather than accumulates rows.
 */

import { and, eq } from "drizzle-orm";
import type { EcosystemId, ExtractedPackage } from "../types.ts";
import { CacheSource } from "../http/client.ts";
import type { ResponseCache } from "../http/cache.ts";
import { getAdapter } from "../adapters/index.ts";
import { snapshotAsOf, type Db } from "../db/open.ts";
import { packageVersions, packages, versionSignals } from "../db/schema.ts";
import { packageVersionInsert, validateAll, versionSignalInsert } from "../db/validation.ts";
import { seedFacts } from "../facts/index.ts";
import { loadCandidates } from "./rank.ts";

export interface ExtractSummary {
  ecosystem: EcosystemId;
  packages: number;
  extracted: number;
  failed: number;
  versions: number;
  signals: number;
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

    const summary: ExtractSummary = { ecosystem: eco, packages: candidates.length, extracted: 0, failed: 0, versions: 0, signals: 0 };
    for (const [i, c] of candidates.entries()) {
      const progress = { ecosystem: eco, index: i + 1, total: candidates.length, package: c.name };
      try {
        const pkg = await adapter.extract(c, source, ctx);
        const written = persist(db, snapshotId, pkg);
        summary.extracted++;
        summary.versions += written.versions;
        summary.signals += written.signals;
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

function persist(db: Db, snapshotId: string, pkg: ExtractedPackage): { versions: number; signals: number } {
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
      rawResponsePath: v.raw?.path ?? null,
      rawSha256: v.raw?.sha256 ?? null,
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
      })),
    ),
    "version_signals",
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
      })
      .where(packageWhere(snapshotId, pkg.ecosystem, pkg.name))
      .run();
    for (const row of versionRows) tx.insert(packageVersions).values(row).run();
    for (const row of signalRows) tx.insert(versionSignals).values(row).run();
  });
  return { versions: versionRows.length, signals: signalRows.length };
}

function clearPackage(db: Db, snapshotId: string, ecosystem: EcosystemId, name: string, error: string): void {
  db.transaction((tx) => {
    deleteRows(tx as unknown as Db, snapshotId, ecosystem, name);
    tx.update(packages).set({ extractError: error }).where(packageWhere(snapshotId, ecosystem, name)).run();
  });
}

/** Signals first: they reference versions through a foreign key. */
function deleteRows(db: Db, snapshotId: string, ecosystem: EcosystemId, name: string): void {
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
