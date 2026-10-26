# Registry reference

What each registry exposes, which endpoint and field every signal is read from, and the API behaviour the
adapters depend on. This describes the current code; the reasons behind each availability class are also
stored with the data (`signal_availability.notes`, from [`src/facts/index.ts`](../src/facts/index.ts)).
Policy claims (dates, mandates, defaults) are cited in the facts files and listed in [sources.md](sources.md).

All registry endpoints are public and read without authentication. Every request carries the project's
User-Agent; crates.io answers requests without a descriptive one with HTTP 403. The one exception is deps.dev's
BigQuery dataset (name lists for npm and Maven Central, and the whole-registry layer), which needs a Google
account; see [deps.dev](#depsdev-name-lists-and-whole-registry-all-registries).

## Cross-registry findings

These shaped the signal model ([methodology](methodology.md#signals)):

- **No registry exposes both trusted publishing and attestations directly.** crates.io reports trusted
  publishing (`trustpub_data`) but has no attestation scheme. PyPI and RubyGems report attestations, from
  which trusted publishing is inferred. npm is the exception that reports both. One "trusted publishing"
  boolean is therefore not comparable across registries.
- **Equivalent mechanisms land in one signal each.** npm's `dist.signatures` and Go's checksum database are
  both registry-applied integrity statements (`registry_integrity`). A commit recorded by someone other than
  the uploader (a Fulcio certificate's source digest, crates.io `trustpub_data.sha`, Go `Origin`, Packagist
  `source.reference`) is a `source_link`. Only SLSA statements are `build_provenance`.
- **One attestation drives several columns.** On PyPI and RubyGems a Sigstore bundle is a publisher
  signature, a source link and a transparency-log entry, so those columns are not independent.
- **Version order differs by API.** PyPI's Simple API and npm's `time` map run oldest first, RubyGems'
  `/versions` newest first, Go's `@v/list` is unordered. Each adapter sorts explicitly.
- **Whether a maintainer has 2FA enabled is public nowhere.** Checked: npm packument and collaborators
  endpoint, RubyGems owners and profiles, crates.io users and owners, Packagist user pages and package JSON,
  Maven Central namespace pages. PyPI mandates 2FA for every account; Go has no accounts.

## Sampling

### Top sample

| Registry | Ranking source | Frame |
|---|---|---|
| PyPI | `hugovk/top-pypi-packages` `top-pypi-packages.json` (`{project, download_count}`) | downloads, 30 days |
| npm | ecosyste.ms seed, re-counted with `api.npmjs.org/downloads/point/last-month/{names}` | downloads, last month |
| crates.io | `/api/v1/crates?sort=recent-downloads` | downloads, 90 days |
| RubyGems | ecosyste.ms `rubygems.org?sort=downloads` | downloads, all time |
| Go | ecosyste.ms `proxy.golang.org?sort=dependent_packages_count` | dependents |
| Maven Central | ecosyste.ms `repo1.maven.org?sort=dependent_packages_count` | dependents |
| Packagist | `/explore/popular.json` (paginated via `next`) | Packagist's own order |

Go and Maven Central publish no download counts (ecosyste.ms reports `downloads: null` for both), hence the
dependents frame. npm's bulk downloads endpoint rejects scoped names, which need one request each, and its
downloads API answers 5 requests per second with HTTP 429, so it is paced at one per second. Packagist's popular list is not ordered by the
all-time `downloads` it reports.

### Random sample

Where each draw gets every package name, and how it decides that a package is active (a release in the 36
months before the snapshot; [methodology](methodology.md#random-sample)). Inputs are stored per snapshot under
`data/names/{snapshot}/` with their sha256, and reused when a draw is restarted.

| Registry | Name list | Activity check |
|---|---|---|
| PyPI | `GET /simple/` (PEP 691 JSON, 45 MB): `projects[].name` | the project's Simple API page (the adapter's first request): newest release, dated by its earliest file |
| npm | deps.dev BigQuery `PackageVersions`, `System = 'NPM'` | the packument (the adapter's request): `time` of versions still in `versions` |
| crates.io | `static.crates.io/db-dump.tar.gz` (daily, 2 GB): `crates.csv` | from the dump: newest `versions.csv` `created_at` |
| RubyGems | weekly PostgreSQL dump (680 MB), the newest taken before the snapshot: `rubygems` | from the dump: newest `versions.created_at` |
| Go | `index.golang.org/index?since=…`, paged 2,000 at a time over the window | from the index: newest non-pseudo version's `Timestamp` |
| Maven Central | deps.dev BigQuery `PackageVersions`, `System = 'MAVEN'` | `maven-metadata.xml` (the adapter's request): `<lastUpdated>` |
| Packagist | `GET /packages/list.json`: `packageNames` | `repo.packagist.org/p2/{p}.json`: `time` of tagged releases |

- **npm and Maven names come from deps.dev.** npm's own complete list is its replication feed
  (`replicate.npmjs.com/registry/_changes`, 4.5M live documents in October 2026, paged through every change
  ever made, deleted packages included), Maven Central's a 3.3 GB binary index
  (`.index/nexus-maven-repository-index.gz`). deps.dev's npm list is 12.6M names, too many to
  download page by page, so BigQuery orders it by `FARM_FINGERPRINT(seed:name)` and the draw reads 5,000
  names at a time. deps.dev also lists strings npm never accepted as names (paths of bundled dependencies,
  `ember-cli>1.13.9>chalk>ansi-styles`); `validate-npm-package-name` rejects them as no package.
- **Go is crawled over the window only.** A module without a version cached in the window is inactive, so
  the earlier index is not needed. The window still holds tens of millions of entries (about 5 million in the
  first six months of a 2026 window). Pages follow one another by `since`, so one cursor is latency-bound;
  the window is split into months, crawled four at a time, and each month resumes from its own cursor.
- **Dumps are parsed once.** The newest-release map read from a dump is stored beside it, keyed by the dump's
  sha256.
- **Releases after the snapshot instant do not count.** Lists are read after the snapshot; only releases at or
  before it decide activity.
- **p2 returns an empty list, not 404,** for a package without tagged releases.

## PyPI

| Signal | Source |
|---|---|
| versions, dates | Simple API `GET /simple/{p}/` with `Accept: application/vnd.pypi.simple.v1+json`: every file of every release, `upload-time`, `yanked`, `provenance` |
| latest | `GET /pypi/{p}/json` → `info.version` |
| signature, tlog, identity | `files[].provenance` non-null on any file of the release |
| SLSA, source link | the provenance object of the first attested file: predicate type, Fulcio certificate source digest |

- **Attestations imply trusted publishing.** PyPI issues PEP 740 attestations only for Trusted Publisher
  uploads, so `provenance` ⇒ `identity_publish = true`. Trusted publishing need not emit attestations, so
  its absence is `unknown`.
- **Most attestations are the publish predicate, not SLSA.** In the top-50 pilot none was SLSA.
- **No maintainer list.** The JSON API has only free-text `author_email` / `maintainer_email`;
  `maintainer_count` is stored as NULL with source `unavailable` rather than parsed into a guess.
- **"Uploaded using Trusted Publishing?"** appears on the file page but in no API, and the HTML answers
  bots with a JavaScript challenge, so it is not read. Credential uploads therefore stay `unknown`.
- **Yanked files:** `files[].yanked`.

## npm

| Signal | Source |
|---|---|
| versions, dates | full packument `GET /{p}`: `versions`, `time` |
| identity | `versions[v]._npmUser.trustedPublisher = {id, oidcConfigId}` |
| signature, tlog | `versions[v].dist.attestations` |
| SLSA, source link | `dist.attestations.provenance.predicateType` |
| registry integrity | `versions[v].dist.signatures` |
| MFA | weekly downloads before the release: `api.npmjs.org/downloads/point/{start}:{end}/{p}` |

- **The abbreviated packument is unusable**: it keeps `dist.attestations` but drops `time` and
  `maintainers`, so the full form (several MB for large packages) is fetched.
- **`dist.signatures` is on every version**, including 2016 tarballs: npm signs on serve, so it measures
  registry behaviour, not publisher choice.
- **Trusted publishing is observable**, so its absence is a real negative (a token or login session).
- **Withdrawals:** unpublished versions keep their entry in `time` but leave `versions`;
  `versions[v].deprecated` marks deprecation.
- **MFA rule:** the per-package "require 2FA" setting is write-only and not in the packument, so MFA is
  inferred from the high-impact threshold (methodology, limitation 4).

## crates.io

| Signal | Source |
|---|---|
| versions, dates | `GET /api/v1/crates/{c}/versions?sort=date` (seek-paginated via `meta.next_page`) |
| latest | `GET /api/v1/crates/{c}?include=default_version` |
| identity | `versions[].trustpub_data = {provider, repository, run_id, sha}` |
| source link | `trustpub_data.sha` |
| owners | `/api/v1/crates/{c}/owners` (`kind: "user"` and `"team"`) |

- **No MFA of its own.** Login is GitHub OAuth, which does not reveal whether 2FA was used, and publishing
  uses API tokens, so `mfa_enforced` is no mechanism. A per-crate `trustpub_only` flag can forbid token
  publishing; only its current value is visible.
- **No signing.** `.cargo_vcs_info.json` is asserted by the uploader's machine and is not counted.
- **Withdrawals:** `versions[].yanked`. The version walk stops at the first stable release older than the
  first quarter boundary, so withdrawals are counted from there.

## RubyGems

| Signal | Source |
|---|---|
| versions, dates | `GET /api/v1/versions/{g}.json` (newest first; one entry per platform build) |
| MFA | `metadata.rubygems_mfa_required` per version |
| signature, SLSA, source link, tlog | `GET /api/v1/attestations/{g}-{v}.json` (`[]` when none) |
| identity | version page `/gems/{g}/versions/{v}`, "Pushed by" |

- **Trusted publishing has no field in any JSON endpoint**, not even on Ruby Central's own
  `trusted_publishing_test` gem. The version page names the pusher: a trusted publisher (rendered with the
  GitHub icon) ⇒ `true`, a user, i.e. that user's API key ⇒ `false`. Versions pushed before rubygems.org
  recorded pushers show none (`rails` 4.0.0) and stay `unknown`. The page is allowed by robots.txt.
- **Attestations imply trusted publishing**: rubygems.org rejects an attestation unless the push used a
  trusted-publisher token (`Pusher#verify_sigstore`). The bundles seen so far are message signatures, not
  in-toto statements.
- **Legacy `gem cert` signatures** are not exposed, so an empty attestation list is `unknown` for the
  publisher signature.
- **Yanked versions vanish** from `/api/v1/versions` and 404 on the v2 endpoint, so yanks cannot be counted.
- **The 180M-download MFA rule** cannot be dated per gem: only all-time totals are published.

## Go

| Signal | Source |
|---|---|
| versions | `GET proxy.golang.org/{m}/@v/list` (unordered, undated) |
| dates, source link | `GET /{m}/@v/{v}.info`: `Time`, `Origin {VCS, URL, Ref, Hash}` |
| latest | `GET /{m}/@latest` |
| registry integrity, tlog | `GET sum.golang.org/lookup/{m}@{v}` → 200 (404 for an unknown version) |
| withdrawals | `retract` directives in the latest `GET /{m}/@v/{v}.mod` |

- Module paths are escaped for the proxy (`!` before upper-case letters).
- `Origin` is missing for versions the proxy cached before it recorded it, hence `unknown`.
- Retractions carry no date, so they are counted over each module's whole history.
- No publisher accounts: identity and MFA are no mechanism.

## Maven Central

| Signal | Source |
|---|---|
| versions | `repo1.maven.org/.../maven-metadata.xml` (deploy order, undated) |
| dates | `HEAD {a}-{v}.pom` → `Last-Modified` |
| signature | `HEAD {a}-{v}.pom.asc` or `GET .pom.sigstore.json` → 200 |
| tlog, source link | `.pom.sigstore.json` (Fulcio certificate source digest) |
| SLSA | `HEAD {a}-{v}.jar.build.slsa` → 200 (slsa-github-generator naming) |

- **`search.maven.org` is not used.** In October 2026 its newest Guava release lagged `maven-metadata.xml`
  by a year and some queries returned non-JSON. Its `ec[]` file list also omits `.asc` signatures, so
  signatures are confirmed with a HEAD instead.
- The `.pom` is probed rather than the `.jar` because every artifact has one, including BOMs.
- `<release>` can name a pre-release (`slf4j-api` → `2.1.0-alpha1`); the newest stable entry is used.
- Publishing authenticates with Portal user tokens only: identity and MFA are no mechanism.
- Nothing can be withdrawn.

## Packagist

| Signal | Source |
|---|---|
| versions, dates, owners | `GET packagist.org/packages/{v}/{p}.json`: `versions`, `time`, `maintainers` |
| source link | `versions[v].source.reference` (the commit the tag resolved to) |

- Version objects carry no signature field: identity, signature, provenance, registry integrity and MFA
  are no mechanism.
- The security-event log at `/transparency-log` requires a login and records account and reference events,
  not artifacts, so it is not counted as a transparency log.
- Forge-hosted archives have an empty `dist.shasum`; the commit in the archive URL is the only pin.
- Soft-deleted versions are not in the public JSON, so withdrawals cannot be counted.

## OSV (advisories, all registries)

OSV is not a registry, but every package's versions are looked up there ([methodology](methodology.md#known-advisories)).

| Data | Source |
|---|---|
| matches | `POST api.osv.dev/v1/querybatch`, one query per version: `{package: {ecosystem, name}, version}` |
| records | `GET api.osv.dev/v1/vulns/{id}`: `aliases`, `published`, `modified`, `withdrawn`, `summary` |

- OSV's ecosystem names are `PyPI`, `npm`, `crates.io`, `RubyGems`, `Go`, `Maven` and `Packagist`; package
  names are the ones the registries use (Maven `group:artifact`, Go module paths).
- Versions are sent as the registry spells them. OSV accepts Go's and Packagist's `v` prefix (`v0.17.0` and
  `0.17.0` match the same records) and PyPI names in any case.
- `querybatch` returns ids only, and pages a query past about 1,000 results (3,000 per batch) with
  `next_page_token`; only the queries that returned a token are asked again.
- A POST is cached under `POST {url} {sha256 of the body}`, and the manifest keeps the body
  (`requestBody`), so each query can be replayed.
- `database_specific` fields on GHSA records (`github_reviewed_at`, `nvd_published_at`, `severity`) are not
  read: GitHub documents them as internal and subject to change.

## deps.dev (name lists and whole registry, all registries)

deps.dev is not a registry either. Its BigQuery dataset (`bigquery-public-data.deps_dev_v1`) supplies the npm
and Maven name lists and the whole-registry layer ([methodology](methodology.md#whole-registry-layer)); its
per-version API backs the agreement check (`scripts/check-depsdev.ts`).

| Data | Source |
|---|---|
| snapshot | `Snapshots.Time`: the newest at or before the census snapshot (weekly, since May 2022) |
| names | `PackageVersions.Name`, one partition (`SnapshotAt`), one `System` |
| attestations | `PackageVersions.Attestations[]`: `Type`, `URL`, `Verified`, `SourceRepository`, `Commit`; releases only (`VersionInfo.IsRelease`), dated by `UpstreamPublishedAt` |
| per version | `GET api.deps.dev/v3/systems/{system}/packages/{name}/versions/{version}` → `attestations[]` |

- `PackageVersions` is partitioned by day on `SnapshotAt` and clustered on `System`, `Name`. A query filtered
  to one snapshot scans 1–7 GB; the `…Latest` views are not pruned and would scan hundreds of GB. Dry runs of
  partition-filtered queries can report an upper bound of 0 bytes (the name lists did; the attestation query
  estimated 7.5 GB and processed 6.1), so every query also runs with `maximumBytesBilled`.
- Snapshot times carry microseconds; `SnapshotAt` matches a snapshot only with all six digits.
- `Attestations` covers npm, PyPI and RubyGems; it holds none for any Maven Central package (October 2026). No
  column carries crates.io trusted publishing or Go's checksum database, and Packagist is not in deps.dev.
- `SLSAProvenance` is filled for npm only; `Attestations` includes the same SLSA statements.
- RubyGems attestations carry an empty `Type`.
