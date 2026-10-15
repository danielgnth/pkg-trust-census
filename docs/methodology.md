# Methodology

Paste-ready description of how the dataset is produced. Every rule below is what the code does; where a
rule involves a judgement, the alternative and the reason for rejecting it are stated.

## Sample

For each of seven registries we take the top *N* packages (pilot *N* = 50, full run *N* = 250).

| Registry | Ranking source | Frame | Window |
|---|---|---|---|
| PyPI | `hugovk/top-pypi-packages` (BigQuery export) | downloads | 30 days |
| npm | ecosyste.ms seed (1.2 × *N*), re-counted with `api.npmjs.org/downloads/point/last-month` | downloads | last month |
| crates.io | `/api/v1/crates?sort=recent-downloads` | downloads | 90 days |
| RubyGems | ecosyste.ms `rubygems.org?sort=downloads` | downloads | all time |
| Go | ecosyste.ms `proxy.golang.org?sort=dependent_packages_count` | dependents | — |
| Maven Central | ecosyste.ms `repo1.maven.org?sort=dependent_packages_count` | dependents | — |
| Packagist | `/explore/popular.json` (Packagist's own popularity order) | downloads | Packagist-defined |

Go and Maven Central publish no download counts anywhere, so they are sampled by number of dependent
packages instead. The frame is recorded per row (`packages.rank_frame`). The two frames select different
populations: dependents favours libraries, downloads favours whatever CI systems install most. Comparisons
across the frame boundary should be read with that in mind. ecosyste.ms is a third-party aggregator. It
only seeds the candidate lists. Where the registry publishes authoritative counts (npm), those counts
replace the seed's. RubyGems has no recent-window ranking, so its all-time order favours long-established
gems.

## Snapshot and versions

A snapshot is identified by its start time (UTC, minute resolution). All quarter boundaries are computed
relative to that instant, never to the time a later stage happens to run, so `fetch` and `extract` always
agree on which releases to read.

For every package we store two kinds of version:

- **Latest**: the registry's own notion of the current release (PyPI `info.version`, npm
  `dist-tags.latest`, crates.io `default_version`, RubyGems `version`, Go `@latest`). Maven Central uses
  the newest stable entry in `maven-metadata.xml`, because its `<release>` element can name an alpha.
  Packagist uses the newest stable tag, because it has no "current" field.
- **Quarter anchors**: for each quarter from 2024Q1 to the last completed quarter, the newest release
  published *at or before the quarter's end*. This is the release a default install would have resolved at
  that moment. Pre-releases and yanked releases are excluded, since a default install skips them. A release
  can anchor several consecutive quarters. A quarter before the package's first release has no anchor,
  which means "did not exist yet", not a missing value.

Release dates come from: PyPI, the earliest `upload-time` among the release's files; npm, `time[v]`;
crates.io, `created_at`; RubyGems, the earliest `created_at` among platform builds; Go, `@v/{v}.info`
`Time`; Maven Central, the `.pom`'s `Last-Modified` header; Packagist, `time`.

Go's proxy and Maven's metadata list versions without dates, and each date costs one request. Anchors are
therefore found by binary search over the ordered version list (SemVer order for Go, deploy order for
Maven). This returns the exact anchor whenever publication order matches list order. A backport published
after a newer line (a `1.2.9` after `1.3.0`) can shift an anchor by one release.

## Signals

Each stored version is measured on seven signals. Each signal takes one of three values: `true`, `false` or
`unknown`. `unknown` means the registry's data does not settle the question. It is never converted to
`false`.

Two booleans (trusted publishing, provenance attestation) would be the obvious model, but they do not
survive contact with the registries. crates.io reports trusted publishing but has no attestation scheme.
PyPI reports attestations, from which trusted publishing can only be inferred. Maven Central mandates
GPG signing and has no OIDC equivalent. Go mandates transparency-log inclusion and has no publisher
accounts at all. Packagist has no signing mechanism of any kind. Two booleans would score Maven and Go
at zero, which is precisely backwards, so each mechanism gets its own signal:

| Signal | Meaning |
|---|---|
| Identity-bound publish | Published via OIDC / trusted publishing rather than a long-lived token |
| Publisher signature | Signed by the publisher or the publisher's CI: GPG, or Sigstore |
| Registry integrity | The registry itself vouches for the artifact's hash with a signature |
| SLSA provenance | An SLSA provenance statement, signed by the builder |
| Source link | The release is tied to a source commit by someone other than the uploader's own machine |
| Transparency log | Inclusion in a public append-only log |
| MFA enforced | MFA required for the account that published |

Two pairs need explaining, because they look alike and are not:

- **Publisher signature vs registry integrity.** A publisher signature says "the people who control this
  project produced these bytes". A registry signature says "these are the bytes the registry received".
  Both detect tampering *after* upload, for example by a mirror or a CDN. Only the first can detect an
  upload by someone who stole the publisher's token, because the registry signs that upload too. npm's
  `dist.signatures` and Go's checksum database are the same kind of guarantee, so they share one signal.
- **SLSA provenance vs source link.** SLSA provenance is a statement *by the build system*: "I built this
  artifact from commit X with workflow Y". The weaker source link only establishes which commit the release
  corresponds to. It counts when the commit comes from a party the uploader cannot simply contradict: the
  CI provider's certificate in a Sigstore signature (PyPI, RubyGems, Maven), the CI provider's signed OIDC
  token (crates.io trusted publishing), or the registry resolving the tag itself (Go proxy `Origin`,
  Packagist). Commits the uploader's own tools assert are not counted: npm `gitHead`, crates
  `.cargo_vcs_info.json`, RubyGems `source_code_uri`. Every SLSA statement is also a source link.

Separately, each ecosystem × signal pair has an **availability** class:

- **observable**: the registry reports it per release, and `false` is a real negative;
- **inferred**: derived indirectly. Usually only `true` is conclusive, so the reported share is a lower bound;
- **not exposed**: the mechanism exists, but the public API does not reveal who uses it;
- **no mechanism**: the ecosystem has no such feature. For MFA, this means there is no way to *require* it for
  a publish. Releases are recorded `false`, but no percentage is reported.

A *mandatory* flag marks signals required registry-wide by policy. The reason for each class is stored
with it (`signal_availability.notes`); [registries.md](registries.md) lists the endpoint and field behind
every signal.

### Detection rules

| Registry | Signal | Rule | Availability |
|---|---|---|---|
| PyPI | identity | PEP 740 `provenance` on any file ⇒ `true`, else `unknown` | inferred |
| PyPI | signature, tlog | `provenance` on any file of the release ⇒ `true`, else `false` | observable / inferred |
| PyPI | SLSA | provenance object of one attested file contains predicate `https://slsa.dev/provenance/v1` | observable |
| PyPI | source link | that provenance object's Fulcio certificate carries a source repository digest | observable |
| PyPI | MFA | release published on/after 2024-01-01 ⇒ `true` (2FA mandate), else `unknown` | inferred, mandatory |
| npm | identity | `_npmUser.trustedPublisher` present | observable |
| npm | signature, tlog | `dist.attestations` present (Sigstore, signed by the publisher's CI; Rekor) | observable / inferred |
| npm | registry integrity | `dist.signatures` present | observable, mandatory |
| npm | SLSA, source link | `dist.attestations.provenance.predicateType` is SLSA provenance | observable |
| npm | MFA | release on/after 2022-11-01 with more than 1M downloads in the week ending 15 days before it ⇒ `true`, else `unknown` | inferred |
| crates.io | identity | `trustpub_data` non-null | observable |
| crates.io | source link | `trustpub_data.sha` present | observable |
| RubyGems | identity | version page "Pushed by": trusted publisher ⇒ `true`, user (API key) ⇒ `false`, absent (pre-tracking) ⇒ `unknown`; an attestation also ⇒ `true` | inferred |
| RubyGems | signature | `/api/v1/attestations/{g}-{v}.json` non-empty ⇒ `true`, else `unknown` | inferred |
| RubyGems | SLSA | a bundle carries an in-toto statement with an SLSA predicate | observable |
| RubyGems | source link | a bundle's Fulcio certificate carries a source repository digest | observable |
| RubyGems | tlog | same endpoint non-empty ⇒ `true`, else `false` | observable |
| RubyGems | MFA | `metadata.rubygems_mfa_required == "true"` | observable |
| Go | registry integrity, tlog | `sum.golang.org/lookup/{m}@{v}` returns 200 | observable, mandatory |
| Go | source link | proxy `.info` `Origin.Hash` present ⇒ `true`, else `unknown` | inferred |
| Maven | signature | HEAD `{a}-{v}.pom.asc` or GET `.pom.sigstore.json` returns 200 | observable, mandatory |
| Maven | SLSA | HEAD `{a}-{v}.jar.build.slsa` returns 200 (slsa-github-generator naming) | observable |
| Maven | source link | Sigstore bundle certificate carries a source digest, or `.jar.build.slsa` present | observable |
| Maven | tlog | `.pom.sigstore.json` present | observable |
| Packagist | source link | `versions[v].source.reference` present | observable |

All remaining pairs are *no mechanism* or *not exposed*. They are listed with reasons in `signal_availability`
and in `src/facts/index.ts`.

**PyPI "any file" rule.** A release counts as attested when *any* of its files carries provenance. The
attestation is produced by the publishing workflow, so one attested file shows that the release went
through it. Releases that pair an attested sdist with wheels built elsewhere are common, and an "all
files" rule would score them as non-adopters. `evidence` records the attested/total file count, so the
stricter rule can be re-derived from the data. SLSA and source link are read from the provenance object
of the first attested file, because publishing workflows attest every file of a release the same way.

## Aggregation

Denominators are packages. A package contributes its latest version to the matrix and at most one anchor
to each quarter. The headline share is `true / n`, so `unknown` counts as not adopted. `true / (true +
false)` is reported alongside it as `pct_known`. Inferred cells with unknowns are marked "≥".

### Trust summary score

The seven signals are not independent measurements. Several are read from one mechanism, so they move
together:

| Registry | Signals read from one mechanism | Mechanism |
|---|---|---|
| npm | publisher signature, SLSA provenance, source link, transparency log | `dist.attestations`, which npm accepts only with an SLSA predicate: the four columns are identical |
| PyPI | identity-bound publish, publisher signature, transparency log | a PEP 740 attestation on any file of the release |
| RubyGems | publisher signature, transparency log | a non-empty attestation list |
| Go | registry integrity, transparency log | the sum.golang.org lookup |

Averaging the seven signals would count one fact up to four times, and would favour registries whose one
mechanism happens to answer several questions. The matrix still reports every signal on its own (with this
table as a note). The score instead groups the signals into three categories, each asking one question:

| Category | Question | Strong level (1) | Weak level (½) |
|---|---|---|---|
| Publisher authentication | Did the upload take more than a stored secret? | Identity-bound publish | MFA enforced |
| Artifact authenticity | Can a consumer check that the bytes are the publisher's? | Publisher signature | Registry integrity |
| Source provenance | Can a consumer tie the artifact to its source? | SLSA provenance | Source link |

For each category, a release scores its strongest signal: 1 for the strong level, ½ if it has only the
weak one, 0 if it has neither. Within a category, the order follows from what each signal can detect:

- **Publisher signature over registry integrity**: only a publisher signature detects an upload made with
  a stolen token, because the registry signs that upload too (see *Signals* above).
- **SLSA provenance over source link**: SLSA provenance is the builder's signed statement about how the artifact was built. It names the
  workflow and builder as well as the commit. A source link names only the commit.
- **Identity-bound publish over enforced MFA**: identity-bound publishing leaves no publish secret to
  steal and names the workflow that published. Enforced MFA makes the account harder to take over, but
  does not bind the upload to a build.

**The value ½ is a convention, not a measurement.** It says only that the weak level is worth something
and less than the strong one. It is a constant (`CATEGORIES` in `src/stages/aggregate.ts`), so other values
can be reported as a sensitivity check. On the pilot snapshot, with ¼ or ¾ instead of ½, PyPI stays first
and crates.io and Packagist stay last, but npm, Maven Central, Go and RubyGems change places. Their order
should not be read off the score. The three categories weigh equally, because ranking them against each other
would need a threat model this study does not make.

Transparency log is in no category. Every Sigstore signature is logged, so scoring the log separately would
count the signature twice. Go's checksum database still counts, as registry integrity: both signals are read
from the same lookup.

Each platform gets two numbers, never one, because "the platform offers it" and "packages use it" are
different findings:

- **Capability**: per category, the strongest level the platform offers at all (any availability other
  than *no mechanism*), summed over the three categories (reported as points out of 3). **Auditable** counts
  only levels whose adoption the public API reveals.
- **Assurance**: for each sampled package, the share of the three points its release has. This is averaged
  over packages and reported as a range. The low end counts `unknown` as absent; the high end counts it as
  present. A *not exposed* signal therefore widens the range instead of being guessed. The same score is
  computed for every quarter anchor, and per category (`scores.csv`).

### Registry baseline

The trust score measures whether an outsider can verify who published a release and from what source.
It says nothing about the protections most ecosystems rely on day to day, and on those a low scorer can
be strong: crates.io scores near the bottom, but it pins and checks hashes, never changes a published version, and
offers scoped, expiring tokens. A separate, curated table therefore records, per ecosystem, what the
*default toolchain* does:

| Property | Question |
|---|---|
| Immutable versions | Once published, can a version's files never be replaced or added to? |
| Install checks hash | Does the default client check each download against the registry's hash? |
| Lockfile pins hashes | Does the default lockfile record artifact hashes? |
| Client checks signature | Does the default client check a signature or transparency log, so a compromised registry or mirror is detected? |
| Scoped, expiring tokens | Can publish credentials be limited to specific packages and made to expire? |
| No code at install | Does installing or building leave dependency code unexecuted by default? |

Each cell is `yes`, `partial`, `no` or `n/a`, with a note and primary sources (`src/facts/baseline.ts`;
`baseline.md` in each report). The table is not part of the score: it describes ecosystem defaults, not
the sampled packages, and several cells depend on which client a user runs. Several values changed in
2025–26: npm 12 stopped running install scripts (2026-07), PyPI stopped accepting new files on old
releases (2026-07), Packagist made stable versions immutable (2026-07), and npm limited write tokens to 90
days (2025-11). The backfill quarters predate these changes, so the table describes the snapshot date only.
The table is also drawn as `charts/baseline.svg`.

### Sigstore

Four of the seven registries accept Sigstore bundles: npm (2023), PyPI (2024), RubyGems (2024) and Maven
Central (2025). Each verifies the bundle at upload. No install client checks bundles by default, newer
ones included: uv uploads attestations but does not verify them, pnpm's opt-in `trustPolicy: no-downgrade`
compares the packument's trusted-publisher/provenance fields without verifying them, Yarn only generates
provenance, Bun ignores attestations, and Gradle's opt-in dependency verification knows PGP but not
Sigstore. The only check is npm's opt-in `npm audit signatures`. The bundles are already measured per
release, as a publisher signature and a transparency-log entry. A separate curated table (`src/facts/sigstore.ts`; `sigstore.md` in each report) records the
registry-level facts and, for the other three, the nearest equivalent: Go's own checksum transparency log,
nothing on crates.io (the Cargo Sigstore RFC was closed in 2023), and a stated plan on Packagist.
`charts/sigstore.svg` draws the table alongside the share of sampled latest releases carrying a bundle.

### Governance, containment and withdrawals

A fourth curated table (`src/facts/policies.ts`; `policies.md` and `charts/policies.svg`) covers what
keeps malicious packages out and what happens after a bad release. Governance: owned namespaces,
blocking of confusable names, malware analysis of uploads. Containment: yanking that keeps lockfiles
working, restrictions on author deletion, and whether the default client acts on advisories. Name rules
are read from the registries' code (PyPI `ultranormalize_name`, RubyGems `GemTypo`, crates.io
`canon_crate_name` and its typosquat job, Packagist `TypoSquattersValidator`).

How often the containment tools are used is measured: per package, the versions yanked (PyPI, crates.io),
unpublished or deprecated (npm; unpublished versions keep their entry in the packument's `time` map), or
retracted (Go, from the latest `go.mod`), among versions published since the first quarter boundary
(2024-04-01; crates.io's version walk is complete only from there). Go's retractions are undated and
counted over all time. RubyGems hides yanked versions from every API, Maven allows no withdrawal, and
Packagist's soft-deleted versions are not public, so those three have no counts. Stored in
`package_withdrawals`; reported in the summary, `withdrawals.csv` and `charts/withdrawals.svg`.

### Known advisories

Each package's versions are looked up in OSV, which aggregates the GitHub Advisory Database, the
ecosystems' own databases (PYSEC, RUSTSEC, GO) and the OpenSSF malicious-packages reports (MAL) under one
schema. One `querybatch` per package asks about every stored version (latest and quarter anchors) and
every withdrawn version (yanked, unpublished, deprecated, retracted). It is sent during `fetch`, after the
registry's responses are cached, and replayed from the cache by `extract`. A package OSV was not asked about
has `packages.osv_queried_at` null and is left out of every advisory denominator, so "no advisory" is never
confused with "not checked". Matches are stored in `advisory_matches`, the records in `advisories`.

Databases list one vulnerability under their own ids and cross-reference them as `aliases`. Records sharing
an id, directly or through other records, form one *vulnerability* (alias group), counted once. It counts
as known from the earliest `published` time among its records, and is named by that record. Withdrawn
records are left out. GHSA's `github_reviewed_at` is the *latest* review, and GitHub asks consumers not to
rely on its `database_specific` fields, so neither it nor `nvd_published_at` is used; the NVD API is not
queried either. A vulnerability is a *malware report* when one of its ids is a MAL id.

Reported per ecosystem (`advisories.md`, `advisories.csv`, `charts/advisories.svg`):

- **Exposure**: the share of latest releases with a vulnerability published by the snapshot instant.
- **Known then and now**: for each quarter anchor, whether a vulnerability had been published by the
  quarter's end (what a default install resolved while it was already known) and whether one has been
  published by the snapshot (what it resolved before anyone knew).
- **Malware reports**: every sampled or withdrawn release with one, with its release time, the report's
  first publication and the hours between, and how the registry withdrew it. Release times of withdrawn
  versions come from the same fields as the other release dates; Go's retractions are undated.
- **Database lag**: per database, how many of the vulnerabilities affecting sampled versions it lists, how
  many it published first, and the median days it trailed the first publication on the others.

Every stored version also carries its package URL (`package_versions.purl`, built with packageurl-js), and
`sbom.cdx.json` is a CycloneDX 1.6 SBOM of the sample: the latest version of every package as a component
named by its purl, and the vulnerabilities published by the snapshot that affect them. The purl type for Go
says to lowercase module paths, but module paths are case-sensitive; packageurl-js keeps the case, and so
does this dataset. No sampled Go module has a mixed-case path.

OSV is queried when `fetch` runs, which can be later than the snapshot instant. Matches therefore reflect
the records as they were then; only the "known by" times are cut at the snapshot. A record changed later
(a corrected range, a new alias) can change past numbers on a re-fetch. The matching rests on OSV's own
version ranges for each ecosystem, which this project does not re-check.

### Publish authentication

The identity signal also answers the reverse question, how releases *not* published through trusted
publishing were authenticated: `false` means an account credential, `unknown` either. This is a real
negative on npm (`_npmUser.trustedPublisher` absent), crates.io (`trustpub_data` null; publishing otherwise
needs an API token) and RubyGems (the version page names a user, whose API key pushed it). Maven has no
OIDC path, so every upload uses a Portal token. PyPI shows trusted publishing only through attestations;
its per-file "Uploaded using Trusted Publishing?" field sits behind a bot challenge and is not read, so
credential uploads stay `unknown`. No registry shows whether a credential was long-lived. Go and Packagist
have no upload. Reported as `charts/publish-auth.svg` and in the summary.

### Post-quantum exposure

A third curated table (`src/facts/pqc.ts`; `pqc.md` and `charts/pqc.svg` in each report) asks what a
cryptographically relevant quantum computer would break. It covers the whole chain: install hash, publisher
signature, registry signature, transparency log, TLS, publish credential and MFA. Each cell names the
primitive and is classed as post-quantum safe (hash of at least 256 bits, symmetric secret), partly safe
(a hash-chained log with classical checkpoint signatures; hybrid TLS with classical certificates; TOTP
next to WebAuthn), quantum-vulnerable (RSA, ECDSA, EdDSA) or weak already (SHA-1, MD5). TLS cells are
measured with `scripts/probe-pq-tls.ts`, whose output is archived as a source (`probePqTls`); signature
algorithms are read from the registries' published keys, Sigstore's trusted root and the sampled Maven
`.asc` files.

Every signature in every ecosystem is classical, Sigstore included. What is already safe is hashing:
install hashes everywhere except Maven and Packagist, and the Merkle trees under Rekor and sum.golang.org.

### Curated facts and their sources

The four curated tables, the advisory method notes, the availability classes and the registry policy facts (`src/facts/`) are
judgements about mechanisms, not measurements, so each value carries its evidence: the id of a source in
[`src/sources/registry.ts`](../src/sources/registry.ts) and the passage quoted from it. `bun run sources`
archives every source under `sources/` (readable text, the access time and the sha256 of the original
response), and `bun test` fails if a quote is not found in its archived copy. Where code is the best
evidence (name-similarity rules, checksum checks, Bundler's and Cargo's verification), the source is the
file in the registry's or client's repository. Claims that something does *not* exist (PEP 458 is not
deployed, a token type never expires) cite the closest primary source; an absence cannot be quoted. The
"verified" date on each table is the newest access date among its sources. All sources are listed with
their access dates in [sources.md](sources.md).

## Reproducibility

Every raw response is stored gzipped (git-ignored). Its URL, sha256, size, HTTP status and fetch time are
appended to the committed `data/cache/manifest.jsonl`. Every signal row names its rule, the endpoint and
field it is read from (`signal_source`, the same for every release), and the URL and sha256 of each cached
response this release's value was actually read from (`version_signals.responses`; `response_urls` and
`response_sha256s` in `signals.csv`). A value can rest on several responses, for example Maven's `.asc` and
`.sigstore.json`, and on none when it follows from a policy or from the absence of a mechanism.
`extract` reads only from the cache and makes exactly the requests `fetch` made, so the dataset can be
rebuilt offline from the cached payloads. The sources of the curated facts are archived and committed
(see above).

## Limitations

1. **Inferred lower bounds.** PyPI and RubyGems identity, and RubyGems signatures, can only be confirmed, never refuted.
   Their shares are lower bounds.
2. **Registry-applied npm signatures.** npm signs every tarball on serve, including 2016-era tarballs. The 100%
   reflects registry behaviour, not publisher choice.
3. **Go and Packagist source links** are the registry's own record of the commit it resolved, not a
   signature. Go's is missing for versions the proxy cached before it began recording `Origin`, hence
   `unknown`. Packagist scores 100% by construction, because its releases *are* VCS tags.
4. **PyPI and npm MFA are policy-derived**, not observed per account. PyPI's is `true` for every release
   after its all-accounts mandate. npm requires 2FA only for maintainers of high-impact packages (more than
   1M weekly downloads or 500 dependents, from 2022-11-01). A release counts when npm's downloads API shows
   the package above 1M in the week ending 15 days before it, which is npm's notice period, so the package
   was already high-impact when it was published. Packages that qualify by dependents alone, the 2022
   top-100/top-500 cohorts and 2FA by choice all stay `unknown`, so npm's share is a lower bound (≥).
5. **RubyGems MFA is per-gem opt-in.** Owners of gems above 180M downloads must use MFA regardless (since
   2022-08-15). This rule does not capture that, so the share understates enforced MFA among the most
   popular gems. Unlike npm's, the rule cannot be applied per release: RubyGems publishes only all-time
   download totals, so when a gem crossed 180M is not known.
6. **Maven dates** are `Last-Modified` headers on repo1.maven.org. They match deploy dates where checked
   (Guava 33.4.8: 2025-04-14 in both). A re-deployed file would carry a later date.
7. **Backfill reflects present-day metadata.** A release's signals are read as the registry reports them
   now. Retroactive changes, such as npm signing tarballs that predate registry signing, show up in early
   quarters.
8. **Mandates are not retroactive.** "Mandatory" describes current policy. Releases from before a mandate
   can lack the signal: in the pilot, `javax.servlet:servlet-api` 2.5 (2006) has no `.asc` on Maven Central,
   and Go modules last released before the proxy recorded `Origin` have an unknown source link.
9. **Levels are coarse.** A level says which kind of signal a release has, not how strong that instance is.
   A Sigstore signature from CI and a GPG signature made on a developer's machine both score 1 for artifact
   authenticity. Go's logged checksum database and npm's registry signature both score ½. The ½ itself is a
   convention (see *Trust summary score*). The matrix, not the score, shows which signal each platform has.
10. **Advisory coverage differs by ecosystem.** OSV counts only what its source databases record, and which
    databases cover an ecosystem differs (the database table in `advisories.md` shows it per snapshot). A
    lower share of affected releases is not by itself evidence of fewer vulnerabilities.
