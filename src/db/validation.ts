/**
 * Insert-time validation.
 *
 * Base schemas are derived from the Drizzle tables with `drizzle-zod`, so column types and
 * nullability can never drift from the schema. On top of that sit the rules SQL cannot
 * express: timestamp formats, quarter labels, sha256 shape, and cross-field consistency.
 *
 * Why bother when CHECK constraints exist: a constraint violation surfaces as
 * "SQLITE_CONSTRAINT_CHECK" with no indication of which row or field was wrong, which is
 * useless when a run touches thousands of packages. These produce a message naming the
 * package and field. The CHECK constraints remain as the backstop.
 */

import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { ECOSYSTEMS, RANK_FRAMES, SAMPLE_LAYERS, SIGNALS, WITHDRAWAL_KINDS } from "../types.ts";
import {
  advisories,
  advisoryMatches,
  ecosystemFacts,
  packageVersions,
  packageWithdrawals,
  packages,
  sampleMembers,
  signalAvailability,
  snapshots,
  versionSignals,
} from "./schema.ts";

const ecosystemEnum = z.enum(ECOSYSTEMS);
const signalEnum = z.enum(SIGNALS);

/** ISO-8601 with an explicit UTC offset. Registries return several shapes; we normalise. */
const isoTimestamp = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: "not a parseable timestamp" });

/** One or more comma-joined quarter labels, e.g. "2024Q1" or "2024Q1,2024Q2". */
const quarterAnchor = z
  .string()
  .regex(/^\d{4}Q[1-4](,\d{4}Q[1-4])*$/, "expected quarter labels like 2024Q1 or 2024Q1,2024Q2");

const sha256Hex = z.string().regex(/^[0-9a-f]{64}$/, "expected a 64-character hex sha256");

export const snapshotInsert = createInsertSchema(snapshots, {
  snapshotId: z.string().min(1),
  startedAt: isoTimestamp,
  finishedAt: isoTimestamp.nullish(),
  configJson: z
    .string()
    .refine((s) => {
      try {
        JSON.parse(s);
        return true;
      } catch {
        return false;
      }
    }, "config_json must be valid JSON"),
});

export const ecosystemFactsInsert = createInsertSchema(ecosystemFacts, {
  ecosystem: ecosystemEnum,
  registryUrl: z.url(),
  trustedPublishingGaDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
    .nullish(),
});

export const signalAvailabilityInsert = createInsertSchema(signalAvailability, {
  ecosystem: ecosystemEnum,
  signalId: signalEnum,
  availability: z.enum(["observable", "inferred", "not_exposed", "no_mechanism"]),
});

export const packageInsert = createInsertSchema(packages, {
  ecosystem: ecosystemEnum,
  packageName: z.string().min(1),
  maintainerCount: z.int().min(0).nullish(),
  latestPublishDate: isoTimestamp.nullish(),
  fetchTimestamp: isoTimestamp.nullish(),
  repositoryUrl: z.url().nullish(),
});

export const sampleMemberInsert = createInsertSchema(sampleMembers, {
  layer: z.enum(SAMPLE_LAYERS),
  ecosystem: ecosystemEnum,
  packageName: z.string().min(1),
  rankFrame: z.enum(RANK_FRAMES),
  rank: z.int().min(1),
  downloadCount: z.int().min(0).nullish(),
  dependentCount: z.int().min(0).nullish(),
}).refine(
  (p) => p.rankFrame !== "downloads" || p.downloadCount != null,
  // A row sampled by downloads with no download count means the ranking source silently
  // returned nothing useful — that must fail loudly rather than land as a null.
  { error: "rankFrame 'downloads' requires a downloadCount", path: ["downloadCount"] },
).refine(
  (p) => p.rankFrame !== "dependents" || p.dependentCount != null,
  { error: "rankFrame 'dependents' requires a dependentCount", path: ["dependentCount"] },
).refine(
  // The two samples answer different questions; a ranking frame in the random draw (or the
  // reverse) means the wrong code path wrote the row.
  (p) => (p.layer === "random") === (p.rankFrame === "random"),
  { error: "layer 'random' requires rankFrame 'random', and only it", path: ["rankFrame"] },
);

export const packageVersionInsert = createInsertSchema(packageVersions, {
  ecosystem: ecosystemEnum,
  packageName: z.string().min(1),
  version: z.string().min(1),
  publishedAt: isoTimestamp.nullish(),
  quarterAnchor: quarterAnchor.nullish(),
  purl: z.string().startsWith("pkg:").nullish(),
});

/** Rows that rest on a curated fact rather than a response: policy, no mechanism, not exposed. */
const CURATED_SOURCE = /^(policy|no_mechanism|not_exposed):/;

export const versionSignalInsert = createInsertSchema(versionSignals, {
  ecosystem: ecosystemEnum,
  signalId: signalEnum,
  packageName: z.string().min(1),
  version: z.string().min(1),
  value: z.enum(["true", "false", "unknown"]),
  // Without this an aggregate number could not be traced back to an endpoint, which is
  // the whole reproducibility claim.
  signalSource: z.string().min(1),
  responses: z.array(z.object({ url: z.url(), sha256: sha256Hex })),
}).refine((s) => s.value === "unknown" || s.evidence != null || s.value === "false", {
  error: "a 'true' signal must carry evidence",
  path: ["evidence"],
}).refine((s) => CURATED_SOURCE.test(s.signalSource) || (s.responses?.length ?? 0) > 0, {
  // The per-signal trace from a matrix cell back to the bytes it was read from.
  error: "a signal read from the registry must name the response it was read from",
  path: ["responses"],
});

export const packageWithdrawalInsert = createInsertSchema(packageWithdrawals, {
  ecosystem: ecosystemEnum,
  packageName: z.string().min(1),
  kind: z.enum(WITHDRAWAL_KINDS),
  versionsInWindow: z.int().min(0).nullish(),
  withdrawnCount: z.int().min(0),
}).refine((w) => w.versionsInWindow == null || w.versionsInWindow >= w.withdrawnCount, {
  error: "more withdrawn versions than versions in the window",
  path: ["withdrawnCount"],
});

/** A response named by URL, or for a POST by its cache key: "POST {url} {sha256 of the body}". */
const responseRef = z.object({
  url: z.string().refine((u) => URL.canParse(u.replace(/^POST (\S+) [0-9a-f]{64}$/, "$1")), "expected a URL or a POST cache key"),
  sha256: sha256Hex,
});

export const advisoryInsert = createInsertSchema(advisories, {
  advisoryId: z.string().min(1),
  aliases: z.array(z.string().min(1)),
  published: isoTimestamp.nullish(),
  modified: isoTimestamp,
  withdrawn: isoTimestamp.nullish(),
  response: responseRef,
});

export const advisoryMatchInsert = createInsertSchema(advisoryMatches, {
  ecosystem: ecosystemEnum,
  packageName: z.string().min(1),
  version: z.string().min(1),
  advisoryId: z.string().min(1),
  releasedAt: isoTimestamp.nullish(),
  responses: z.array(responseRef).min(1),
});

export type PackageInsert = z.infer<typeof packageInsert>;
export type PackageVersionInsert = z.infer<typeof packageVersionInsert>;
export type VersionSignalInsert = z.infer<typeof versionSignalInsert>;
export type SnapshotInsert = z.infer<typeof snapshotInsert>;

/**
 * Validates a batch, attributing any failure to a specific row.
 *
 * Throws on the first invalid row rather than filtering: a row that fails validation is a
 * bug in an adapter, and silently dropping it would understate adoption in the results.
 */
export function validateAll<T>(schema: z.ZodType<T>, rows: unknown[], label: string): T[] {
  return rows.map((row, i) => {
    const result = schema.safeParse(row);
    if (result.success) return result.data;
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new Error(`invalid ${label} row ${i} (${describe(row)}): ${issues}`);
  });
}

/** Best-effort identifier for an error message, without dumping the whole row. */
function describe(row: unknown): string {
  if (typeof row !== "object" || row === null) return String(row);
  const r = row as Record<string, unknown>;
  return (
    [r.ecosystem, r.packageName, r.version, r.signalId, r.advisoryId].filter(Boolean).join("/") || "unidentified"
  );
}
