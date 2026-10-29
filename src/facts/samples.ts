/**
 * How the random sample is drawn, how the whole-registry layer is read, and how the response cache
 * is published, with the passages each rule rests on. The draw itself is measured
 * (src/sample/); these notes are the curated part: what each registry's bulk data promises.
 */

import { cite, lastAccessed, type Cite } from "../sources/index.ts";
import type { EcosystemId } from "../types.ts";

export interface MethodNote {
  label: string;
  note: string;
  sources: Cite[];
  /** The registry a note is about, if one. */
  ecosystem?: EcosystemId;
}

/** The random sample: why it exists, and where each registry's name list comes from. */
export const SAMPLE_NOTES: MethodNote[] = [
  {
    label: "Prior work",
    note: "Whole-registry studies also sample when a registry is too large to measure: Schorlemmer et al. took PyPI from BigQuery and Maven Central from an ecosyste.ms data dump, and measured a random tenth of Maven Central.",
    sources: [
      cite("schorlemmerSigning2024", "We used ecosyste.ms’ data dump from 01 Mar 2024 to collect packages from Maven Central."),
      cite("schorlemmerSigning2024", "Due to download rates, we only measure a random sample of the filtered Maven Central packages (10% of the total population)."),
      cite("ecosystemsOpenData", "Each release is a full SQL dump of the database of the service"),
    ],
  },
  {
    label: "PyPI",
    ecosystem: "pypi",
    note: "Every project name is read from the root of the Simple API, whose order is undefined; the draw sorts the list before shuffling. A project is active if a release (dated by its earliest file) falls in the window.",
    sources: [
      cite("pep691", "`projects`: An array where each entry is a dictionary with a single key, `name`, which represents string of the project name."),
      cite("pep691", "neither PEP 503 nor this PEP requires any specific ordering nor that the ordering is consistent from one request to the next"),
    ],
  },
  {
    label: "npm",
    ecosystem: "npm",
    note: "npm's only list of every package is its replication feed, rebuilt in 2025, which pages through every change ever made, deleted packages included. The names come from deps.dev instead; whether a package is active is read from its packument, counting only versions still published.",
    sources: [
      cite("npmReplicationChanges", "certain endpoints will be deprecated as of Thursday, May 29, 2025"),
      cite("depsDevBigQuery", "The time at which this package version was published, as reported by the upstream source."),
    ],
  },
  {
    label: "crates.io",
    ecosystem: "crates",
    note: "Names and release dates come from the daily database dump: `crates.csv`, and `created_at` in `versions.csv`.",
    sources: [
      cite("cratesDumpColumns", "This file configures what to include in public database dumps."),
      cite("cratesDumpColumns", 'num = "public" num_no_build = "public"'),
    ],
  },
  {
    label: "RubyGems",
    ecosystem: "rubygems",
    note: "Names and release dates come from the weekly PostgreSQL dump taken before the snapshot: the `rubygems` table, and `created_at` in `versions`, yanked versions included. A gem none of whose versions is still indexed (all yanked or removed) is no package: yanking unindexes a version, and the gems API answers 404 for a gem without an indexed version.",
    sources: [
      cite("rubygemsDataDumps", "We provide weekly dumps of the RubyGems.org PostgreSQL data. This dump is sanitized, removing all user information."),
      cite("rubygemsDeletion", "version.update!(indexed: false, yanked_at: Time.now.utc)"),
      cite("rubygemsApiGems", "if @rubygem.hosted? && @rubygem.public_versions.indexed.present?"),
      cite("rubygemsApiGems", "render plain: t(:this_rubygem_could_not_be_found), status: :not_found"),
    ],
  },
  {
    label: "Go",
    ecosystem: "go",
    note: "The module index is crawled over the activity window only: a module without a version in the window is inactive anyway. Its time is when the proxy first cached a version, not when the version was tagged, and pseudo-versions (commits) are not releases.",
    sources: [
      cite("goModuleIndex", "The feed is served as new line delimited JSON, providing the module path (as Path), the module version (as Version), and the time it was first cached by proxy.golang.org (as Timestamp)."),
      cite("goModuleIndex", "'limit': the maximum length of the returned list. Default = 2000, Max = 2000"),
    ],
  },
  {
    label: "Maven Central",
    ecosystem: "maven",
    note: "Names come from deps.dev; activity is read from `maven-metadata.xml`. Central lowers its request thresholds over time, so a 429 ends the run for now and it resumes later, never faster.",
    sources: [
      cite("mavenConsumptionLimits", "Maven Central is beginning to enforce consumption limits for unusually high-volume traffic."),
      cite("mavenConsumptionLimits", "Over time, those thresholds will move downward as we continue the transition toward a more sustainable consumption model."),
    ],
  },
  {
    label: "Packagist",
    ecosystem: "packagist",
    note: "Names come from `packages/list.json`; activity from each package's p2 metadata, which lists tagged releases only.",
    sources: [
      cite("packagistApi", "Listing package names Anonymous"),
      cite("packagistApi", "The `p2/$vendor/$package.json` file contains only tagged releases."),
    ],
  },
];

/** The whole-registry layer (deps.dev) and how the response cache is published. */
export const DATASET_NOTES: MethodNote[] = [
  {
    label: "Whole registry: what deps.dev records",
    note: "deps.dev's `PackageVersions` table records each version's attestations and whether deps.dev verified them (Sigstore bundles with sigstore-go); its SLSA column is filled for npm only. The per-version API serves the same model, and is what the agreement check reads.",
    sources: [
      cite("depsDevBigQuery", "The attestation has been cryptographically verified by deps.dev."),
      cite("depsDevBigQuery", "This is only populated for npm package versions."),
      cite("depsDevApi", "GetVersion returns information about a specific package version, including its licenses and any security advisories known to affect it."),
    ],
  },
  {
    label: "Whole registry: agreement",
    note: "For the latest release of every sampled package, deps.dev's attestations are checked against this project's own reading of the same mechanism (`scripts/check-depsdev.ts`, rerun per snapshot); its archived output lists every disagreement. Only Sigstore attestations are compared: deps.dev has no field for crates.io's trusted publishing or Go's checksum database, and no Packagist.",
    sources: [cite("depsDevAgreement", "deps.dev attestations compared with this project's measurement, for the latest release of every sampled package.")],
  },
  {
    label: "Whole registry: snapshots",
    note: "Every table carries the time of the snapshot it belongs to, and `Snapshots` lists them, so a query names the deps.dev snapshot it read.",
    sources: [cite("depsDevBigQuery", "This table contains the timestamps for which a full snapshot of all other tables exists.")],
  },
  {
    label: "Whole registry: licence",
    note: "Data deps.dev generates, such as whether it verified an attestation, is licensed CC-BY 4.0 and credited to deps.dev wherever it is used. Package names and the attestations themselves are data it aggregates from the registries, under their terms, so only counts are committed. Answers from its API may be cached.",
    sources: [
      cite("depsDevReadme", "This generated data is available under a CC-BY 4.0 license."),
      cite("depsDevReadme", "For details on using the data from these sources, please consult their documentation."),
      cite("depsDevReadme", "Clients are expressly permitted to cache data served by the API."),
    ],
  },
  {
    label: "Whole registry: access",
    note: "The dataset is read through the BigQuery sandbox, which needs a Google account but no billing. Its monthly query allowance bounds what is scanned, so every query is dry-run first; nothing is stored there, since sandbox tables expire.",
    sources: [
      cite("depsDevBigQuery", "To use the BigQuery dataset, you will need a Google Cloud account with the BigQuery API enabled."),
      cite("bigquerySandbox", "The BigQuery sandbox lets you experience BigQuery without providing a credit card or creating a billing account for your project."),
      cite("bigquerySandbox", "1 TiB of processed query data each month"),
      cite("bigquerySandbox", "You are granted a lifetime limit of 10 GiB of storage."),
      cite("bigquerySandbox", "automatically expire after 60 days"),
    ],
  },
  {
    label: "Publishing the cache",
    note: "Raw responses outgrow a git repository, so each snapshot's redacted cache is a GitHub release, one archive per registry.",
    sources: [
      cite("githubLargeFiles", "GitHub blocks files larger than 100 MiB."),
      cite("githubLargeFiles", "We recommend repositories remain small, ideally less than 1 GB"),
      cite("githubReleases", "Each file included in a release must be under 2 GiB. There is no limit on the total size of a release, nor bandwidth usage."),
    ],
  },
];

export const SAMPLE_VERIFIED = lastAccessed([...SAMPLE_NOTES, ...DATASET_NOTES].flatMap((n) => n.sources));
