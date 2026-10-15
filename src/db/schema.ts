/**
 * Drizzle schema — the single source of truth for the database.
 *
 * CHECK constraints encode the invariants the database itself can enforce (enum domains,
 * non-negative counts). Richer rules that SQL cannot express — timestamp formats, quarter
 * labels, sha256 shape, cross-field consistency — live in `validation.ts` and run at the
 * insert boundary. Both layers matter: the zod layer produces a readable error naming the
 * offending field, the CHECK layer means nothing bad lands even if a future caller
 * bypasses the helpers.
 */

import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { ECOSYSTEMS, SIGNALS, WITHDRAWAL_KINDS, type ResponseRef } from "../types.ts";

/** Renders a string[] as a SQL `IN (...)` list for CHECK constraints. */
const inList = (values: readonly string[]) => values.map((v) => `'${v}'`).join(", ");

const ECOSYSTEM_LIST = inList(ECOSYSTEMS);
const SIGNAL_LIST = inList(SIGNALS);
const WITHDRAWAL_LIST = inList(WITHDRAWAL_KINDS);

export const snapshots = sqliteTable("snapshots", {
  snapshotId: text("snapshot_id").primaryKey(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  toolVersion: text("tool_version").notNull(),
  configJson: text("config_json").notNull(),
});

/** Hand-curated from primary sources, not scraped. Filled in M7 with citations. */
export const ecosystemFacts = sqliteTable(
  "ecosystem_facts",
  {
    ecosystem: text("ecosystem").primaryKey(),
    displayName: text("display_name").notNull(),
    registryUrl: text("registry_url").notNull(),
    /** Nullable: unknown until cited, which is different from "no". */
    mandates2fa: integer("mandates_2fa", { mode: "boolean" }),
    mfaPolicyNote: text("mfa_policy_note"),
    trustedPublishingGaDate: text("trusted_publishing_ga_date"),
    trustedPublishingMechanism: text("trusted_publishing_mechanism"),
    notes: text("notes"),
    /** Newline-separated citation URLs. */
    sources: text("sources"),
  },
  (t) => [check("ecosystem_facts_ecosystem", sql.raw(`${t.ecosystem.name} IN (${ECOSYSTEM_LIST})`))],
);

/**
 * Whether each ecosystem exposes each signal at all — what lets the maturity matrix
 * distinguish "0% adoption" from "the registry will not tell us".
 */
export const signalAvailability = sqliteTable(
  "signal_availability",
  {
    ecosystem: text("ecosystem").notNull(),
    signalId: text("signal_id").notNull(),
    availability: text("availability").notNull(),
    /** Registry-wide requirement, e.g. Maven's mandatory GPG signing. */
    mandatory: integer("mandatory", { mode: "boolean" }).notNull().default(false),
    detectionMethod: text("detection_method"),
    notes: text("notes"),
  },
  (t) => [
    primaryKey({ columns: [t.ecosystem, t.signalId] }),
    check("signal_availability_ecosystem", sql.raw(`${t.ecosystem.name} IN (${ECOSYSTEM_LIST})`)),
    check("signal_availability_signal", sql.raw(`${t.signalId.name} IN (${SIGNAL_LIST})`)),
    check(
      "signal_availability_value",
      sql.raw(`${t.availability.name} IN ('observable', 'inferred', 'not_exposed', 'no_mechanism')`),
    ),
  ],
);

export const packages = sqliteTable(
  "packages",
  {
    snapshotId: text("snapshot_id")
      .notNull()
      .references(() => snapshots.snapshotId),
    ecosystem: text("ecosystem").notNull(),
    packageName: text("package_name").notNull(),
    rankFrame: text("rank_frame").notNull(),
    rank: integer("rank").notNull(),
    downloadCount: integer("download_count"),
    dependentCount: integer("dependent_count"),
    latestVersion: text("latest_version"),
    latestPublishDate: text("latest_publish_date"),
    maintainerCount: integer("maintainer_count"),
    maintainerCountSource: text("maintainer_count_source"),
    repositoryUrl: text("repository_url"),
    fetchTimestamp: text("fetch_timestamp"),
    /** Populated instead of dropping the row, so partial failures stay visible. */
    fetchError: text("fetch_error"),
    /** Why `extract` produced no versions for this package, e.g. a missing cache entry. */
    extractError: text("extract_error"),
    /**
     * When OSV was asked about this package's versions. Null means not asked, so "no advisory"
     * cannot be told apart from "not checked" and the package is left out of advisory counts.
     */
    osvQueriedAt: text("osv_queried_at"),
  },
  (t) => [
    primaryKey({ columns: [t.snapshotId, t.ecosystem, t.packageName] }),
    index("idx_pkg_eco").on(t.snapshotId, t.ecosystem),
    check("packages_ecosystem", sql.raw(`${t.ecosystem.name} IN (${ECOSYSTEM_LIST})`)),
    check("packages_rank_frame", sql.raw(`${t.rankFrame.name} IN ('downloads', 'dependents')`)),
    check("packages_rank_positive", sql.raw(`${t.rank.name} >= 1`)),
    check(
      "packages_counts_non_negative",
      sql.raw(
        `(${t.downloadCount.name} IS NULL OR ${t.downloadCount.name} >= 0) AND ` +
          `(${t.dependentCount.name} IS NULL OR ${t.dependentCount.name} >= 0)`,
      ),
    ),
    check(
      "packages_maintainer_count_non_negative",
      sql.raw(`${t.maintainerCount.name} IS NULL OR ${t.maintainerCount.name} >= 0`),
    ),
  ],
);

export const packageVersions = sqliteTable(
  "package_versions",
  {
    snapshotId: text("snapshot_id").notNull(),
    ecosystem: text("ecosystem").notNull(),
    packageName: text("package_name").notNull(),
    version: text("version").notNull(),
    publishedAt: text("published_at"),
    isLatest: integer("is_latest", { mode: "boolean" }).notNull().default(false),
    /** '2024Q1', or several comma-joined when one release anchors many quarters. */
    quarterAnchor: text("quarter_anchor"),
    /** Package URL of this release, e.g. `pkg:npm/chalk@5.6.1`. */
    purl: text("purl"),
  },
  (t) => [
    primaryKey({ columns: [t.snapshotId, t.ecosystem, t.packageName, t.version] }),
    foreignKey({
      columns: [t.snapshotId, t.ecosystem, t.packageName],
      foreignColumns: [packages.snapshotId, packages.ecosystem, packages.packageName],
      name: "package_versions_package_fk",
    }),
    index("idx_ver_latest").on(t.snapshotId, t.ecosystem, t.isLatest),
    index("idx_ver_anchor").on(t.snapshotId, t.ecosystem, t.quarterAnchor),
    check("package_versions_ecosystem", sql.raw(`${t.ecosystem.name} IN (${ECOSYSTEM_LIST})`)),
  ],
);

/**
 * Tidy/long format: one row per version per signal. Five nullable wide columns would be
 * awkward to aggregate and would need a migration to add a sixth signal.
 */
export const versionSignals = sqliteTable(
  "version_signals",
  {
    snapshotId: text("snapshot_id").notNull(),
    ecosystem: text("ecosystem").notNull(),
    packageName: text("package_name").notNull(),
    version: text("version").notNull(),
    signalId: text("signal_id").notNull(),
    value: text("value").notNull(),
    /** The raw observed value, e.g. a provenance URL or a trustpub repository. */
    evidence: text("evidence"),
    /** The rule: endpoint + JSON path the value is read from, the same for every release. */
    signalSource: text("signal_source").notNull(),
    /** JSON array of the cached responses ({url, sha256}) this release's value was read from. */
    responses: text("responses", { mode: "json" }).$type<ResponseRef[]>().notNull().default([]),
  },
  (t) => [
    primaryKey({
      columns: [t.snapshotId, t.ecosystem, t.packageName, t.version, t.signalId],
    }),
    foreignKey({
      columns: [t.snapshotId, t.ecosystem, t.packageName, t.version],
      foreignColumns: [
        packageVersions.snapshotId,
        packageVersions.ecosystem,
        packageVersions.packageName,
        packageVersions.version,
      ],
      name: "version_signals_version_fk",
    }),
    index("idx_sig_lookup").on(t.snapshotId, t.ecosystem, t.signalId, t.value),
    check("version_signals_ecosystem", sql.raw(`${t.ecosystem.name} IN (${ECOSYSTEM_LIST})`)),
    check("version_signals_signal", sql.raw(`${t.signalId.name} IN (${SIGNAL_LIST})`)),
    check("version_signals_value", sql.raw(`${t.value.name} IN ('true', 'false', 'unknown')`)),
  ],
);

export type SnapshotRow = typeof snapshots.$inferSelect;
export type PackageRow = typeof packages.$inferSelect;
export type PackageVersionRow = typeof packageVersions.$inferSelect;
export type VersionSignalRow = typeof versionSignals.$inferSelect;

/**
 * How many versions a package withdrew, per mechanism the registry exposes (yank,
 * unpublish, deprecate, retract), counted over the window in `withdrawalWindowStart`.
 * One row per package and kind; registries that expose none have no rows.
 */
export const packageWithdrawals = sqliteTable(
  "package_withdrawals",
  {
    snapshotId: text("snapshot_id").notNull(),
    ecosystem: text("ecosystem").notNull(),
    packageName: text("package_name").notNull(),
    kind: text("kind").notNull(),
    /** Versions published in the window; null where the registry dates too few (Go). */
    versionsInWindow: integer("versions_in_window"),
    withdrawnCount: integer("withdrawn_count").notNull(),
    /** Comma-joined version numbers, so a count can be checked by hand. */
    withdrawnVersions: text("withdrawn_versions").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.snapshotId, t.ecosystem, t.packageName, t.kind] }),
    foreignKey({
      columns: [t.snapshotId, t.ecosystem, t.packageName],
      foreignColumns: [packages.snapshotId, packages.ecosystem, packages.packageName],
      name: "package_withdrawals_package_fk",
    }),
    check("package_withdrawals_ecosystem", sql.raw(`${t.ecosystem.name} IN (${ECOSYSTEM_LIST})`)),
    check("package_withdrawals_kind", sql.raw(`${t.kind.name} IN (${WITHDRAWAL_LIST})`)),
    check(
      "package_withdrawals_counts",
      sql.raw(
        `${t.withdrawnCount.name} >= 0 AND (${t.versionsInWindow.name} IS NULL OR ${t.versionsInWindow.name} >= ${t.withdrawnCount.name})`,
      ),
    ),
  ],
);


/**
 * OSV records matched to any sampled version, as OSV served them during `fetch`. Records are
 * shared between packages, so they are keyed by snapshot and id only.
 */
export const advisories = sqliteTable(
  "advisories",
  {
    snapshotId: text("snapshot_id").notNull(),
    advisoryId: text("advisory_id").notNull(),
    /** JSON array of the ids other databases give the same vulnerability (CVE, GHSA, PYSEC, …). */
    aliases: text("aliases", { mode: "json" }).$type<string[]>().notNull().default([]),
    published: text("published"),
    modified: text("modified").notNull(),
    /** Set when the database withdrew the record; withdrawn records are left out of every count. */
    withdrawn: text("withdrawn"),
    malicious: integer("malicious", { mode: "boolean" }).notNull(),
    summary: text("summary"),
    /** The cached `/v1/vulns/{id}` response this row was read from. */
    response: text("response", { mode: "json" }).$type<ResponseRef>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.snapshotId, t.advisoryId] })],
);

/**
 * Which versions OSV lists as affected by which record. The versions are the stored ones and
 * the withdrawn ones (`package_withdrawals`), so there is no foreign key onto package_versions.
 */
export const advisoryMatches = sqliteTable(
  "advisory_matches",
  {
    snapshotId: text("snapshot_id").notNull(),
    ecosystem: text("ecosystem").notNull(),
    packageName: text("package_name").notNull(),
    version: text("version").notNull(),
    advisoryId: text("advisory_id").notNull(),
    /** When the matched version was released, where the registry dates it. */
    releasedAt: text("released_at"),
    /** The querybatch responses for this package, named by cache key ("POST {url} {body sha256}"). */
    responses: text("responses", { mode: "json" }).$type<ResponseRef[]>().notNull().default([]),
  },
  (t) => [
    primaryKey({ columns: [t.snapshotId, t.ecosystem, t.packageName, t.version, t.advisoryId] }),
    foreignKey({
      columns: [t.snapshotId, t.ecosystem, t.packageName],
      foreignColumns: [packages.snapshotId, packages.ecosystem, packages.packageName],
      name: "advisory_matches_package_fk",
    }),
    foreignKey({
      columns: [t.snapshotId, t.advisoryId],
      foreignColumns: [advisories.snapshotId, advisories.advisoryId],
      name: "advisory_matches_advisory_fk",
    }),
    index("idx_adv_match_advisory").on(t.snapshotId, t.advisoryId),
    check("advisory_matches_ecosystem", sql.raw(`${t.ecosystem.name} IN (${ECOSYSTEM_LIST})`)),
  ],
);
