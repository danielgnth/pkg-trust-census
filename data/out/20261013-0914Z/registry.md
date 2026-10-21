# Whole registry: Sigstore attestations (deps.dev snapshot 2026-10-12)

Every package of four registries, from deps.dev's BigQuery dataset: each package's newest release (pre-releases
excluded), and whether deps.dev records a Sigstore attestation for it. This is deps.dev's data, not this project's
measurement, so it is reported here and nowhere in the matrix or the score. How it agrees with this project's own
reading, release by release, is in the [agreement check](../../../sources/archive/depsDevAgreement.txt).

Data: [deps.dev](https://deps.dev) (Open Source Insights, Google). Its generated data, such as whether it verified an
attestation, is licensed [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/); package and attestation data it
aggregates from the registries is under their terms. The counts below are this project's aggregation.

## Latest release

| Platform | Packages | Attested | Verified by deps.dev | Names repo + commit | Active packages: attested | Random sample (active): ours |
|---|---:|---:|---:|---:|---:|---:|
| PyPI | 853,647 | 12.0% (102,078/853,647) | 12.0% (102,078/853,647) | 11.9% (101,742/853,647) | 20.2% (102,078/505,628) | – |
| npm | 4,190,289 | 5.7% (236,797/4,190,289) | 5.7% (236,796/4,190,289) | 5.7% (236,797/4,190,289) | 11.3% (236,070/2,090,163) | – |
| RubyGems | 194,158 | 0.9% (1,705/194,158) | 0.9% (1,705/194,158) | 0.9% (1,705/194,158) | 5.2% (1,705/32,997) | – |
| Maven Central | 848,247 | 0.0% (0/848,247) | 0.0% (0/848,247) | 0.0% (0/848,247) | 0.0% (0/466,416) | – |

*Active*: newest release within the 36 months before the snapshot, the random sample's population. Its last
column is this project's own measurement of the same mechanism on that sample, with its 95% interval: the whole
registry's figure should fall inside it.

## Over time (newest release at each quarter's end, all packages)

| Quarter | PyPI | npm | RubyGems | Maven Central |
|---|---:|---:|---:|---:|
| 2024Q1 | 0.0% (0/473,880) | 0.3% (7,695/2,557,384) | 0.0% (0/177,069) | 0.0% (0/570,187) |
| 2024Q2 | 0.0% (0/495,870) | 0.3% (9,984/2,878,486) | 0.0% (0/178,192) | 0.0% (0/587,930) |
| 2024Q3 | 0.0% (0/516,926) | 0.5% (15,098/3,011,082) | 0.0% (0/179,334) | 0.0% (0/607,754) |
| 2024Q4 | 1.0% (5,673/540,449) | 0.6% (18,446/3,084,156) | 0.1% (94/180,432) | 0.0% (0/626,318) |
| 2025Q1 | 2.0% (11,601/565,905) | 0.7% (21,755/3,166,608) | 0.1% (180/181,514) | 0.0% (0/646,605) |
| 2025Q2 | 2.8% (16,942/595,792) | 0.8% (25,431/3,255,488) | 0.2% (355/182,701) | 0.0% (0/667,938) |
| 2025Q3 | 3.5% (22,131/626,095) | 0.9% (31,244/3,345,858) | 0.3% (469/183,968) | 0.0% (0/692,581) |
| 2025Q4 | 4.4% (28,875/660,833) | 1.4% (49,167/3,448,239) | 0.3% (600/185,462) | 0.0% (0/719,880) |
| 2026Q1 | 6.2% (44,104/716,074) | 2.3% (83,198/3,634,073) | 0.4% (833/188,342) | 0.0% (0/755,774) |
| 2026Q2 | 8.6% (66,931/780,323) | 3.6% (137,619/3,870,151) | 0.6% (1,130/190,728) | 0.0% (0/795,662) |
| 2026Q3 | 11.5% (97,006/844,152) | 5.3% (222,007/4,151,791) | 0.8% (1,623/193,806) | 0.0% (0/841,156) |

## Query

Run 2026-10-21T11:36:12.220Z against deps.dev's snapshot of 2026-10-12T21:01:01.783976Z; 6.1 GiB processed
(job `4109639d-c54d-45a5-82ce-d3340dd02119`). The SQL, its parameters and the result are in [attestations.json](../../bigquery/20261013-0914Z/attestations.json).

## Method and sources

- **what deps.dev records**: deps.dev's `PackageVersions` table records each version's attestations and whether deps.dev verified them (Sigstore bundles with sigstore-go); its SLSA column is filled for npm only. The per-version API serves the same model, and is what the agreement check reads. [1](https://docs.deps.dev/bigquery/v1/ "“The attestation has been cryptographically verified by deps.dev.” … “This is only populated for npm package versions.” (accessed 2026-10-21)") [2](https://docs.deps.dev/api/v3/ "“GetVersion returns information about a specific package version, including its licenses and any security advisories known to affect it.” (accessed 2026-10-21)")
- **agreement**: For the latest release of every sampled package, deps.dev's attestations are checked against this project's own reading of the same mechanism (`scripts/check-depsdev.ts`, rerun per snapshot); its archived output lists every disagreement. Only Sigstore attestations are compared: deps.dev has no field for crates.io's trusted publishing or Go's checksum database, and no Packagist. [1](../../../scripts/check-depsdev.ts "“deps.dev attestations compared with this project's measurement, for the latest release of every sampled package.” (accessed 2026-10-21)")
- **snapshots**: Every table carries the time of the snapshot it belongs to, and `Snapshots` lists them, so a query names the deps.dev snapshot it read. [1](https://docs.deps.dev/bigquery/v1/ "“This table contains the timestamps for which a full snapshot of all other tables exists.” (accessed 2026-10-21)")
- **licence**: Data deps.dev generates, such as whether it verified an attestation, is licensed CC-BY 4.0 and credited to deps.dev wherever it is used. Package names and the attestations themselves are data it aggregates from the registries, under their terms, so only counts are committed. Answers from its API may be cached. [1](https://github.com/google/deps.dev/blob/main/README.md "“This generated data is available under a CC-BY 4.0 license.” … “For details on using the data from these sources, please consult their documentation.” … “Clients are expressly permitted to cache data served by the API.” (accessed 2026-10-21)")
- **access**: The dataset is read through the BigQuery sandbox, which needs a Google account but no billing. Its monthly query allowance bounds what is scanned, so every query is dry-run first; nothing is stored there, since sandbox tables expire. [1](https://docs.deps.dev/bigquery/v1/ "“To use the BigQuery dataset, you will need a Google Cloud account with the BigQuery API enabled.” (accessed 2026-10-21)") [2](https://cloud.google.com/bigquery/docs/sandbox "“The BigQuery sandbox lets you experience BigQuery without providing a credit card or creating a billing account for your project.” … “1 TiB of processed query data each month” … “You are granted a lifetime limit of 10 GiB of storage.” … “automatically expire after 60 days” (accessed 2026-10-21)")
