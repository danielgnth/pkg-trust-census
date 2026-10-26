/**
 * The whole-registry layer: how common Sigstore attestations are across every package of npm,
 * PyPI, RubyGems and Maven Central, and how that changed, read from deps.dev's BigQuery dataset.
 *
 * It mirrors the census's own quarter anchors: at each quarter's end, every package's newest
 * release published by then (pre-releases excluded), and whether deps.dev records an attestation
 * for it, verified, and naming a source repository and commit. The same at the snapshot instant
 * gives the "latest release" figure. Packages whose newest release is older than 36 months are
 * counted apart, so the active share compares with the random sample's.
 *
 * Third-party data, reported on its own page (`registry.md`), never in the matrix or the score.
 * Only the aggregate is stored, and committed: `data/bigquery/{snapshot}/attestations.json`.
 */

import { quarterBoundaries } from "../extract/quarters.ts";
import { ACTIVITY_MONTHS } from "../sample/draw.ts";
import type { EcosystemId } from "../types.ts";
import { DATASET, depsdevSnapshot, queriesDir, storedQuery, type StoredQuery } from "./client.ts";

/** The registries deps.dev records Sigstore attestations for. */
export const REGISTRY_SYSTEMS: Partial<Record<EcosystemId, string>> = { npm: "NPM", pypi: "PYPI", rubygems: "RUBYGEMS", maven: "MAVEN" };

export interface RegistryRow {
  /** A quarter label, or "snapshot" for the newest release at the snapshot instant. */
  point: string;
  system: string;
  /** Packages with a release by then. */
  packages: number;
  attested: number;
  verified: number;
  linked: number;
  /** Of those, packages whose newest release is within the activity window, and how many are attested. */
  active: number;
  active_attested: number;
}

export const ATTESTATIONS_SQL = `
WITH releases AS (
  SELECT
    System AS system,
    Name AS name,
    UpstreamPublishedAt AS t,
    ARRAY_LENGTH(Attestations) > 0 AS attested,
    ARRAY_LENGTH(Attestations) > 0 AND NOT EXISTS (SELECT 1 FROM UNNEST(Attestations) a WHERE NOT IFNULL(a.Verified, FALSE)) AS verified,
    EXISTS (SELECT 1 FROM UNNEST(Attestations) a WHERE IFNULL(a.SourceRepository, '') != '' AND IFNULL(a.Commit, '') != '') AS linked
  FROM \`${DATASET}.PackageVersions\`
  WHERE SnapshotAt = TIMESTAMP(@snapshot)
    AND System IN UNNEST(@systems)
    AND VersionInfo.IsRelease
    AND UpstreamPublishedAt IS NOT NULL
),
points AS (
  SELECT p.label, TIMESTAMP(p.until) AS boundary FROM UNNEST(@points) AS p
),
anchors AS (
  SELECT
    points.label,
    points.boundary,
    releases.system,
    releases.name,
    ARRAY_AGG(STRUCT(releases.t, releases.attested, releases.verified, releases.linked) ORDER BY releases.t DESC LIMIT 1)[OFFSET(0)] AS newest
  FROM releases
  JOIN points ON releases.t <= points.boundary
  GROUP BY 1, 2, 3, 4
)
SELECT
  label AS point,
  system,
  COUNT(*) AS packages,
  COUNTIF(newest.attested) AS attested,
  COUNTIF(newest.verified) AS verified,
  COUNTIF(newest.linked) AS linked,
  COUNTIF(newest.t > TIMESTAMP(DATETIME_SUB(DATETIME(boundary), INTERVAL @months MONTH))) AS active,
  COUNTIF(newest.attested AND newest.t > TIMESTAMP(DATETIME_SUB(DATETIME(boundary), INTERVAL @months MONTH))) AS active_attested
FROM anchors
GROUP BY 1, 2
ORDER BY 1, 2
`;

/** Runs (or reads back) the whole-registry query for a snapshot. */
export async function registryAttestations(snapshotId: string, asOf: Date): Promise<StoredQuery<RegistryRow>> {
  const snapshot = await depsdevSnapshot(snapshotId, asOf);
  const points = [
    ...quarterBoundaries(asOf).map((q) => ({ label: q.label, until: q.at.toISOString() })),
    { label: "snapshot", until: asOf.toISOString() },
  ];
  const params = { systems: Object.values(REGISTRY_SYSTEMS), points, months: ACTIVITY_MONTHS };
  const result = await storedQuery<RegistryRow>(queriesDir(snapshotId), "attestations", ATTESTATIONS_SQL, params, snapshot);
  return { ...result, rows: result.rows.map((r) => ({ ...r, ...Object.fromEntries(["packages", "attested", "verified", "linked", "active", "active_attested"].map((k) => [k, Number(r[k as keyof RegistryRow])])) }) as RegistryRow) };
}

/** The stored result, if the query has run for this snapshot; the report reads it offline. */
export async function storedRegistryAttestations(snapshotId: string): Promise<StoredQuery<RegistryRow> | null> {
  const file = Bun.file(`${queriesDir(snapshotId)}/attestations.json`);
  return (await file.exists()) ? ((await file.json()) as StoredQuery<RegistryRow>) : null;
}
