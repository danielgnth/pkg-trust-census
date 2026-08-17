/** Core domain types. Kept dependency-free so both pipeline stages and tests can import them. */

export const ECOSYSTEMS = [
  "pypi",
  "npm",
  "crates",
  "rubygems",
  "go",
  "maven",
  "packagist",
] as const;
export type EcosystemId = (typeof ECOSYSTEMS)[number];

/**
 * The five trust dimensions. Two booleans could not represent an ecosystem like Maven
 * (mandatory GPG, ~100%) or Go (mandatory transparency log, ~100%) without scoring them
 * a misleading zero — see docs/preflight.md §3.1.
 */
export const SIGNALS = [
  /** Published via OIDC / trusted publishing rather than a long-lived API token. */
  "identity_publish",
  /** A cryptographic signature over the artifact (GPG, Sigstore, registry signing). */
  "artifact_signature",
  /** Attestation linking artifact -> source commit -> builder (SLSA / in-toto). */
  "build_provenance",
  /** Inclusion in a public append-only log (Go sumdb, Sigstore Rekor). */
  "transparency_log",
  /** MFA required for the publishing account. */
  "mfa_enforced",
] as const;
export type SignalId = (typeof SIGNALS)[number];

/**
 * Three-state per the design decision: `unknown` must stay distinguishable from `false`,
 * so that "nobody adopted it" and "the registry will not tell us" never collapse together.
 */
export type SignalValue = "true" | "false" | "unknown";

/**
 * Whether an ecosystem exposes a signal at all. Recorded once per (ecosystem, signal) in
 * `signal_availability`, and it is what lets the maturity matrix render "n/a — not auditable"
 * as a visibly different cell from "0%".
 */
export type Availability =
  /** Registry reports it per package; a `false` here is a real negative. */
  | "observable"
  /** Derivable only indirectly, e.g. PyPI attestations imply trusted publishing. */
  | "inferred"
  /** The mechanism exists but the public API does not reveal adoption (RubyGems TP). */
  | "not_exposed"
  /** No such mechanism exists in this ecosystem (crates.io attestations, Packagist signing). */
  | "no_mechanism";

/** Go and Maven publish no download counts anywhere, so they are sampled by dependents. */
export type RankFrame = "downloads" | "dependents";

/** A package selected for the sample, before any signal fetching. */
export interface Candidate {
  ecosystem: EcosystemId;
  /** Registry-canonical name. Maven uses "groupId:artifactId". */
  name: string;
  rank: number;
  rankFrame: RankFrame;
  downloadCount: number | null;
  dependentCount: number | null;
}

/** One entry in the cache integrity manifest. Committed to git; the payloads are not. */
export interface CacheEntry {
  url: string;
  /** sha256 of the *uncompressed* body, so integrity is independent of gzip settings. */
  sha256: string;
  bytes: number;
  httpStatus: number;
  fetchedAt: string;
  ecosystem: EcosystemId;
  package: string;
  /** Repo-relative path of the gzipped payload. */
  path: string;
}

export interface FetchResult {
  url: string;
  status: number;
  body: string;
  fromCache: boolean;
  entry: CacheEntry;
}

export interface ExtractedSignal {
  signal: SignalId;
  value: SignalValue;
  /** The raw observed value, e.g. a provenance URL or a trustpub repository. */
  evidence: string | null;
  /** Endpoint + JSON path the value came from. Required for reproducibility. */
  signalSource: string;
}

export interface ExtractedVersion {
  version: string;
  publishedAt: string | null;
  isLatest: boolean;
  /** e.g. "2024Q1" when this version is the anchor for that quarter, else null. */
  quarterAnchor: string | null;
  signals: ExtractedSignal[];
}

export interface ExtractedPackage {
  ecosystem: EcosystemId;
  name: string;
  latestVersion: string | null;
  latestPublishDate: string | null;
  maintainerCount: number | null;
  maintainerCountSource: string;
  repositoryUrl: string | null;
  fetchError: string | null;
  versions: ExtractedVersion[];
}
