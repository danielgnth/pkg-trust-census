/**
 * How known advisories are matched and timed, with the passages each rule rests on. The
 * advisory numbers are measured (src/advisories/osv.ts, `advisorySummary`); these notes are the
 * curated part: what OSV's API and schema promise, and which fields are deliberately not read.
 */

import { cite, lastAccessed, type Cite } from "../sources/index.ts";

export interface AdvisoryNote {
  label: string;
  note: string;
  sources: Cite[];
}

export const ADVISORY_NOTES: AdvisoryNote[] = [
  {
    label: "Matching",
    note: "OSV is asked once per package about every version the dataset stores and every version the registry withdrew. The batch endpoint answers with ids only, so each record is then read on its own.",
    sources: [cite("osvQuerybatch", "Returns vulnerability ids and modified field only.")],
  },
  {
    label: "One vulnerability, several records",
    note: "Databases list the same vulnerability under their own ids (GHSA, PYSEC, RUSTSEC, GO) and cross-reference them as aliases. Records sharing an id, directly or through other records, are counted as one vulnerability.",
    sources: [
      cite("osvSchema", "The aliases field gives a list of IDs of the same vulnerability in other databases"),
      cite("osvSchema", "Aliases should be considered symmetric (if A is an alias of B, then B is an alias of A) and transitive (If A aliases B and B aliases C, then A aliases C)."),
    ],
  },
  {
    label: "Timing",
    note: "A vulnerability counts as known from the earliest `published` time among its records. Withdrawn records are left out.",
    sources: [
      cite("osvSchema", "The published field gives the time the entry should be considered to have been published"),
      cite("osvSchema", "The withdrawn field gives the time the entry should be considered to have been withdrawn"),
    ],
  },
  {
    label: "GitHub review and NVD dates are not used",
    note: "GHSA records also carry `github_reviewed_at` and `nvd_published_at` under `database_specific`. The first is the latest review, not the first, and GitHub asks consumers not to rely on these fields, so neither is read.",
    sources: [
      cite("ghsaDatabase", "The timestamp of the last review by a GitHub Security Curator."),
      cite("ghsaDatabase", "Consuming systems should not rely on them for processing vulnerability information."),
    ],
  },
  {
    label: "Malicious packages",
    note: "A record is a malware report when its id, or an alias, is from the OpenSSF malicious-packages repository (MAL-…).",
    sources: [cite("osvSchema", "MAL Malicious Packages Repository")],
  },
  {
    label: "Package URLs",
    note: "Every stored version carries its package URL (packageurl-js). For Go the case of the module path is kept: the purl type says to lowercase it, but module paths are case-sensitive. No sampled module has a mixed-case path.",
    sources: [
      cite("purlSpec", "PURL is used as a standard identifier for software components in: - A CycloneDX or SPDX SBOM"),
      cite("purlGolangType", "The namespace shall be lowercased."),
    ],
  },
  {
    label: "SBOM",
    note: "`sbom.cdx.json` lists the latest version of every sampled package as a CycloneDX component, named by its purl, and the vulnerabilities OSV knows for them, each pointing at the components it affects.",
    sources: [cite("cyclonedxVdr", "CycloneDX enables precise and systematic reporting of vulnerabilities affecting both third-party and first-party components within a system.")],
  },
];

export const ADVISORY_VERIFIED = lastAccessed(ADVISORY_NOTES.flatMap((n) => n.sources));
