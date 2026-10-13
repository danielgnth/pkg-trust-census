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

/** One install client and what it does with bundles out of the box. */
export interface ClientFact {
  /** Name and the version the statement was checked against. */
  client: string;
  /** "yes" only when an ordinary install checks bundles with no configuration. */
  verifies: VerifiedBy;
  note: string;
  source: string;
}

export interface SigstoreFact {
  ecosystem: EcosystemId;
  status: SigstoreStatus;
  /** When the registry began accepting bundles (YYYY-MM). */
  since?: string;
  /** What is signed, by whom, and where the bundle is served. */
  signs: string;
  /** Does the registry verify the bundle before accepting the upload? */
  registryVerifies: VerifiedBy;
  /** The ecosystem's install clients, default first, including newer alternatives. */
  clients: ClientFact[];
  /** The nearest comparable mechanism, Sigstore or not. */
  similar: string;
  /** A few words of `similar`, for the chart. */
  similarShort: string;
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
  pnpmTrust: "https://pnpm.io/settings/dependency-resolution#trustpolicy",
  pnpmTrustSrc: "https://github.com/pnpm/pnpm/blob/main/pnpm11/resolving/npm-resolver/src/trustChecks.ts",
  pnpmSignatures: "https://github.com/pnpm/pnpm/blob/main/pnpm11/deps/security/signatures/README.md",
  yarnProvenance: "https://github.com/yarnpkg/berry/blob/master/packages/plugin-npm/sources/npmProvenance.ts",
  bunInstall: "https://bun.sh/docs/cli/install",
  uvPublish: "https://docs.astral.sh/uv/reference/cli/#uv-publish",
  gemPush: "https://github.com/ruby/rubygems/blob/master/lib/rubygems/commands/push_command.rb",
  gradleVerification: "https://docs.gradle.org/current/userguide/dependency_verification.html",
  cargo: "https://doc.rust-lang.org/cargo/reference/registry-index.html",
  composer: "https://getcomposer.org/doc/03-cli.md#install-i",
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
    clients: [
      { client: "npm 12", verifies: "opt-in", note: "`npm audit signatures` checks attestations and registry signatures of an installed tree; `npm install` itself does not.", source: S.npmVerify },
      { client: "pnpm 12", verifies: "no", note: "`trustPolicy: no-downgrade` (opt-in, since 10.21) refuses a version whose trusted-publisher/provenance metadata is weaker than an earlier one's, but reads the packument fields without verifying the bundle. `pnpm audit signatures` checks registry ECDSA signatures only.", source: S.pnpmTrustSrc },
      { client: "Yarn 4", verifies: "no", note: "Generates provenance on publish; does not verify on install.", source: S.yarnProvenance },
      { client: "Bun", verifies: "no", note: "No attestation handling.", source: S.bunInstall },
    ],
    similar: "Registry-applied ECDSA signatures on every tarball (dist.signatures), also checked only by `npm audit signatures`.",
    similarShort: "registry ECDSA signatures",
    sources: [S.npmGa, S.npmProvenance, S.npmProvenanceDetails, S.npmVerify],
  },
  {
    ecosystem: "pypi",
    status: "yes",
    since: "2024-11",
    signs: "Each distribution file, by the Trusted Publisher's CI identity (PEP 740), served through the Integrity API. Most bundles carry the publish predicate, not SLSA provenance.",
    registryVerifies: "yes",
    clients: [
      { client: "pip 26", verifies: "no", note: "Checks file hashes only; no attestation verification.", source: S.pipSecure },
      { client: "uv 0.12", verifies: "no", note: "Uploads attestations by default when publishing (since 0.9.12); does not verify them on install.", source: S.uvPublish },
    ],
    similar: "None left: PGP signature uploads were removed in 2023.",
    similarShort: "none (PGP removed 2023)",
    sources: [S.pypiGa, S.pep740, S.pipSecure, S.pypiGpg],
  },
  {
    ecosystem: "rubygems",
    status: "yes",
    since: "2024-12",
    signs: "The .gem, by the CI identity, via `gem push --attestation` (RubyGems 3.6, used by rubygems/release-gem); served at /api/v1/attestations. Accepted only from a trusted-publishing push.",
    registryVerifies: "yes",
    clients: [
      { client: "gem / Bundler 4", verifies: "no", note: "Attestations are only sent (`gem push --attestation`); legacy X.509 signatures are checked only with `-P MediumSecurity`.", source: S.gemPush },
    ],
    similar: "Legacy X.509 `gem cert` signatures: opt-in to verify, rarely used, not exposed by the API.",
    similarShort: "legacy X.509 gem signing",
    sources: [S.rubygemsDec2024, S.rubygemsPusher, S.rubygemsSecurity],
  },
  {
    ecosystem: "maven",
    status: "yes",
    since: "2025-01",
    signs: "Any deployed file, as an optional .sigstore.json next to the mandatory PGP .asc.",
    registryVerifies: "yes",
    clients: [
      { client: "Maven 3/4", verifies: "no", note: "Checks checksums only; signatures need a plugin.", source: S.mavenGpg },
      { client: "Gradle 9", verifies: "no", note: "Dependency verification (opt-in, via verification-metadata.xml) checks checksums and PGP .asc signatures, not Sigstore bundles.", source: S.gradleVerification },
    ],
    similar: "Mandatory PGP signatures on every file: long-lived publisher keys, not logged, not checked by Maven by default.",
    similarShort: "mandatory PGP signatures",
    sources: [S.mavenSigstore, S.mavenGpg],
  },
  {
    ecosystem: "go",
    status: "no",
    signs: "Nothing: modules are fetched from VCS and authors cannot sign them.",
    registryVerifies: "n/a",
    clients: [
      { client: "go", verifies: "n/a", note: "No bundles to check; every download is checked against sum.golang.org by default.", source: S.goSumdb },
    ],
    similar: "sum.golang.org, Google's own append-only Merkle log of module hashes with signed tree heads, checked by the go command by default. A transparency log like Rekor, but of hashes, not publisher identities.",
    similarShort: "own checksum log, checked by default",
    sources: [S.goSumdb, S.goMirror],
  },
  {
    ecosystem: "crates",
    status: "no",
    signs: "Nothing: the Sigstore RFC for Cargo (#3403) was closed unmerged in 2023.",
    registryVerifies: "n/a",
    clients: [{ client: "cargo", verifies: "n/a", note: "No bundles to check; checks the index's sha256.", source: S.cargo }],
    similar: "None deployed. A TUF signing experiment exists; trusted publishing records the commit from the CI's OIDC token, but nothing is signed for consumers.",
    similarShort: "none (TUF experiment only)",
    sources: [S.cargoRfc, S.rustTuf],
  },
  {
    ecosystem: "packagist",
    status: "planned",
    signs: "Nothing yet: hosted artifacts with SLSA provenance and Sigstore attestations verified by Composer are a stated direction (2026-05), with news promised 2026-09-29.",
    registryVerifies: "n/a",
    clients: [{ client: "Composer 2.10", verifies: "n/a", note: "No bundles to check; client-side verification is planned with hosted artifacts.", source: S.composer }],
    similar: "A login-gated log of security events (ownership, maintainers, version references); not a log of artifacts.",
    similarShort: "login-gated event log",
    sources: [S.packagist2026, S.packagist15],
  },
];

const STRENGTH: Record<VerifiedBy, number> = { "n/a": 0, no: 1, "opt-in": 2, yes: 3 };

/** The strongest client behaviour in the ecosystem, and which client has it. */
export function bestClient(f: SigstoreFact): ClientFact {
  return f.clients.reduce((best, c) => (STRENGTH[c.verifies] > STRENGTH[best.verifies] ? c : best));
}

/**
 * The per-release signal that equals "this release carries a Sigstore bundle", where the
 * registry accepts them. For all four it is the transparency-log column: the bundle is
 * the Rekor entry (Go's log is not Sigstore, but Go accepts no bundles, so it never asks).
 */
export const SIGSTORE_SIGNAL = "transparency_log" as const;

export function sigstoreOf(ecosystem: EcosystemId): SigstoreFact {
  const fact = SIGSTORE.find((s) => s.ecosystem === ecosystem);
  if (!fact) throw new Error(`no Sigstore fact for ${ecosystem}`);
  return fact;
}
