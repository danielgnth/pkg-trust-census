/**
 * Sigstore across the seven registries, curated from primary sources.
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

import { cite, type Cite } from "../sources/index.ts";
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
  sources: Cite[];
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
  sources: Cite[];
}

export const SIGSTORE: SigstoreFact[] = [
  {
    ecosystem: "npm",
    status: "yes",
    since: "2023-04",
    signs: "The tarball, by the publisher's CI identity (Fulcio), as SLSA provenance in dist.attestations; npm adds a publish attestation signed with its own registry key. Both are logged in the public Rekor.",
    registryVerifies: "yes",
    clients: [
      { client: "npm 12", verifies: "opt-in", note: "`npm audit signatures` checks attestations and registry signatures of an installed tree; `npm install` itself does not.", sources: [cite("npmGeneratingProvenance", "You can verify the provenance attestations of downloaded packages with the following `audit` command: `npm audit signatures`")] },
      { client: "pnpm 12", verifies: "no", note: "`trustPolicy: no-downgrade` (opt-in, since 10.21) refuses a version whose trusted-publisher/provenance metadata is weaker than an earlier one's, but reads the packument fields without verifying the bundle. `pnpm audit signatures` checks registry ECDSA signatures only.", sources: [
          cite("pnpmTrustPolicy", "When set to `no-downgrade`, pnpm will fail if a package's trust level has decreased compared to previous releases."),
          cite("pnpmTrustChecks", "if (manifest._npmUser?.trustedPublisher && manifest.dist?.attestations?.provenance) { return 'trustedPublisher' }"),
          cite("pnpmSignatures", "`verifySignatures()` verifies ECDSA registry signatures for installed package versions."),
        ],
      },
      { client: "Yarn 4", verifies: "no", note: "Generates provenance on publish; does not verify on install.", sources: [cite("yarnProvenance", "export const generateProvenance = async (subject: any, opts?: sigstore.SignOptions) => {")] },
      { client: "Bun", verifies: "no", note: "No attestation handling.", sources: [cite("bunInstall", "Skip verifying integrity of newly downloaded packages")] },
    ],
    similar: "Registry-applied ECDSA signatures on every tarball (dist.signatures), also checked only by `npm audit signatures`.",
    similarShort: "registry ECDSA signatures",
    sources: [
      cite("npmProvenanceGa", "npm provenance is now generally available."),
      cite("npmGeneratingProvenance", "When an npm package is published with provenance, it is signed by Sigstore public good servers and logged in a public transparency ledger"),
      cite("npmProvenanceRepo", "When verification is succesful npm attests the publish with by signing a publish attestation."),
      cite("npmVerifyingSignatures", "Registry signatures can be verified using the following `audit` command:"),
    ],
  },
  {
    ecosystem: "pypi",
    status: "yes",
    since: "2024-11",
    signs: "Each distribution file, by the Trusted Publisher's CI identity (PEP 740), served through the Integrity API. Most bundles carry the publish predicate, not SLSA provenance.",
    registryVerifies: "yes",
    clients: [
      { client: "pip 26", verifies: "no", note: "Checks file hashes only; no attestation verification.", sources: [cite("pipSecureInstalls", "By default, pip does not perform any checks to protect against remote tampering")] },
      { client: "uv 0.12", verifies: "no", note: "Uploads attestations by default when publishing (since 0.9.12); does not verify them on install.", sources: [cite("uvPublish", "By default, uv attempts to upload matching PEP 740 attestations with each distribution that is published.")] },
    ],
    similar: "None left: PGP signature uploads were removed in 2023.",
    similarShort: "none (PGP removed 2023)",
    sources: [
      cite("pypiAttestationsGa", "PyPI package maintainers can now publish signed digital attestations when publishing"),
      cite("pypiAttestationsGa", "The Integrity API provides programmatic access to PyPI's implementation of PEP 740."),
      cite("pep740", "Each bundle corresponds to a signing identity (such as a Trusted Publishing identity), and contains one or more attestation objects."),
      cite("pipSecureInstalls", "By default, pip does not perform any checks to protect against remote tampering"),
      cite("pypiPgpRemoved", "any PGP signatures will be silently ignored"),
    ],
  },
  {
    ecosystem: "rubygems",
    status: "yes",
    since: "2024-12",
    signs: "The .gem, by the CI identity, via `gem push --attestation` (RubyGems 3.6, used by rubygems/release-gem); served at /api/v1/attestations. Accepted only from a trusted-publishing push.",
    registryVerifies: "yes",
    clients: [
      { client: "gem / Bundler 4", verifies: "no", note: "Attestations are only sent (`gem push --attestation`); legacy X.509 signatures are checked only with `-P MediumSecurity`.", sources: [cite("gemPushCommand", "add_option(\"--attestation FILE\", \"Push with sigstore attestations\""), cite("rubygemsSecurityGuide", "users opt into verification with a trust policy, using `gem install -P MediumSecurity`")] },
    ],
    similar: "Legacy X.509 `gem cert` signatures: opt-in to verify, rarely used, not exposed by the API.",
    similarShort: "legacy X.509 gem signing",
    sources: [
      cite("rubygemsDec2024", "adding a `--attestation` option to `gem push` for improved security"),
      cite("rubygemsPusher", "def initialize(api_key, body, request: nil, attestations: nil)"),
      cite("rubygemsSecurityGuide", "In practice signing is rarely used"),
    ],
  },
  {
    ecosystem: "maven",
    status: "yes",
    since: "2025-01",
    signs: "Any deployed file, as an optional .sigstore.json next to the mandatory PGP .asc.",
    registryVerifies: "yes",
    clients: [
      { client: "Maven 3/4", verifies: "no", note: "Checks checksums only; signatures need a plugin.", sources: [cite("pgpverifyMavenPlugin", "This plugin allows you to automatically verify PGP signature of all project dependencies.")] },
      { client: "Gradle 9", verifies: "no", note: "Dependency verification (opt-in, via verification-metadata.xml) checks checksums and PGP .asc signatures, not Sigstore bundles.", sources: [cite("gradleVerification", "Checksums alone verify integrity but not authenticity. Signatures alone verify authenticity but may use weak hashes.")] },
    ],
    similar: "Mandatory PGP signatures on every file: long-lived publisher keys, not logged, not checked by Maven by default.",
    similarShort: "mandatory PGP signatures",
    sources: [
      cite("mavenSigstoreValidation", "we have rolled out an update to the Central Publisher Portal that validates Sigstore signature files."),
      cite("mavenSigstoreValidation", "Sigstore signature files are not required to publish at this time."),
      cite("mavenGpgRequirement", "One of the requirements for publishing your artifacts to the Central Repository, is that they have been signed with PGP."),
    ],
  },
  {
    ecosystem: "go",
    status: "no",
    signs: "Nothing: modules are fetched from VCS and authors cannot sign them.",
    registryVerifies: "n/a",
    clients: [
      { client: "go", verifies: "n/a", note: "No bundles to check; every download is checked against sum.golang.org by default.", sources: [cite("goModuleMirrorLaunch", "The `go` command will use the module mirror and checksum database by default for Go 1.13 module users.")] },
    ],
    similar: "sum.golang.org, Google's own append-only Merkle log of module hashes with signed tree heads, checked by the go command by default. A transparency log like Rekor, but of hashes, not publisher identities.",
    similarShort: "own checksum log, checked by default",
    sources: [
      cite("goChecksumDb", "It is a Transparent Log (or \"Merkle Tree\") of `go.sum` line hashes"),
      cite("goModuleMirrorLaunch", "The `go` command will use the module mirror and checksum database by default for Go 1.13 module users."),
    ],
  },
  {
    ecosystem: "crates",
    status: "no",
    signs: "Nothing: the Sigstore RFC for Cargo (#3403) was closed unmerged in 2023.",
    registryVerifies: "n/a",
    clients: [{ client: "cargo", verifies: "n/a", note: "No bundles to check; checks the index's sha256.", sources: [cite("cargoDownloadVerify", "anyhow::bail!(\"failed to verify the checksum of `{}`\", pkg)")] }],
    similar: "None deployed. A TUF signing experiment exists; trusted publishing records the commit from the CI's OIDC token, but nothing is signed for consumers.",
    similarShort: "none (TUF experiment only)",
    sources: [
      cite("cargoSigstoreRfc", "This proposal will enhance cargo and crates.io through adoption of the Sigstore capabilities and workflows as described in the document."),
      cite("cargoSigstoreRfc", "closed this Aug 14, 2023"),
      cite("rustTufGoal", "We would like to have a experimental out-of-band version of a signing pipeline for the project for releases and crates.io."),
    ],
  },
  {
    ecosystem: "packagist",
    status: "planned",
    signs: "Nothing yet: hosted artifacts with SLSA provenance and Sigstore attestations verified by Composer are a stated direction (2026-05), with news promised 2026-09-29.",
    registryVerifies: "n/a",
    clients: [{ client: "Composer 2.10", verifies: "n/a", note: "No bundles to check; client-side verification is planned with hosted artifacts.", sources: [cite("composerInstall", "The `install` command reads the `composer.json` file from the current directory, resolves the dependencies, and installs them into `vendor`.")] }],
    similar: "A login-gated log of security events (ownership, maintainers, version references); not a log of artifacts.",
    similarShort: "login-gated event log",
    sources: [
      cite("packagist2026", "Further out, we want Packagist.org to begin hosting immutable build artifacts directly, alongside SLSA build provenance and Sigstore attestations"),
      cite("packagist2026", "Packagist.org has a public transparency log (login required) that records security-relevant events across the repository."),
      cite("packagist15Years", "We have some good news to share on that last point in a separate blog post in the next few days."),
    ],
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
