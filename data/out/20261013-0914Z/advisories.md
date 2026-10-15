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

#### Method and sources

- **Matching**: OSV is asked once per package about every version the dataset stores and every version the registry withdrew. The batch endpoint answers with ids only, so each record is then read on its own. [1](https://google.github.io/osv.dev/post-v1-querybatch/ "“Returns vulnerability ids and modified field only.” (accessed 2026-10-15)")
- **One vulnerability, several records**: Databases list the same vulnerability under their own ids (GHSA, PYSEC, RUSTSEC, GO) and cross-reference them as aliases. Records sharing an id, directly or through other records, are counted as one vulnerability. [1](https://ossf.github.io/osv-schema/ "“The aliases field gives a list of IDs of the same vulnerability in other databases” … “Aliases should be considered symmetric (if A is an alias of B, then B is an alias of A) and transitive (If A aliases B and B aliases C, then A aliases C).” (accessed 2026-10-15)")
- **Timing**: A vulnerability counts as known from the earliest `published` time among its records. Withdrawn records are left out. [1](https://ossf.github.io/osv-schema/ "“The published field gives the time the entry should be considered to have been published” … “The withdrawn field gives the time the entry should be considered to have been withdrawn” (accessed 2026-10-15)")
- **GitHub review and NVD dates are not used**: GHSA records also carry `github_reviewed_at` and `nvd_published_at` under `database_specific`. The first is the latest review, not the first, and GitHub asks consumers not to rely on these fields, so neither is read. [1](https://github.com/github/advisory-database/blob/main/README.md "“The timestamp of the last review by a GitHub Security Curator.” … “Consuming systems should not rely on them for processing vulnerability information.” (accessed 2026-10-15)")
- **Malicious packages**: A record is a malware report when its id, or an alias, is from the OpenSSF malicious-packages repository (MAL-…). [1](https://ossf.github.io/osv-schema/ "“MAL Malicious Packages Repository” (accessed 2026-10-15)")
- **Package URLs**: Every stored version carries its package URL (packageurl-js). For Go the case of the module path is kept: the purl type says to lowercase it, but module paths are case-sensitive. No sampled module has a mixed-case path. [1](https://github.com/package-url/purl-spec/blob/main/README.md "“PURL is used as a standard identifier for software components in: - A CycloneDX or SPDX SBOM” (accessed 2026-10-15)") [2](https://github.com/package-url/purl-spec/blob/main/types/golang-definition.json "“The namespace shall be lowercased.” (accessed 2026-10-15)")
- **SBOM**: `sbom.cdx.json` lists the latest version of every sampled package as a CycloneDX component, named by its purl, and the vulnerabilities OSV knows for them, each pointing at the components it affects. [1](https://cyclonedx.org/capabilities/vdr/ "“CycloneDX enables precise and systematic reporting of vulnerabilities affecting both third-party and first-party components within a system.” (accessed 2026-10-15)")
