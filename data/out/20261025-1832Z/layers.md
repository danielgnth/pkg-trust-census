# Top and random samples — snapshot 20261025-1832Z

The top sample answers what the most-used packages do; the random sample, drawn uniformly from each registry's
*active* packages (a release in the 36 months before the snapshot), what a typical active package does. Both are
measured by the same pipeline, so their shares compare directly. Brackets are 95% Wilson intervals. With
7 registries × 7 signals × 2 samples, no per-cell significance test is made: where the intervals do not overlap,
the difference is larger than sampling error. `≥` marks an inferred share, a lower bound an interval cannot repair.

Full reports: [top sample](README.md) · [random sample](random/README.md).

## Latest release, per signal

| Signal | Platform | Top | Random |
|---|---|---:|---:|
| Identity-bound publish | PyPI | ≥ 44% [40–49%] (n=500) | ≥ 21% [19–24%] (n=988) |
| Identity-bound publish | npm | 34% [30–38%] (n=500) | 11% [9–13%] (n=1000) |
| Identity-bound publish | crates.io | 16% [13–19%] (n=500) | 7% [6–9%] (n=1000) |
| Identity-bound publish | RubyGems | ≥ 22% [19–26%] (n=500) | ≥ 12% [10–14%] (n=1000) |
| Publisher signature | PyPI | 44% [40–49%] (n=500) | 21% [19–24%] (n=988) |
| Publisher signature | npm | 34% [30–38%] (n=500) | 12% [10–14%] (n=1000) |
| Publisher signature | RubyGems | ≥ 16% [13–19%] (n=500) | ≥ 6% [4–7%] (n=1000) |
| Publisher signature | Maven Central | 95% [93–97%] (n=500) | 99% [99–100%] (n=1000) |
| Registry integrity | npm | 100% [99–100%] (n=500) | 100% [100–100%] (n=1000) |
| Registry integrity | Go | 100% [99–100%] (n=500) | 100% [100–100%] (n=999) |
| SLSA provenance | PyPI | 0% [0–1%] (n=500) | 0% [0–0%] (n=988) |
| SLSA provenance | npm | 34% [30–38%] (n=500) | 12% [10–14%] (n=1000) |
| SLSA provenance | RubyGems | 0% [0–1%] (n=500) | 0% [0–0%] (n=1000) |
| SLSA provenance | Maven Central | 0% [0–1%] (n=500) | 0% [0–0%] (n=1000) |
| Source link | PyPI | 41% [37–45%] (n=500) | 21% [19–24%] (n=988) |
| Source link | npm | 34% [30–38%] (n=500) | 12% [10–14%] (n=1000) |
| Source link | crates.io | 16% [13–19%] (n=500) | 7% [6–9%] (n=1000) |
| Source link | RubyGems | 16% [13–19%] (n=500) | 6% [4–7%] (n=1000) |
| Source link | Go | ≥ 68% [64–72%] (n=500) | ≥ 99% [98–99%] (n=999) |
| Source link | Maven Central | 0% [0–1%] (n=500) | 0% [0–0%] (n=1000) |
| Source link | Packagist | 100% [99–100%] (n=499) | 100% [100–100%] (n=988) |
| Transparency log | PyPI | 44% [40–49%] (n=500) | 21% [19–24%] (n=988) |
| Transparency log | npm | 34% [30–38%] (n=500) | 12% [10–14%] (n=1000) |
| Transparency log | RubyGems | 16% [13–19%] (n=500) | 6% [4–7%] (n=1000) |
| Transparency log | Go | 100% [99–100%] (n=500) | 100% [100–100%] (n=999) |
| Transparency log | Maven Central | 0% [0–1%] (n=500) | 0% [0–0%] (n=1000) |
| MFA enforced | PyPI | ≥ 94% [92–96%] (n=500) | ≥ 97% [95–98%] (n=988) |
| MFA enforced | npm | ≥ 79% [75–82%] (n=500) | ≥ 0% [0–1%] (n=1000) |
| MFA enforced | RubyGems | 24% [21–28%] (n=500) | 31% [28–34%] (n=1000) |

## Trust summary (assurance, latest release)

| Platform | Top | Random |
|---|---:|---:|
| PyPI | 45%–55% (n=500) | 30%–44% (n=988) |
| npm | 53%–56% (n=500) | 26%–41% (n=1000) |
| crates.io | 8% (n=500) | 4% (n=1000) |
| RubyGems | 18%–49% (n=500) | 11%–42% (n=1000) |
| Go | 28%–33% (n=500) | 33% (n=999) |
| Maven Central | 32% (n=500) | 33% (n=1000) |
| Packagist | 17% (n=499) | 17% (n=988) |

## Overlap

A package drawn into both samples is measured once and counted in each.

| Platform | Top | Random | In both |
|---|---:|---:|---:|
| PyPI | 500 | 1000 | 2 |
| npm | 500 | 1000 | 0 |
| crates.io | 500 | 1000 | 2 |
| RubyGems | 500 | 1000 | 13 |
| Go | 500 | 1000 | 0 |
| Maven Central | 500 | 1000 | 0 |
| Packagist | 500 | 1000 | 3 |

## The draw

Names were shuffled with the seed and checked in order until the sample was full. The share of checked packages
that were active estimates how much of each registry is active; names that turned out to be no package (gone,
or not a valid name) are left out of it. The full record, every rejected name included, is
[random/draw.json](random/draw.json).

| Platform | Name list | Names listed | Checked | Not packages | Active | Active share | Seed |
|---|---|---:|---:|---:|---:|---:|---|
| PyPI | every project in the Simple API root (PEP 691 JSON) | 922931 | 1760 | 0 | 1000 | 57% [54–59%] | `20261025-1832Z` |
| npm | deps.dev BigQuery: every NPM package name in its snapshot of 2026-10-19, ordered by FARM_FINGERPRINT(seed:name) | 12565986 | 5487 | 3531 | 1000 | 51% [49–53%] | `20261025-1832Z` |
| crates.io | crates.io database dump: crates.csv, and versions.csv created_at | 361024 | 1312 | 0 | 1000 | 76% [74–78%] | `20261025-1832Z` |
| RubyGems | RubyGems.org weekly PostgreSQL dump: rubygems, and versions.created_at and indexed | 234690 | 6704 | 1078 | 1000 | 18% [17–19%] | `20261025-1832Z` |
| Go | index.golang.org over the activity window; a pseudo-version is not a release | 2357088 | 3115 | 0 | 1000 | 32% [30–34%] | `20261025-1832Z` |
| Maven Central | deps.dev BigQuery: every MAVEN package name in its snapshot of 2026-10-19, ordered by FARM_FINGERPRINT(seed:name) | 925524 | 2008 | 63 | 1000 | 51% [49–54%] | `20261025-1832Z` |
| Packagist | packages/list.json: every package name | 470538 | 3057 | 0 | 1000 | 33% [31–34%] | `20261025-1832Z` |

Quarter anchors of the random sample describe *today's* active packages in the past, not the registry as it was
then: packages that stopped publishing before the window are not in the population. Spam packages are part of
the population and stay in the sample.

## Method and sources

- **Prior work**: Whole-registry studies also sample when a registry is too large to measure: Schorlemmer et al. took PyPI from BigQuery and Maven Central from an ecosyste.ms data dump, and measured a random tenth of Maven Central. [1](https://arxiv.org/html/2401.14635v2 "“We used ecosyste.ms’ data dump from 01 Mar 2024 to collect packages from Maven Central.” … “Due to download rates, we only measure a random sample of the filtered Maven Central packages (10% of the total population).” (accessed 2026-10-21)") [2](https://blog.ecosyste.ms/2023/08/24/open-data-releases.html "“Each release is a full SQL dump of the database of the service” (accessed 2026-10-21)")
- **PyPI**: Every project name is read from the root of the Simple API, whose order is undefined; the draw sorts the list before shuffling. A project is active if a release (dated by its earliest file) falls in the window. [1](https://peps.python.org/pep-0691/ "“`projects`: An array where each entry is a dictionary with a single key, `name`, which represents string of the project name.” … “neither PEP 503 nor this PEP requires any specific ordering nor that the ordering is consistent from one request to the next” (accessed 2026-10-21)")
- **npm**: npm's only list of every package is its replication feed, rebuilt in 2025, which pages through every change ever made, deleted packages included. The names come from deps.dev instead; whether a package is active is read from its packument, counting only versions still published. [1](https://github.blog/changelog/2025-02-26-changes-and-deprecation-notice-for-npm-replication-apis/ "“certain endpoints will be deprecated as of Thursday, May 29, 2025” (accessed 2026-10-21)") [2](https://docs.deps.dev/bigquery/v1/ "“The time at which this package version was published, as reported by the upstream source.” (accessed 2026-10-21)")
- **crates.io**: Names and release dates come from the daily database dump: `crates.csv`, and `created_at` in `versions.csv`. [1](https://github.com/rust-lang/crates.io/blob/main/crates/crates_io_database_dump/src/dump-db.toml "“This file configures what to include in public database dumps.” … “num = 'public' num_no_build = 'public'” (accessed 2026-10-21)")
- **RubyGems**: Names and release dates come from the weekly PostgreSQL dump taken before the snapshot: the `rubygems` table, and `created_at` in `versions`, yanked versions included. A gem none of whose versions is still indexed (all yanked or removed) is no package: yanking unindexes a version, and the gems API answers 404 for a gem without an indexed version. [1](https://rubygems.org/pages/data "“We provide weekly dumps of the RubyGems.org PostgreSQL data. This dump is sanitized, removing all user information.” (accessed 2026-10-21)") [2](https://github.com/rubygems/rubygems.org/blob/master/app/models/deletion.rb "“version.update!(indexed: false, yanked_at: Time.now.utc)” (accessed 2026-10-28)") [3](https://github.com/rubygems/rubygems.org/blob/master/app/controllers/api/v1/rubygems_controller.rb "“if @rubygem.hosted? && @rubygem.public_versions.indexed.present?” … “render plain: t(:this_rubygem_could_not_be_found), status: :not_found” (accessed 2026-10-28)")
- **Go**: The module index is crawled over the activity window only: a module without a version in the window is inactive anyway. Its time is when the proxy first cached a version, not when the version was tagged, and pseudo-versions (commits) are not releases. [1](https://index.golang.org/ "“The feed is served as new line delimited JSON, providing the module path (as Path), the module version (as Version), and the time it was first cached by proxy.golang.org (as Timestamp).” … “'limit': the maximum length of the returned list. Default = 2000, Max = 2000” (accessed 2026-10-21)")
- **Maven Central**: Names come from deps.dev; activity is read from `maven-metadata.xml`. Central lowers its request thresholds over time, so a 429 ends the run for now and it resumes later, never faster. [1](https://central.sonatype.org/faq/429-error/ "“Maven Central is beginning to enforce consumption limits for unusually high-volume traffic.” … “Over time, those thresholds will move downward as we continue the transition toward a more sustainable consumption model.” (accessed 2026-10-21)")
- **Packagist**: Names come from `packages/list.json`; activity from each package's p2 metadata, which lists tagged releases only. [1](https://packagist.org/apidoc "“Listing package names Anonymous” … “The `p2/$vendor/$package.json` file contains only tagged releases.” (accessed 2026-10-21)")
