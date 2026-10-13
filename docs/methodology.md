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

Each stored version is scored on seven signals. Each signal takes one of three values: `true`, `false` or
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

A *mandatory* flag marks signals required registry-wide by policy. Every no-mechanism and not-exposed cell
was re-checked against primary sources on 2026-10-13 (docs/preflight.md §9).

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

Each platform gets two numbers, never one, because "the platform offers it" and "packages use it" are
different findings:

- **Capability**: how many of the seven properties the platform offers at all (any availability other than
  *no mechanism*). **Auditable** is the subset whose adoption the public API reveals.
- **Assurance**: for each sampled package, the share of the seven properties its release has. This is
  averaged over packages and reported as a range. The low end counts `unknown` as absent; the high end
  counts it as present. A *not exposed* property therefore widens the range instead of being guessed. The
  same score is computed for every quarter anchor.

All seven properties weigh equally. Each is a distinct thing a consumer could check, and ranking them
against each other would need a threat model this study does not make. One mechanism can earn several
properties: a Sigstore attestation is a publisher signature, a source link and a transparency-log entry.
That is counted, because the consumer does get all three. Weights are a single constant (`WEIGHTS` in
`src/stages/aggregate.ts`), so a threat-weighted variant can be reported as a sensitivity check.

### Registry baseline

The trust score measures whether an outsider can verify who published a release and from what source.
It says nothing about the protections most ecosystems rely on day to day, and on those a low scorer can
be strong: crates.io scores 6% but pins and checks hashes, never changes a published version, and
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

## Reproducibility

Every raw response is stored gzipped (git-ignored). Its URL, sha256, size, HTTP status and fetch time are
appended to the committed `data/cache/manifest.jsonl`. Every stored version references the sha256 of the
response its signals were read from, and every signal row names its endpoint and field (`signal_source`).
`extract` reads only from the cache and makes exactly the requests `fetch` made, so the dataset can be
rebuilt offline from the cached payloads.

## Limitations

1. **Inferred lower bounds.** PyPI identity and RubyGems signatures can only be confirmed, never refuted.
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
9. **Equal weights flatten different strengths.** Packagist's tag-derived source link and Maven's mandatory
   GPG signature each earn one of seven points, so both platforms score 14%. The matrix, not the score,
   shows which property each one has.
