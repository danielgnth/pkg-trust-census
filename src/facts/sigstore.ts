/**
 * Sigstore across the seven registries, curated from primary sources (verified 2026-10-13).
 *
 * Four of the seven accept Sigstore bundles, so "uses Sigstore" is a cross-registry fact
 * worth stating once rather than re-deriving from the per-release signals, which already
 * count each bundle as a publisher signature and a transparency-log entry. The other three
 * are recorded with the nearest equivalent they do have, because "no Sigstore" means very
 * different things for Go (its own transparency log) and crates.io (nothing signed at all).
 *
 * Like the baseline, this describes ecosystems rather than sampled packages, so it is not
 * part of the trust score.
 */

import type { EcosystemId } from "../types.ts";

export type SigstoreStatus = "yes" | "planned" | "no";

/** Whether a party checks the bundle: always, only when asked, or not at all. */
export type VerifiedBy = "yes" | "opt-in" | "no" | "n/a";

export interface SigstoreFact {
  ecosystem: EcosystemId;
  status: SigstoreStatus;
  /** When the registry began accepting bundles (YYYY-MM). */
  since?: string;
  /** What is signed, by whom, and where the bundle is served. */
  signs: string;
  /** Does the registry verify the bundle before accepting the upload? */
  registryVerifies: VerifiedBy;
  /** Does the default install client verify it? */
  clientVerifies: VerifiedBy;
  /** The nearest comparable mechanism, Sigstore or not. */
  similar: string;
  sources: string[];
}

const S = {
  npmGa: "https://github.blog/changelog/2023-09-26-npm-provenance-general-availability/",
  npmProvenance: "https://docs.npmjs.com/generating-provenance-statements",
  npmProvenanceDetails: "https://github.com/npm/provenance",
  npmVerify: "https://docs.npmjs.com/verifying-registry-signatures",
  pypiGa: "https://blog.pypi.org/posts/2024-11-14-pypi-now-supports-digital-attestations/",
  pep740: "https://peps.python.org/pep-0740/",
  pipSecure: "https://pip.pypa.io/en/stable/topics/secure-installs/",
  pypiGpg: "https://blog.pypi.org/posts/2023-05-23-removing-pgp/",
  rubygemsDec2024: "https://blog.rubygems.org/2025/01/24/december-rubygems-updates.html",
  rubygemsPusher: "https://github.com/rubygems/rubygems.org/blob/master/app/models/pusher.rb",
  rubygemsSecurity: "https://guides.rubygems.org/security/",
  mavenSigstore: "https://central.sonatype.org/news/20250128_sigstore_signature_validation_via_portal/",
  mavenGpg: "https://central.sonatype.org/publish/requirements/gpg/",
  goSumdb: "https://go.dev/ref/mod#checksum-database",
  goMirror: "https://go.dev/blog/module-mirror-launch",
  cargoRfc: "https://github.com/rust-lang/rfcs/pull/3403",
  rustTuf: "https://rust-lang.github.io/goals/2025h1/verification-and-mirroring.html",
  packagist2026: "https://blog.packagist.com/an-update-on-composer-packagist-supply-chain-security/",
  packagist15: "https://blog.packagist.com/15-years-of-packagist-over-200-billion-package-installs/",
};

export const SIGSTORE: SigstoreFact[] = [
  {
    ecosystem: "npm",
    status: "yes",
    since: "2023-04",
    signs: "The tarball, by the publisher's CI identity (Fulcio), as SLSA provenance in dist.attestations; npm adds a publish attestation signed with its own registry key. Both are logged in the public Rekor.",
    registryVerifies: "yes",
    clientVerifies: "opt-in",
    similar: "Registry-applied ECDSA signatures on every tarball (dist.signatures), also checked only by `npm audit signatures`.",
    sources: [S.npmGa, S.npmProvenance, S.npmProvenanceDetails, S.npmVerify],
  },
  {
    ecosystem: "pypi",
    status: "yes",
    since: "2024-11",
    signs: "Each distribution file, by the Trusted Publisher's CI identity (PEP 740), served through the Integrity API. Most bundles carry the publish predicate, not SLSA provenance.",
    registryVerifies: "yes",
    clientVerifies: "no",
    similar: "None left: PGP signature uploads were removed in 2023.",
    sources: [S.pypiGa, S.pep740, S.pipSecure, S.pypiGpg],
  },
  {
    ecosystem: "rubygems",
    status: "yes",
    since: "2024-12",
    signs: "The .gem, by the CI identity, via `gem push --attestation` (RubyGems 3.6, used by rubygems/release-gem); served at /api/v1/attestations. Accepted only from a trusted-publishing push.",
    registryVerifies: "yes",
    clientVerifies: "no",
    similar: "Legacy X.509 `gem cert` signatures: opt-in to verify, rarely used, not exposed by the API.",
    sources: [S.rubygemsDec2024, S.rubygemsPusher, S.rubygemsSecurity],
  },
  {
    ecosystem: "maven",
    status: "yes",
    since: "2025-01",
    signs: "Any deployed file, as an optional .sigstore.json next to the mandatory PGP .asc.",
    registryVerifies: "yes",
    clientVerifies: "no",
    similar: "Mandatory PGP signatures on every file: long-lived publisher keys, not logged, not checked by Maven by default.",
    sources: [S.mavenSigstore, S.mavenGpg],
  },
  {
    ecosystem: "go",
    status: "no",
    signs: "Nothing: modules are fetched from VCS and authors cannot sign them.",
    registryVerifies: "n/a",
    clientVerifies: "n/a",
    similar: "sum.golang.org, Google's own append-only Merkle log of module hashes with signed tree heads, checked by the go command by default. A transparency log like Rekor, but of hashes, not publisher identities.",
    sources: [S.goSumdb, S.goMirror],
  },
  {
    ecosystem: "crates",
    status: "no",
    signs: "Nothing: the Sigstore RFC for Cargo (#3403) was closed unmerged in 2023.",
    registryVerifies: "n/a",
    clientVerifies: "n/a",
    similar: "None deployed. A TUF signing experiment exists; trusted publishing records the commit from the CI's OIDC token, but nothing is signed for consumers.",
    sources: [S.cargoRfc, S.rustTuf],
  },
  {
    ecosystem: "packagist",
    status: "planned",
    signs: "Nothing yet: hosted artifacts with SLSA provenance and Sigstore attestations verified by Composer are a stated direction (2026-05), with news promised 2026-09-29.",
    registryVerifies: "n/a",
    clientVerifies: "n/a",
    similar: "A login-gated log of security events (ownership, maintainers, version references); not a log of artifacts.",
    sources: [S.packagist2026, S.packagist15],
  },
];

export function sigstoreOf(ecosystem: EcosystemId): SigstoreFact {
  const fact = SIGSTORE.find((s) => s.ecosystem === ecosystem);
  if (!fact) throw new Error(`no Sigstore fact for ${ecosystem}`);
  return fact;
}
