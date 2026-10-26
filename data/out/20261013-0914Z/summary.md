# Run summary — snapshot 20261013-0914Z

As of 2026-10-13T09:14:26.098Z · generated 2026-10-21T10:53:57.735Z

**350/350 packages extracted · error rate 0.0%** (within the < 5% target)

## Coverage

| Ecosystem | Ranked by | Sampled | Fetched | Fetch errors | Extracted | Extract errors |
|---|---|---:|---:|---:|---:|---:|
| PyPI | downloads | 50 | 50 | 0 | 50 | 0 |
| npm | downloads | 50 | 50 | 0 | 50 | 0 |
| crates.io | downloads | 50 | 50 | 0 | 50 | 0 |
| RubyGems | downloads | 50 | 50 | 0 | 50 | 0 |
| Go | dependents | 50 | 50 | 0 | 50 | 0 |
| Maven Central | dependents | 50 | 50 | 0 | 50 | 0 |
| Packagist | downloads | 50 | 50 | 0 | 50 | 0 |

### Trust summary per platform (snapshot 20261013-0914Z)

| Platform | Capability | Auditable | Assurance (latest) | Assurance (2024Q1) | Publisher authentication | Artifact authenticity | Source provenance |
|---|---:|---:|---:|---:|---:|---:|---:|
| **PyPI** | 3/3 | 3/3 | 59%–65% | 11%–33% | 82%–100% | 64% | 32% |
| **npm** | 3/3 | 3/3 | 44%–47% | 31%–36% | 53%–60% | 60% | 20% |
| **Maven Central** | 2/3 | 2/3 | 33% | 33% | — no mechanism | 98% | 0% |
| **Go** | 1/3 | 1/3 | 29%–33% | 29%–33% | — no mechanism | 50% | 38%–50% |
| **RubyGems** | 3/3 | 3/3 | 28%–53% | 5%–38% | 45% | 26%–100% | 13% |
| **Packagist** | ½/3 | ½/3 | 17% | 17% | — no mechanism | — no mechanism | 50% |
| **crates.io** | 1½/3 | 1½/3 | 11% | 0% | 22% | — no mechanism | 11% |

Three categories, each answered by the strongest signal a release has: 1 point for the strong level, ½ for
the weak one. *Publisher authentication*: identity-bound publish (1) or enforced MFA (½). *Artifact
authenticity*: publisher signature (1) or registry signature (½). *Source provenance*: SLSA provenance (1)
or source link (½). Transparency log is reported in the matrix but not scored, because every Sigstore
signature is logged and would count twice.

*Capability*: the points the platform offers at all. *Auditable*: those the public API lets an outsider
check. *Assurance*: the average share of the points a sampled package's release actually has; a range
means some signals are unknown (low end counts them as absent, high end as present).

### How the latest releases were published (snapshot 20261013-0914Z)

| Platform | Trusted publishing (OIDC) | Account credential | Unknown | Credential used otherwise |
|---|---:|---:|---:|---|
| **PyPI** | ≥ 64% (32) | 0% (0) | 36% (18) | API token (not distinguishable from trusted publishing without attestations) |
| **npm** | 20% (10) | 80% (40) | 0% (0) | granular token or login session |
| **crates.io** | 22% (11) | 78% (39) | 0% (0) | API token |
| **RubyGems** | 32% (16) | 68% (34) | 0% (0) | user API key |
| **Go** | – | – | – | none: releases are VCS tags |
| **Maven Central** | 0% (0) | 100% (50) | 0% (0) | Portal user token (no OIDC path exists) |
| **Packagist** | – | – | – | none: releases are VCS tags |

No registry reveals whether a credential was long-lived, so "account credential" covers expiring tokens too
(npm write tokens expire after at most 90 days since 2025-11).

### Registry baseline (default toolchain, verified 2026-10-14)

| | Immutable versions | Install checks hash | Lockfile pins hashes | Client checks signature | Scoped, expiring tokens | No code at install |
|---|---|---|---|---|---|---|
| **PyPI** | ✓ yes (since 2026-07) | ✓ yes | ◐ partial | ✗ no | ◐ partial | ◐ partial |
| **npm** | ✓ yes | ✓ yes | ✓ yes | ✗ no | ✓ yes (since 2025-11) | ✓ yes (since 2026-07) |
| **crates.io** | ✓ yes | ✓ yes | ✓ yes | ✗ no | ✓ yes | ✗ no |
| **RubyGems** | ✓ yes | ✓ yes | ◐ partial | ✗ no | ✓ yes | ◐ partial |
| **Go** | ✓ yes | ✓ yes | ✓ yes | ✓ yes | – n/a | ✓ yes |
| **Maven Central** | ✓ yes | ◐ partial | ✗ no | ✗ no | ◐ partial | ◐ partial |
| **Packagist** | ✓ yes (since 2026-07) | ✗ no | ◐ partial | ✗ no | – n/a | ✓ yes |

What each column asks:

- **Immutable versions**: Once published, can a version's files never be replaced or added to?
- **Install checks hash**: Does the default client check each download against the registry's hash?
- **Lockfile pins hashes**: Does the default lockfile record artifact hashes, so later installs get identical bytes?
- **Client checks signature**: Does the default client check a signature or transparency log, so a compromised registry or mirror is detected?
- **Scoped, expiring tokens**: Can publish credentials be limited to specific packages and made to expire?
- **No code at install**: Does installing or building leave dependency code unexecuted by default?

Protections against tampering and bad releases, complementing the trust score, which measures whether
an outsider can verify who published a release and from what source. Not part of the score: these
describe ecosystem defaults, not the sampled packages. *since* marks a value that changed recently,
so the backfill quarters predate it.

### Registry governance and containment (verified 2026-10-14)

| | Owned namespaces | Confusable names blocked | Uploads scanned | Withdraw, keep lockfiles | Deletion restricted | Client acts on advisories |
|---|---|---|---|---|---|---|
| **PyPI** | ✗ no | ◐ partial | ◐ partial | ✓ yes | ✗ no | ✗ no |
| **npm** | ◐ partial | ◐ partial | ◐ partial | ◐ partial | ✓ yes | ◐ partial |
| **crates.io** | ✗ no | ◐ partial | ◐ partial | ✓ yes | ✓ yes | ✗ no |
| **RubyGems** | ✗ no | ◐ partial | ✓ yes | ✗ no | ✗ no | ✗ no |
| **Go** | ✓ yes | – n/a | ✗ no | ✓ yes | ✓ yes | ✗ no |
| **Maven Central** | ✓ yes | – n/a | ✗ no | ✗ no | ✓ yes | ✗ no |
| **Packagist** | ✓ yes | ◐ partial | ✓ yes (since 2026-03) | ◐ partial (since 2026-07) | ◐ partial (since 2026-07) | ✓ yes |

What each column asks:

- **Owned namespaces** (governance): Can a publisher own a name prefix that nobody else can publish into?
- **Confusable names blocked** (governance): Does registration reject a name confusable with an existing package?
- **Uploads scanned** (governance): Are new uploads analysed for malware automatically, by the registry or a feed it acts on?
- **Withdraw, keep lockfiles** (containment): Can a version be withdrawn from new resolution while existing lockfiles still install it (yank)?
- **Deletion restricted** (containment): Are authors prevented from deleting a published version after the fact?
- **Client acts on advisories** (containment): Does the default client warn about or block known-vulnerable versions without extra tools?

### Withdrawn versions since 2024-04-01 (snapshot 20261013-0914Z)

| Platform | Mechanism | Packages withdrawing ≥ 1 version | Withdrawn versions | Why no data |
|---|---|---:|---:|---|
| **PyPI** | yanked | 36% (18/50) | 2% (41/2237) | |
| **npm** | unpublished | 18% (9/50) | <1% (9/3926) | |
| **npm** | deprecated (still installs) | 8% (4/50) | 1% (20/3926) | |
| **crates.io** | yanked | 24% (12/50) | 2% (16/1058) | |
| **RubyGems** | – | – | – | yanked versions vanish from every API, so yanks cannot be counted |
| **Go** | retracted (all time) | 8% (4/50) | 44 | |
| **Maven Central** | – | – | – | nothing can be withdrawn |
| **Packagist** | – | – | – | soft-deleted versions are not in the public API |

Counted over versions published in the window; Go's retractions are undated and counted over each module's
history. Per-package rows, with the version numbers, are in `withdrawals.csv`.

### Known advisories (OSV, queried 2026-10-15; snapshot 20261013-0914Z)

| Platform | Latest release: with a known vulnerability | Vulnerabilities | Malware reports | Release installed at the end of 2024Q1: known then → now |
|---|---:|---:|---:|---:|
| **PyPI** | 0% (0/50) | 0 | 0 | 0% → 35% (n=49) |
| **npm** | 0% (0/50) | 0 | 0 | 0% → 16% (n=50) |
| **crates.io** | 0% (0/50) | 0 | 0 | 0% → 4% (n=48) |
| **RubyGems** | 0% (0/50) | 0 | 0 | 0% → 28% (n=50) |
| **Go** | 2% (1/50) | 1 | 0 | 0% → 17% (n=48) |
| **Maven Central** | 4% (2/50) | 7 | 0 | 4% → 22% (n=50) |
| **Packagist** | 0% (0/50) | 0 | 0 | 0% → 16% (n=50) |

A vulnerability listed by several databases (GHSA, PYSEC, RUSTSEC, GO, …) counts once, and counts as known from
its first publication in any of them. The last column is about a different, older release of each package: the one
a default install chose at the end of 2024Q1, with the share that had a published advisory by then, and by the snapshot.
A low share for the latest release beside a high one for the older release means the vulnerabilities were found later
and fixed in newer releases.

#### Malware reports

| Platform | Package | Version | Report | Released | Reported | Hours | Withdrawn |
|---|---|---|---|---|---|---:|---|
| npm | ansi-regex | 6.2.1 | MAL-2025-46966 | 2025-09-08T13:14:15.663Z | 2025-09-08T17:18:30.000Z | 4.1 | unpublished |
| npm | ansi-styles | 6.2.2 | MAL-2025-46967 | 2025-09-08T13:12:10.343Z | 2025-09-08T17:07:44.000Z | 3.9 | unpublished |
| npm | chalk | 5.6.1 | MAL-2025-46969 | 2025-09-08T13:13:05.239Z | 2025-09-08T17:11:19.000Z | 4.0 | unpublished |
| npm | color-convert | 3.1.1 | GHSA-pxx3-g568-hxr4, MAL-2025-46971 | 2025-09-08T13:14:53.099Z | 2025-09-08T15:20:15.000Z | 2.1 | unpublished |
| npm | color-name | 2.0.1 | GHSA-5fvm-p68v-5wmh, MAL-2025-46972 | 2025-09-08T13:15:12.330Z | 2025-09-08T15:05:16.000Z | 1.8 | unpublished |
| npm | debug | 4.4.2 | GHSA-4x49-vf9v-38px, MAL-2025-46974 | 2025-09-08T13:12:39.973Z | 2025-09-08T14:26:51.000Z | 1.2 | unpublished |
| npm | strip-ansi | 7.1.1 | MAL-2025-46980 | 2025-09-08T13:13:50.431Z | 2025-09-08T17:14:19.000Z | 4.0 | unpublished |
| npm | supports-color | 10.2.1 | MAL-2025-46981 | 2025-09-08T13:13:28.154Z | 2025-09-08T17:16:42.000Z | 4.1 | unpublished |
| npm | wrap-ansi | 9.0.1 | MAL-2025-46983 | 2025-09-08T13:14:36.637Z | 2025-09-08T17:19:41.000Z | 4.1 | unpublished |

Withdrawn versions with a malware report:

| Platform | Mechanism | Withdrawn versions | With a malware report |
|---|---|---:|---:|
| PyPI | yanked | 41 | 0 |
| npm | unpublished | 9 | 9 |
| npm | deprecated (still installs) | 20 | 0 |
| crates.io | yanked | 16 | 0 |
| Go | retracted (all time) | 44 | 0 |

#### Which databases list them, and how late

| Platform | Database | Vulnerabilities listed | Published first | Median days behind the first |
|---|---|---:|---:|---:|
| PyPI | GHSA | 74 | 62 | 13 |
| PyPI | PYSEC | 71 | 13 | 10 |
| npm | GHSA | 28 | 25 | 7 |
| npm | MAL | 9 | 9 | – |
| crates.io | GHSA | 3 | 0 | 5 |
| crates.io | RUSTSEC | 3 | 3 | – |
| RubyGems | GHSA | 75 | 75 | – |
| Go | GO | 52 | 46 | 7 |
| Go | GHSA | 28 | 6 | 35 |
| Maven Central | GHSA | 43 | 43 | – |
| Packagist | GHSA | 25 | 25 | – |

Over the vulnerabilities affecting any sampled or withdrawn version. A database whose record carries the earliest
`published` time counts as first (ties count for each); the median is over the vulnerabilities it listed later.

### Sigstore across registries (verified 2026-10-14)

4 of 7 registries accept Sigstore bundles (npm, PyPI, RubyGems, Maven Central), all logged in the
public Rekor instance. In the trust matrix each bundle counts as a publisher signature and a transparency-log entry.

| | Sigstore | Since | Latest releases with a bundle | Registry verifies on upload | Best install client | Nearest equivalent |
|---|---|---|---:|---|---|---|
| **PyPI** | ✓ yes | 2024-11 | 64% (32/50) | yes | no (pip 26) | None left: PGP signature uploads were removed in 2023. |
| **npm** | ✓ yes | 2023-04 | 20% (10/50) | yes | opt-in (npm 12) | Registry-applied ECDSA signatures on every tarball (dist.signatures), also checked only by `npm audit signatures`. |
| **crates.io** | ✗ no | – | – | n/a | n/a | None deployed. A TUF signing experiment exists; trusted publishing records the commit from the CI's OIDC token, but nothing is signed for consumers. |
| **RubyGems** | ✓ yes | 2024-12 | 26% (13/50) | yes | no (gem / Bundler 4) | Legacy X.509 `gem cert` signatures: opt-in to verify, rarely used, not exposed by the API. |
| **Go** | ✗ no | – | – | n/a | n/a | sum.golang.org, Google's own append-only Merkle log of module hashes with signed tree heads, checked by the go command by default. A transparency log like Rekor, but of hashes, not publisher identities. |
| **Maven Central** | ✓ yes | 2025-01 | 0% (0/50) | yes | no (Maven 3/4) | Mandatory PGP signatures on every file: long-lived publisher keys, not logged, not checked by Maven by default. |
| **Packagist** | ◐ planned | – | – | n/a | n/a | A login-gated log of security events (ownership, maintainers, version references); not a log of artifacts. |

No install client checks Sigstore bundles by default, including newer ones (uv, pnpm, Yarn, Bun, Gradle).
The only check is npm's opt-in `npm audit signatures`, run after install.

### Post-quantum exposure (verified 2026-10-14, TLS measured live)

| | Install hash | Publisher signature | Registry signature | Transparency log | Transport (TLS) | Publish credential | MFA |
|---|---|---|---|---|---|---|---|
| **PyPI** | ✓ SHA-256 | ✗ ECDSA P-256 | – | ◐ SHA-256 · ECDSA | ◐ X25519MLKEM768 | ✗ OIDC RS256 | ◐ TOTP · WebAuthn |
| **npm** | ✓ SHA-512 | ✗ ECDSA P-256 | ✗ ECDSA P-256 | ◐ SHA-256 · ECDSA | ✗ TLS 1.2 · X25519 | ✗ OIDC RS256 | ◐ TOTP · WebAuthn |
| **crates.io** | ✓ SHA-256 | – | – | – | ◐ X25519MLKEM768 | ✗ OIDC RS256 | ◐ via GitHub |
| **RubyGems** | ✓ SHA-256 | ✗ ECDSA P-256 | – | ◐ SHA-256 · ECDSA | ◐ X25519MLKEM768 | ✗ OIDC RS256 | ◐ TOTP · WebAuthn |
| **Go** | ✓ SHA-256 | – | ✗ Ed25519 | ◐ SHA-256 · Ed25519 | ◐ X25519MLKEM768 | ✗ forge SSH key | – |
| **Maven Central** | ⚠ SHA-1 / MD5 | ✗ PGP RSA/EdDSA | – | ◐ SHA-256 · ECDSA | ◐ X25519MLKEM768 | ✓ bearer token | ✓ TOTP (optional) |
| **Packagist** | ⚠ git SHA-1 | – | – | – | ◐ mixed | ✗ forge SSH key | ✓ TOTP (optional) |

✓ post-quantum safe (hash ≥ 256 bits or symmetric secret) · ◐ partly (hash-chained log with classical
checkpoint signatures, hybrid TLS with classical certificates, TOTP beside WebAuthn) · ✗ broken by a quantum
computer (RSA, ECDSA, EdDSA) · ⚠ weak already (SHA-1, MD5) · – not used.

Every signature in every ecosystem is classical, Sigstore included (its ML-DSA instance is targeted for
mid-2027). What is already post-quantum safe is the hashing: lockfile and index hashes everywhere except
Maven (SHA-1) and Packagist (git SHA-1), and the Merkle trees under Rekor and sum.golang.org.

## Headline numbers

Latest version, against the 2024Q1 quarter anchor. Cells with no mechanism or not exposed are omitted; see matrix.md.

| Signal | Ecosystem | Availability | Latest | Unknown | 2024Q1 |
|---|---|---|---:|---:|---:|
| Identity-bound publish | PyPI | inferred | 64% | 18 | 0% (n=49) |
| Identity-bound publish | npm | observable | 20% | 0 | 0% (n=50) |
| Identity-bound publish | crates.io | observable | 22% | 0 | 0% (n=48) |
| Identity-bound publish | RubyGems | inferred | 32% | 0 | 0% (n=50) |
| Publisher signature | PyPI | observable | 64% | 0 | 0% (n=49) |
| Publisher signature | npm | observable | 20% | 0 | 6% (n=50) |
| Publisher signature | RubyGems | inferred | 26% | 37 | 0% (n=50) |
| Publisher signature | Maven Central | observable | 98% | 0 | 98% (n=50) |
| Registry integrity | npm | observable | 100% | 0 | 100% (n=50) |
| Registry integrity | Go | observable | 100% | 0 | 100% (n=48) |
| SLSA provenance | PyPI | observable | 0% | 0 | 0% (n=49) |
| SLSA provenance | npm | observable | 20% | 0 | 6% (n=50) |
| SLSA provenance | RubyGems | observable | 0% | 0 | 0% (n=50) |
| SLSA provenance | Maven Central | observable | 0% | 0 | 0% (n=50) |
| Source link | PyPI | observable | 64% | 0 | 0% (n=49) |
| Source link | npm | observable | 20% | 0 | 6% (n=50) |
| Source link | crates.io | observable | 22% | 0 | 0% (n=48) |
| Source link | RubyGems | observable | 26% | 0 | 0% (n=50) |
| Source link | Go | inferred | 76% | 12 | 73% (n=48) |
| Source link | Maven Central | observable | 0% | 0 | 0% (n=50) |
| Source link | Packagist | observable | 100% | 0 | 100% (n=50) |
| Transparency log | PyPI | inferred | 64% | 0 | 0% (n=49) |
| Transparency log | npm | inferred | 20% | 0 | 6% (n=50) |
| Transparency log | RubyGems | observable | 26% | 0 | 0% (n=50) |
| Transparency log | Go | observable | 100% | 0 | 100% (n=48) |
| Transparency log | Maven Central | observable | 0% | 0 | 0% (n=50) |
| MFA enforced | PyPI | inferred | 100% | 0 | 67% (n=49) |
| MFA enforced | npm | inferred | 86% | 7 | 66% (n=50) |
| MFA enforced | RubyGems | observable | 50% | 0 | 28% (n=50) |

### Trust-signal adoption among top packages, latest version (snapshot 20261013-0914Z)

| | Identity-bound publish | Publisher signature | Registry integrity | SLSA provenance | Source link | Transparency log | MFA enforced |
|---|---|---|---|---|---|---|---|
| **PyPI** | ≥ 64% (32/50) [50–76%] | 64% (32/50) [50–76%] | — no mechanism | 0% (0/50) [0–7%] | 64% (32/50) [50–76%] | 64% (32/50) [50–76%] | 100% (50/50) [93–100%] · mandatory |
| **npm** | 20% (10/50) [11–33%] | 20% (10/50) [11–33%] | 100% (50/50) [93–100%] · mandatory | 20% (10/50) [11–33%] | 20% (10/50) [11–33%] | 20% (10/50) [11–33%] | ≥ 86% (43/50) [74–93%] |
| **crates.io** | 22% (11/50) [13–35%] | — no mechanism | — no mechanism | — no mechanism | 22% (11/50) [13–35%] | — no mechanism | — no mechanism |
| **RubyGems** | 32% (16/50) [21–46%] | ≥ 26% (13/50) [16–40%] | — no mechanism | 0% (0/50) [0–7%] | 26% (13/50) [16–40%] | 26% (13/50) [16–40%] | 50% (25/50) [37–63%] |
| **Go** | — no mechanism | — no mechanism | 100% (50/50) [93–100%] · mandatory | — no mechanism | ≥ 76% (38/50) [63–86%] | 100% (50/50) [93–100%] · mandatory | — no mechanism |
| **Maven Central** | — no mechanism | 98% (49/50) [90–100%] · mandatory | — no mechanism | 0% (0/50) [0–7%] | 0% (0/50) [0–7%] | 0% (0/50) [0–7%] | — no mechanism |
| **Packagist** | — no mechanism | — no mechanism | — no mechanism | — no mechanism | 100% (50/50) [93–100%] | — no mechanism | — no mechanism |

Percentages are true / all sampled packages with an extracted latest version, so `unknown` counts as not adopted.
Brackets give the 95% Wilson interval.
`≥` marks an inferred signal, where the figure is a lower bound. *No mechanism*: the ecosystem has no such
feature. *Not exposed*: the feature exists but the registry's public API does not reveal who uses it.
*Mandatory*: required registry-wide by policy.

Inferred cells, and what they are inferred from:

- **PyPI · Identity-bound publish**: PEP 740 provenance present ⇒ Trusted Publishing. Attestations are issued only via Trusted Publishing, but Trusted Publishing need not emit them; absence is unknown.
- **PyPI · Transparency log**: PEP 740 attestations are Rekor-logged Sigstore bundles.
- **PyPI · MFA enforced**: registry policy: 2FA mandatory for all accounts from 2024-01-01.
- **npm · Transparency log**: dist.attestations present ⇒ Sigstore bundle logged in public Rekor.
- **npm · MFA enforced**: registry policy: >1M downloads in the week ending 15 days before publish, on/after 2022-11-01 (api.npmjs.org/downloads/point). High-impact rule: 2FA required for maintainers of packages above 1M weekly downloads or 500 dependents. Dependents are not in a public API, the 2022 top-100/top-500 cohorts cannot be reconstructed, and the per-package 'require 2FA' setting is not in the packument, so anything below the download threshold is unknown.
- **RubyGems · Identity-bound publish**: version page "Pushed by": trusted publisher ⇒ true, user (API key) ⇒ false; or attestations present ⇒ true. The pusher is shown on /gems/{g}/versions/{v} but in no JSON endpoint. Versions pushed before rubygems.org recorded pushers show none and stay unknown, so the share is a lower bound. Attestations are accepted only from trusted-publishing pushes (Pusher#verify_sigstore).
- **RubyGems · Publisher signature**: /api/v1/attestations/{g}-{v}.json non-empty ⇒ Sigstore signature. Legacy `gem cert` X.509 signatures are not exposed, so an empty attestation list is unknown, not false.
- **Go · Source link**: proxy /@v/{v}.info Origin {VCS, URL, Ref, Hash}. The proxy's own record of the commit it fetched. Absent for versions cached before Origin was recorded, hence unknown.

Columns read from one mechanism move together and are not independent evidence. The trust score therefore
groups signals into categories and counts each category once:

- **npm**: Publisher signature, SLSA provenance, Source link, Transparency log are all read from `dist.attestations`, which npm accepts only with an SLSA predicate, so the four columns are identical.
- **PyPI**: Identity-bound publish, Publisher signature, Transparency log are all read from a PEP 740 attestation on any file of the release.
- **RubyGems**: Publisher signature, Transparency log are both read from a non-empty attestation list.
- **Go**: Registry integrity, Transparency log are both read from the sum.golang.org lookup.
