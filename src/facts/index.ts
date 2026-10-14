/**
 * Hand-curated reference data (M7): what each registry makes observable, and the policy
 * facts behind it, each cited to a primary source.
 *
 * Kept in code rather than scraped because these are judgements about mechanisms, not
 * per-package measurements. Every `availability` value here must agree with how the
 * matching adapter builds its signals — test/facts.test.ts checks that it does.
 */

import type { Db } from "../db/open.ts";
import { ecosystemFacts, signalAvailability } from "../db/schema.ts";
import { ecosystemFactsInsert, signalAvailabilityInsert, validateAll } from "../db/validation.ts";
import { cite, sourceUrl, type Cite } from "../sources/index.ts";
import type { Availability, EcosystemId, SignalId } from "../types.ts";

export interface AvailabilityFact {
  ecosystem: EcosystemId;
  signalId: SignalId;
  availability: Availability;
  /** Registry-wide requirement: every release has it, by rule rather than by choice. */
  mandatory: boolean;
  detectionMethod: string;
  notes: string | null;
}

const a = (
  ecosystem: EcosystemId,
  signalId: SignalId,
  availability: Availability,
  detectionMethod: string,
  extra: { mandatory?: boolean; notes?: string } = {},
): AvailabilityFact => ({ ecosystem, signalId, availability, mandatory: extra.mandatory ?? false, detectionMethod, notes: extra.notes ?? null });

export const AVAILABILITY: AvailabilityFact[] = [
  // PyPI
  a("pypi", "identity_publish", "inferred", "PEP 740 provenance present ⇒ Trusted Publishing", {
    notes: "Attestations are issued only via Trusted Publishing, but Trusted Publishing need not emit them; absence is unknown.",
  }),
  a("pypi", "artifact_signature", "observable", "files[].provenance (PEP 740 Sigstore signature by the publisher's CI)", {
    notes: "PyPI removed GPG signature support in 2023.",
  }),
  a("pypi", "registry_integrity", "no_mechanism", "none", {
    notes: "sha256 digests are served over TLS but unsigned; PEP 458 (TUF) is not deployed.",
  }),
  a("pypi", "build_provenance", "observable", "provenance object: in-toto predicateType https://slsa.dev/provenance/v1", {
    notes: "PyPI accepts two predicates; most attestations are the 'publish' predicate, which is not SLSA provenance.",
  }),
  a("pypi", "source_link", "observable", "provenance object: Fulcio certificate source repository digest"),
  a("pypi", "transparency_log", "inferred", "PEP 740 attestations are Rekor-logged Sigstore bundles"),
  a("pypi", "mfa_enforced", "inferred", "registry policy: 2FA mandatory for all accounts from 2024-01-01", { mandatory: true }),

  // npm
  a("npm", "identity_publish", "observable", "versions[v]._npmUser.trustedPublisher", {
    notes: "Field verified live on sigstore@5.0.0, 2026-10-13. Trusted publishing GA 2025-07-31.",
  }),
  a("npm", "artifact_signature", "observable", "versions[v].dist.attestations (Sigstore signature by the publisher's CI)"),
  a("npm", "registry_integrity", "observable", "versions[v].dist.signatures", {
    mandatory: true,
    notes: "Applied by the registry on serve, including to 2016-era tarballs; a hijacked account's upload is signed too.",
  }),
  a("npm", "build_provenance", "observable", "versions[v].dist.attestations.provenance.predicateType (SLSA)"),
  a("npm", "source_link", "observable", "SLSA provenance present (names the source repository and commit)", {
    notes: "`gitHead` is not counted: it is asserted by the uploader's own npm client.",
  }),
  a("npm", "transparency_log", "inferred", "dist.attestations present ⇒ Sigstore bundle logged in public Rekor"),
  a("npm", "mfa_enforced", "inferred", "registry policy: >1M downloads in the week ending 15 days before publish, on/after 2022-11-01 (api.npmjs.org/downloads/point)", {
    notes: "High-impact rule: 2FA required for maintainers of packages above 1M weekly downloads or 500 dependents. Dependents are not in a public API, the 2022 top-100/top-500 cohorts cannot be reconstructed, and the per-package 'require 2FA' setting is not in the packument, so anything below the download threshold is unknown.",
  }),

  // crates.io
  a("crates", "identity_publish", "observable", "versions[].trustpub_data", {
    notes: "The only registry that reports trusted publishing directly. GA July 2025.",
  }),
  a("crates", "artifact_signature", "no_mechanism", "none", { notes: "A TUF signing experiment exists; nothing is deployed." }),
  a("crates", "registry_integrity", "no_mechanism", "none", { notes: "Index checksums are served over TLS but unsigned." }),
  a("crates", "build_provenance", "no_mechanism", "none"),
  a("crates", "source_link", "observable", "versions[].trustpub_data.sha", {
    notes: "Taken from the CI provider's signed OIDC token at publish time; absent for token-published versions. `.cargo_vcs_info.json` is not counted: the uploader asserts it.",
  }),
  a("crates", "transparency_log", "no_mechanism", "none"),
  a("crates", "mfa_enforced", "no_mechanism", "none", {
    notes: "crates.io has no MFA of its own and does not check whether the GitHub account behind a login has 2FA (GitHub requires it of code contributors since 2023, but crates.io cannot rely on it); publishing authenticates with API tokens. A per-crate `trustpub_only` flag (crate endpoint, current value only) can forbid token publishing altogether.",
  }),

  // RubyGems
  a("rubygems", "identity_publish", "inferred", "version page \"Pushed by\": trusted publisher ⇒ true, user (API key) ⇒ false; or attestations present ⇒ true", {
    notes: "The pusher is shown on /gems/{g}/versions/{v} but in no JSON endpoint. Versions pushed before rubygems.org recorded pushers show none and stay unknown, so the share is a lower bound. Attestations are accepted only from trusted-publishing pushes (Pusher#verify_sigstore).",
  }),
  a("rubygems", "artifact_signature", "inferred", "/api/v1/attestations/{g}-{v}.json non-empty ⇒ Sigstore signature", {
    notes: "Legacy `gem cert` X.509 signatures are not exposed, so an empty attestation list is unknown, not false.",
  }),
  a("rubygems", "registry_integrity", "no_mechanism", "none", { notes: "sha256 checksums are served over TLS but unsigned." }),
  a("rubygems", "build_provenance", "observable", "/api/v1/attestations/{g}-{v}.json dsseEnvelope with SLSA predicate", {
    notes: "Bundles seen so far are bare message signatures, not in-toto statements.",
  }),
  a("rubygems", "source_link", "observable", "/api/v1/attestations/{g}-{v}.json Fulcio certificate source repository digest"),
  a("rubygems", "transparency_log", "observable", "/api/v1/attestations/{g}-{v}.json tlogEntries"),
  a("rubygems", "mfa_enforced", "observable", "versions[].metadata.rubygems_mfa_required", {
    notes: "Per-gem opt-in. Owners of gems above 180M downloads must use MFA regardless (since 2022-08-15), which this does not capture.",
  }),

  // Go
  a("go", "identity_publish", "no_mechanism", "none", { notes: "No publisher accounts: the proxy fetches from VCS." }),
  a("go", "artifact_signature", "no_mechanism", "none", { notes: "Module authors cannot sign modules." }),
  a("go", "registry_integrity", "observable", "sum.golang.org /lookup/{mod}@{v} HTTP 200 (Google-signed tree head)", {
    mandatory: true,
    notes: "The go command verifies every download against the checksum database by default (GOSUMDB).",
  }),
  a("go", "build_provenance", "no_mechanism", "none", { notes: "No build step and no attestation format." }),
  a("go", "source_link", "inferred", "proxy /@v/{v}.info Origin {VCS, URL, Ref, Hash}", {
    notes: "The proxy's own record of the commit it fetched. Absent for versions cached before Origin was recorded, hence unknown.",
  }),
  a("go", "transparency_log", "observable", "sum.golang.org /lookup/{mod}@{v} HTTP 200", { mandatory: true }),
  a("go", "mfa_enforced", "no_mechanism", "none", { notes: "No publisher accounts." }),

  // Maven Central
  a("maven", "identity_publish", "no_mechanism", "none", {
    notes: "The Central Portal Publisher API authenticates with user tokens only; there is no OIDC trusted publishing.",
  }),
  a("maven", "artifact_signature", "observable", "HEAD {artifact}-{v}.pom.asc / GET .pom.sigstore.json", {
    mandatory: true,
    notes: "PGP signatures required for every file since the early 2010s (not retroactive). The search index's ec[] omits them.",
  }),
  a("maven", "registry_integrity", "no_mechanism", "none", { notes: "Central serves publisher-uploaded checksums and signs nothing itself." }),
  a("maven", "build_provenance", "observable", "HEAD {artifactId}-{v}.jar.build.slsa", {
    notes: "Published by slsa-github-generator's Maven/Gradle builders; Central neither validates nor indexes it. Other tools' naming is not detected.",
  }),
  a("maven", "source_link", "observable", ".pom.sigstore.json Fulcio certificate source digest, or .jar.build.slsa present"),
  a("maven", "transparency_log", "observable", "GET {artifact}-{v}.pom.sigstore.json", {
    notes: "Optional Sigstore bundles validated by the Central Portal since 2025-01-28; PGP signatures are not logged.",
  }),
  a("maven", "mfa_enforced", "no_mechanism", "none", {
    notes: "Sonatype account MFA is optional and applies to portal login; deployments authenticate with user tokens.",
  }),

  // Packagist
  a("packagist", "identity_publish", "no_mechanism", "none", { notes: "Packagist indexes VCS tags; nothing is uploaded." }),
  a("packagist", "artifact_signature", "no_mechanism", "none"),
  a("packagist", "registry_integrity", "no_mechanism", "none", { notes: "Packagist signs neither metadata nor archives." }),
  a("packagist", "build_provenance", "no_mechanism", "none", { notes: "Hosted artifacts with SLSA provenance are a stated long-term direction (2026-05)." }),
  a("packagist", "source_link", "observable", "versions[v].source.reference", {
    notes: "Releases are VCS tags; Packagist resolves each to a commit itself, as Go's proxy does. Stable versions keep their original commit since 2026-07.",
  }),
  a("packagist", "transparency_log", "no_mechanism", "none", {
    notes: "A security-event log (ownership, maintainer and version-reference changes; soft-deletions and blocked retags since 2026-07) requires login and is not a tamper-evident log of artifacts. Publishing artifact verification data to it is planned.",
  }),
  a("packagist", "mfa_enforced", "no_mechanism", "none", {
    notes: "MFA is optional. Planned (2026-05-27, no dates): MFA events in the transparency log (about six months out), MFA status on profiles, MFA for maintainers of larger packages, then for all accounts. Not live as of 2026-10-13: no MFA shown on profiles or in the package JSON.",
  }),
];

export interface EcosystemFact {
  ecosystem: EcosystemId;
  displayName: string;
  registryUrl: string;
  mandates2fa: boolean | null;
  mfaPolicyNote: string | null;
  trustedPublishingGaDate: string | null;
  trustedPublishingMechanism: string | null;
  notes: string | null;
  sources: Cite[];
}

export const ECOSYSTEM_FACTS: EcosystemFact[] = [
  {
    ecosystem: "pypi",
    displayName: "PyPI",
    registryUrl: "https://pypi.org",
    mandates2fa: true,
    mfaPolicyNote: "2FA required for all accounts for management actions and uploads from 2024-01-01.",
    trustedPublishingGaDate: "2023-04-20",
    trustedPublishingMechanism: "OIDC Trusted Publishers (GitHub Actions, GitLab CI/CD, Google Cloud, ActiveState)",
    notes: "PEP 740 digital attestations generally available from 2024-11-14.",
    sources: [
      cite("pypi2faEnforced", "It's January 1st, 2024, and PyPI now requires Two-factor authentication (2FA) for all users."),
      cite("pypiTrustedPublishersLaunch", "PyPI currently supports trusted publishing with GitHub Actions"),
      cite("pypiTrustedPublishersAdding", "GitHub ActionsGoogle CloudActiveStateGitLab CI/CD"),
      cite("pypiAttestationsGa", "PyPI package maintainers can now publish signed digital attestations when publishing"),
      cite("pep740", "Each bundle corresponds to a signing identity (such as a Trusted Publishing identity), and contains one or more attestation objects."),
    ],
  },
  {
    ecosystem: "npm",
    displayName: "npm",
    registryUrl: "https://www.npmjs.com",
    mandates2fa: null,
    mfaPolicyNote:
      "Tiered: 2FA required for maintainers of the top 100 packages by dependents from 2022-02-01, the top 500 from 2022-05, and every high-impact package (>1M weekly downloads or >500 dependents) from 2022-11-01. Since 2026-07-31 tokens that bypass 2FA can no longer manage tokens, maintainers, access or trusted publishing; they can still publish until a planned 2027-01 cutoff. The 2025-09-22 plan to remove bypass-2FA local publishing has no date.",
    trustedPublishingGaDate: "2025-07-31",
    trustedPublishingMechanism: "OIDC trusted publishing (GitHub Actions, GitLab CI/CD, CircleCI)",
    notes: "Trusted publishing emits provenance attestations by default.",
    sources: [
      cite("npmTrustedPublishingGa", "As of today, npm trusted publishing with OpenID Connect (OIDC) is now generally available."),
      cite("npmTrustedPublishersDocs", "CircleCI (CircleCI cloud)"),
      cite("npmTop100Require2fa", "Starting today, we are rolling out mandatory 2FA to our first cohort, all maintainers of top-100 npm packages by dependents."),
      cite("npmTop500Require2fa", "On May 31, we will enroll the next cohort in mandatory 2FA—maintainers of the top-500 packages."),
      cite("npmHighImpact2fa", "Starting today, two-factor authentication (2FA) will be enforced for maintainers of all high-impact npm packages."),
      cite("npmHighImpact2fa", "A package is marked as a high impact package when they have more than 1 million weekly downloads or have more than 500 dependents."),
      cite("npmSecureSupplyChainPlan", "Remove the option to bypass 2FA for local package publishing."),
      cite("npmBypass2faRestricted", "npm granular access tokens (GATs) configured to bypass 2FA can no longer perform sensitive account, org, and package management actions."),
      cite("npmBypass2faRestricted", "We are targeting January 2027 for this update."),
      cite("npmGeneratingProvenance", "If you use trusted publishing, provenance attestations are automatically generated for your packages without requiring the `--provenance` flag."),
    ],
  },
  {
    ecosystem: "crates",
    displayName: "crates.io",
    registryUrl: "https://crates.io",
    mandates2fa: false,
    mfaPolicyNote: "No registry MFA; login is via GitHub OAuth, which does not reveal whether 2FA was used. GitHub requires 2FA of code contributors (rolled out 2023), but crates.io does not enforce it. Publishing uses API tokens.",
    trustedPublishingGaDate: "2025-07-11",
    trustedPublishingMechanism: "OIDC trusted publishing (RFC 3691), GitHub Actions",
    notes: "No artifact signing or attestation scheme.",
    sources: [
      cite("cratesUpdate202507", "We are excited to announce that we have implemented \"Trusted Publishing\" support on crates.io, as described in RFC #3691."),
      cite("cratesTrustedPublishingRfc", "Short-lived access tokens are granted via the OpenID Connect (OIDC) protocol"),
      cite("cratesUpdate202601", "Trusted Publishing now supports GitLab CI/CD in addition to GitHub Actions."),
    ],
  },
  {
    ecosystem: "rubygems",
    displayName: "RubyGems",
    registryUrl: "https://rubygems.org",
    mandates2fa: null,
    mfaPolicyNote:
      "MFA required for owners of gems with more than 180M total downloads from 2022-08-15; gems may opt in per version via metadata.rubygems_mfa_required.",
    trustedPublishingGaDate: "2023-12-14",
    trustedPublishingMechanism: "OIDC trusted publishing (GitHub Actions)",
    notes: "Sigstore attestations accepted via `gem push --attestation` and exposed at /api/v1/attestations/{gem}-{version}.json.",
    sources: [
      cite("rubygemsTrustedPublishing", "Under the hood, Trusted Publishing uses OpenID Connect (OIDC) to exchange short-lived identity tokens between GitHub Actions and RubyGems.org."),
      cite("rubygemsMfaPopular", "Today (August 15th, 2022), we will begin to enforce MFA on owners of gems with over 180 million total downloads."),
      cite("rubygemsMfaOptIn", "Opt in a gem you are managing by releasing a version that has `metadata.rubygems_mfa_required` set to `true`."),
    ],
  },
  {
    ecosystem: "go",
    displayName: "Go modules",
    registryUrl: "https://proxy.golang.org",
    mandates2fa: null,
    mfaPolicyNote: "Not applicable: Go has no publisher accounts.",
    trustedPublishingGaDate: null,
    trustedPublishingMechanism: null,
    notes: "Checksum database (sum.golang.org) verified by default since Go 1.13.",
    sources: [
      cite("goChecksumDb", "The default value of `GOSUMDB` is `sum.golang.org`, the public checksum database operated by Google"),
      cite("goModuleMirrorLaunch", "The `go` command will use the module mirror and checksum database by default for Go 1.13 module users."),
    ],
  },
  {
    ecosystem: "maven",
    displayName: "Maven Central",
    registryUrl: "https://central.sonatype.com",
    mandates2fa: null,
    mfaPolicyNote: "Account MFA optional (Sonatype Cloud / Auth0); deployments authenticate with user tokens, so it is never required for a publish.",
    trustedPublishingGaDate: null,
    trustedPublishingMechanism: null,
    notes: "PGP signatures mandatory for all deployed files; Sigstore bundles optional and validated since 2025-01-28.",
    sources: [
      cite("mavenGpgRequirement", "One of the requirements for publishing your artifacts to the Central Repository, is that they have been signed with PGP."),
      cite("mavenSigstoreValidation", "we have rolled out an update to the Central Publisher Portal that validates Sigstore signature files."),
      cite("mavenPortalApi", "Requests to the API must be authenticated via a user token header."),
      cite("sonatypeMfa", "Multi-factor authentication (MFA) may be configured with an authenticator of your choice."),
    ],
  },
  {
    ecosystem: "packagist",
    displayName: "Packagist",
    registryUrl: "https://packagist.org",
    mandates2fa: false,
    mfaPolicyNote: "MFA optional on Packagist.org. Public MFA events and profile status, then MFA for larger packages and all accounts, planned since 2026-05-27 without dates. Private Packagist's org-level MFA enforcement (extended to Composer tokens 2026-08) does not apply to public packages.",
    trustedPublishingGaDate: null,
    trustedPublishingMechanism: null,
    notes: "Packagist indexes VCS repositories; Composer downloads archives from the forge. Stable versions keep their original commit since 2026-07 (archives are still generated by the forge); a login-gated security-event log records ownership, maintainer and reference changes. Hosted artifacts with SLSA provenance and trusted publishing are a stated direction.",
    sources: [
      cite("packagistAbout", "New versions of your package are automatically fetched from tags you create in your VCS repository."),
      cite("composerRepositories", "there is special support for GitHub and Bitbucket that use the APIs provided by these sites, to fetch the packages without having to install the version control system."),
      cite("packagist2026", "Packagist.org has a public transparency log (login required) that records security-relevant events across the repository."),
      cite("packagist2026", "Beyond that, we intend to implement FIDO2 support and eventually require MFA for all Packagist.org accounts."),
      cite("packagistImmutable", "Stable version metadata on Packagist.org is now immutable."),
      cite("privatePackagistAug2026", "a user without MFA configured can no longer use their Composer auth token to reach the Composer repository of an organization that requires MFA."),
    ],
  },
];

/** Upserts both reference tables. Idempotent, so every `extract` can call it. */
export function seedFacts(db: Db): void {
  const availability = validateAll(
    signalAvailabilityInsert,
    AVAILABILITY,
    "signal_availability",
  );
  const facts = validateAll(
    ecosystemFactsInsert,
    ECOSYSTEM_FACTS.map((f) => ({ ...f, sources: [...new Set(f.sources.map((c) => sourceUrl(c.source)))].join("\n") })),
    "ecosystem_facts",
  );

  db.transaction((tx) => {
    for (const row of availability) {
      tx.insert(signalAvailability)
        .values(row)
        .onConflictDoUpdate({ target: [signalAvailability.ecosystem, signalAvailability.signalId], set: row })
        .run();
    }
    for (const row of facts) {
      tx.insert(ecosystemFacts).values(row).onConflictDoUpdate({ target: ecosystemFacts.ecosystem, set: row }).run();
    }
  });
}

export function availabilityOf(ecosystem: EcosystemId, signal: SignalId): AvailabilityFact {
  const f = AVAILABILITY.find((x) => x.ecosystem === ecosystem && x.signalId === signal);
  if (!f) throw new Error(`no availability fact for ${ecosystem}/${signal}`);
  return f;
}
