# Run summary — snapshot 20261025-1832Z, random active packages

As of 2026-10-25T18:32:16.601Z · generated 2026-10-28T13:45:24.413Z

**6985/7000 packages extracted · error rate 0.2%** (within the < 5% target)

## Coverage

| Ecosystem | Ranked by | Sampled | Fetched | Fetch errors | Extracted | Extract errors |
|---|---|---:|---:|---:|---:|---:|
| PyPI | random | 1000 | 1000 | 0 | 998 | 0 |
| npm | random | 1000 | 1000 | 0 | 1000 | 0 |
| crates.io | random | 1000 | 1000 | 0 | 1000 | 0 |
| RubyGems | random | 1000 | 1000 | 0 | 1000 | 0 |
| Go | random | 1000 | 1000 | 0 | 999 | 0 |
| Maven Central | random | 1000 | 1000 | 0 | 1000 | 0 |
| Packagist | random | 1000 | 1000 | 0 | 988 | 0 |

### Trust summary per platform (snapshot 20261025-1832Z)

| Platform | Capability | Auditable | Assurance (latest) | Assurance (2024Q1) | Publisher authentication | Artifact authenticity | Source provenance |
|---|---:|---:|---:|---:|---:|---:|---:|
| **Maven Central** | 2/3 | 2/3 | 33% | 33% | — no mechanism | 99% | 0% |
| **Go** | 1/3 | 1/3 | 33% | 33% | — no mechanism | 50% | 49%–50% |
| **PyPI** | 3/3 | 3/3 | 30%–44% | 8%–33% | 59%–100% | 21% | 11% |
| **npm** | 3/3 | 3/3 | 26%–41% | 18%–35% | 11%–55% | 56% | 12% |
| **Packagist** | ½/3 | ½/3 | 17% | 17% | — no mechanism | — no mechanism | 50% |
| **RubyGems** | 3/3 | 3/3 | 11%–42% | 2%–38% | 23%–24% | 6%–100% | 3% |
| **crates.io** | 1½/3 | 1½/3 | 4% | 0% | 7% | — no mechanism | 4% |

Three categories, each answered by the strongest signal a release has: 1 point for the strong level, ½ for
the weak one. *Publisher authentication*: identity-bound publish (1) or enforced MFA (½). *Artifact
authenticity*: publisher signature (1) or registry signature (½). *Source provenance*: SLSA provenance (1)
or source link (½). Transparency log is reported in the matrix but not scored, because every Sigstore
signature is logged and would count twice.

*Capability*: the points the platform offers at all. *Auditable*: those the public API lets an outsider
check. *Assurance*: the average share of the points a sampled package's release actually has; a range
means some signals are unknown (low end counts them as absent, high end as present).

### How the latest releases were published (snapshot 20261025-1832Z)

| Platform | Trusted publishing (OIDC) | Account credential | Unknown | Credential used otherwise |
|---|---:|---:|---:|---|
| **PyPI** | ≥ 21% (209) | 0% (0) | 79% (779) | API token (not distinguishable from trusted publishing without attestations) |
| **npm** | 11% (105) | 90% (895) | 0% (0) | granular token or login session |
| **crates.io** | 7% (72) | 93% (928) | 0% (0) | API token |
| **RubyGems** | ≥ 12% (115) | 88% (878) | 1% (7) | user API key |
| **Go** | – | – | – | none: releases are VCS tags |
| **Maven Central** | 0% (0) | 100% (1000) | 0% (0) | Portal user token (no OIDC path exists) |
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

### Withdrawn versions since 2024-04-01 (snapshot 20261025-1832Z)

| Platform | Mechanism | Packages withdrawing ≥ 1 version | Withdrawn versions | Why no data |
|---|---|---:|---:|---|
| **PyPI** | yanked | 2% (21/1000) | 1% (46/9145) | |
| **npm** | unpublished | 8% (76/1000) | 2% (406/16325) | |
| **npm** | deprecated (still installs) | 3% (30/1000) | 2% (287/16325) | |
| **crates.io** | yanked | 8% (78/1000) | 2% (232/9736) | |
| **RubyGems** | – | – | – | yanked versions vanish from every API, so yanks cannot be counted |
| **Go** | retracted (all time) | 1% (7/984) | 42 | |
| **Maven Central** | – | – | – | nothing can be withdrawn |
| **Packagist** | – | – | – | soft-deleted versions are not in the public API |

Counted over versions published in the window; Go's retractions are undated and counted over each module's
history. Per-package rows, with the version numbers, are in `withdrawals.csv`.

### Known advisories (OSV, queried 2026-10-27; snapshot 20261025-1832Z)

| Platform | Latest release: with a known vulnerability | Vulnerabilities | Malware reports | Release installed at the end of 2024Q1: known then → now |
|---|---:|---:|---:|---:|
| **PyPI** | 0% (1/988) | 2 | 0 | 0% → 0% (n=238) |
| **npm** | 6% (62/1000) | 62 | 62 | 0% → 0% (n=191) |
| **crates.io** | 0% (2/1000) | 2 | 0 | 0% → 1% (n=167) |
| **RubyGems** | 0% (0/1000) | 0 | 0 | 0% → 1% (n=475) |
| **Go** | 0% (0/999) | 0 | 0 | 0% → 0% (n=573) |
| **Maven Central** | 0% (0/1000) | 0 | 0 | 0% → 1% (n=350) |
| **Packagist** | 0% (0/988) | 0 | 0 | 0% → 0% (n=457) |

A vulnerability listed by several databases (GHSA, PYSEC, RUSTSEC, GO, …) counts once, and counts as known from
its first publication in any of them. The last column is about a different, older release of each package: the one
a default install chose at the end of 2024Q1, with the share that had a published advisory by then, and by the snapshot.
A low share for the latest release beside a high one for the older release means the vulnerabilities were found later
and fixed in newer releases.

#### Malware reports

| Platform | Package | Version | Report | Released | Reported | Hours | Withdrawn |
|---|---|---|---|---|---|---:|---|
| npm | @miptaa02/fasak | 1.1.4 | MAL-2025-150613 | 2024-05-06T04:09:24.567Z | 2025-11-12T16:47:05.000Z | 13332.6 | no |
| npm | @vaultflow/update-flow | 0.0.1-security | MAL-2026-11097 | 2026-07-28T00:40:10.576Z | 2026-07-28T00:41:14.000Z | 0.0 | no |
| npm | @vaultflow/update-flow | 1.0.0 | MAL-2026-11097 | 2026-07-22T19:10:57.550Z | 2026-07-28T00:41:14.000Z | 125.5 | unpublished |
| npm | @vaultflow/update-flow | 1.2.5 | MAL-2026-11097 | 2026-07-25T00:47:24.164Z | 2026-07-28T00:41:14.000Z | 71.9 | unpublished |
| npm | @vaultflow/update-flow | 1.2.6 | MAL-2026-11097 | 2026-07-27T23:17:55.827Z | 2026-07-28T00:41:14.000Z | 1.4 | unpublished |
| npm | @zarafront/lib-zds | 99.50.55 | MAL-2024-8838 | 2024-09-08T16:55:59.361Z | 2024-09-08T17:03:36.000Z | 0.1 | unpublished |
| npm | aibopna-mobile-arifaui | 1.0.0 | MAL-2025-151945 | 2024-05-24T15:41:00.804Z | 2025-11-12T16:47:05.000Z | 12889.1 | no |
| npm | aibuna-mobiule-amzaueiua | 1.0.0 | MAL-2025-151986 | 2024-05-24T15:27:44.666Z | 2025-11-12T16:47:05.000Z | 12889.3 | no |
| npm | allied_wombat_z3n | 0.0.1-security | MAL-2025-93198 | 2025-11-12T11:16:55.158Z | 2025-11-11T05:18:27.000Z | -30.0 | unpublished |
| npm | allied_wombat_z3n | 0.0.1-security.0 | MAL-2025-93198 | 2025-11-12T11:32:46.457Z | 2025-11-11T05:18:27.000Z | -30.2 | unpublished |
| npm | allied_wombat_z3n | 0.0.1-security.1 | MAL-2025-93198 | 2025-11-12T11:49:42.800Z | 2025-11-11T05:18:27.000Z | -30.5 | no |
| npm | allied_wombat_z3n | 1.2.4 | MAL-2025-93198 | 2024-06-09T07:53:36.730Z | 2025-11-11T05:18:27.000Z | 12477.4 | unpublished |
| npm | andi-pisang7-sluey | 0.0.1-security | MAL-2025-132048 | 2025-11-12T09:29:31.540Z | 2025-11-11T22:56:38.000Z | -10.5 | unpublished |
| npm | andi-pisang7-sluey | 0.0.1-security.0 | MAL-2025-132048 | 2025-11-12T09:45:45.623Z | 2025-11-11T22:56:38.000Z | -10.8 | unpublished |
| npm | andi-pisang7-sluey | 0.0.1-security.1 | MAL-2025-132048 | 2025-11-12T10:02:58.078Z | 2025-11-11T22:56:38.000Z | -11.1 | no |
| npm | andi-pisang7-sluey | 4.3.2 | MAL-2025-132048 | 2024-05-08T13:37:40.646Z | 2025-11-11T22:56:38.000Z | 13257.3 | unpublished |
| npm | andi-tumis73-sumpek | 0.0.1-security | MAL-2025-132069 | 2025-11-14T08:09:15.943Z | 2025-11-11T22:56:38.000Z | -57.2 | unpublished |
| npm | andi-tumis73-sumpek | 0.0.1-security.0 | MAL-2025-132069 | 2025-11-14T08:25:19.198Z | 2025-11-11T22:56:38.000Z | -57.5 | unpublished |
| npm | andi-tumis73-sumpek | 0.0.1-security.1 | MAL-2025-132069 | 2025-11-14T08:42:19.161Z | 2025-11-11T22:56:38.000Z | -57.8 | no |
| npm | andi-tumis73-sumpek | 4.1.3 | MAL-2025-132069 | 2024-05-06T22:14:27.176Z | 2025-11-11T22:56:38.000Z | 13296.7 | unpublished |
| npm | arif-toge6-sukiwir | 0.0.1-security | MAL-2025-76911 | 2025-11-12T18:56:51.351Z | 2025-11-11T03:48:15.000Z | -39.1 | unpublished |
| npm | arif-toge6-sukiwir | 0.0.1-security.0 | MAL-2025-76911 | 2025-11-12T19:13:10.572Z | 2025-11-11T03:48:15.000Z | -39.4 | unpublished |
| npm | arif-toge6-sukiwir | 0.0.1-security.1 | MAL-2025-76911 | 2025-11-12T19:30:08.983Z | 2025-11-11T03:48:15.000Z | -39.7 | no |
| npm | arif-toge6-sukiwir | 2.4.2 | MAL-2025-76911 | 2024-05-14T03:35:33.884Z | 2025-11-11T03:48:15.000Z | 13104.2 | unpublished |
| npm | byte-log-float-cold-analyze | 1.2.4 | MAL-2025-185956 | 2024-07-12T14:43:18.003Z | 2025-11-13T03:23:14.000Z | 11724.7 | no |
| npm | charon-gridsome-element-ui-meteor | 1.2.3 | MAL-2025-140721 | 2024-06-17T15:41:53.757Z | 2025-11-12T04:29:11.000Z | 12300.8 | no |
| npm | cindy-brongkos66-breki | 0.0.1-security | MAL-2025-72328 | 2025-11-12T22:15:51.135Z | 2025-11-11T02:29:13.000Z | -43.8 | unpublished |
| npm | cindy-brongkos66-breki | 0.0.1-security.0 | MAL-2025-72328 | 2025-11-12T22:32:02.384Z | 2025-11-11T02:29:13.000Z | -44.0 | unpublished |
| npm | cindy-brongkos66-breki | 0.0.1-security.1 | MAL-2025-72328 | 2025-11-12T22:48:49.452Z | 2025-11-11T02:29:13.000Z | -44.3 | no |
| npm | cindy-brongkos66-breki | 2.2.3 | MAL-2025-72328 | 2024-05-15T01:28:23.736Z | 2025-11-11T02:29:13.000Z | 13081.0 | unpublished |
| npm | civilian_ferret_z3n | 0.0.1-security | MAL-2025-93563 | 2025-11-12T12:43:37.717Z | 2025-11-11T05:18:27.000Z | -31.4 | unpublished |
| npm | civilian_ferret_z3n | 0.0.1-security.0 | MAL-2025-93563 | 2025-11-12T12:59:21.233Z | 2025-11-11T05:18:27.000Z | -31.7 | unpublished |
| npm | civilian_ferret_z3n | 0.0.1-security.1 | MAL-2025-93563 | 2025-11-12T13:16:24.508Z | 2025-11-11T05:18:27.000Z | -32.0 | no |
| npm | civilian_ferret_z3n | 1.3.1 | MAL-2025-93563 | 2024-06-11T07:12:55.350Z | 2025-11-11T05:18:27.000Z | 12430.1 | unpublished |
| npm | dian-klipo16-miaww | 0.0.1-security | MAL-2025-84591 | 2025-11-12T08:13:06.522Z | 2025-11-11T04:25:34.000Z | -27.8 | unpublished |
| npm | dian-klipo16-miaww | 0.0.1-security.0 | MAL-2025-84591 | 2025-11-12T08:28:53.039Z | 2025-11-11T04:25:34.000Z | -28.1 | unpublished |
| npm | dian-klipo16-miaww | 0.0.1-security.1 | MAL-2025-84591 | 2025-11-12T08:45:42.901Z | 2025-11-11T04:25:34.000Z | -28.3 | no |
| npm | dian-klipo16-miaww | 2.2.4 | MAL-2025-84591 | 2024-05-08T00:59:55.043Z | 2025-11-11T04:25:34.000Z | 13251.4 | unpublished |
| npm | dune-bonfire-nvp542-project | 0.0.1-security | MAL-2025-18967 | 2024-08-27T00:57:16.744Z | 2025-08-14T18:52:04.000Z | 8465.9 | no |
| npm | dune-bonfire-nvp542-project | 1.0.0 | MAL-2025-18967 | 2024-07-05T20:18:38.290Z | 2025-08-14T18:52:04.000Z | 9718.6 | unpublished |
| npm | easy-violet-swallow | 0.0.1-security | MAL-2025-67928 | 2025-11-12T06:14:42.942Z | 2025-11-11T00:41:25.000Z | -29.6 | unpublished |
| npm | easy-violet-swallow | 0.0.1-security.0 | MAL-2025-67928 | 2025-11-12T06:30:45.739Z | 2025-11-11T00:41:25.000Z | -29.8 | unpublished |
| npm | easy-violet-swallow | 0.0.1-security.1 | MAL-2025-67928 | 2025-11-12T06:48:08.266Z | 2025-11-11T00:41:25.000Z | -30.1 | no |
| npm | easy-violet-swallow | 8.4.3 | MAL-2025-67928 | 2024-07-10T13:25:37.403Z | 2025-11-11T00:41:25.000Z | 11723.3 | unpublished |
| npm | eka-keripik100-miaww | 1.2.2 | MAL-2025-84862 | 2024-05-07T13:52:21.530Z | 2025-11-11T04:25:34.000Z | 13262.6 | no |
| npm | eko-empal59-riris | 0.0.1-security | MAL-2025-126069 | 2025-11-12T20:21:17.767Z | 2025-11-11T20:46:25.000Z | -23.6 | unpublished |
| npm | eko-empal59-riris | 0.0.1-security.0 | MAL-2025-126069 | 2025-11-12T20:41:54.427Z | 2025-11-11T20:46:25.000Z | -23.9 | no |
| npm | eko-empal59-riris | 2.3.4 | MAL-2025-126069 | 2024-05-14T16:44:37.939Z | 2025-11-11T20:46:25.000Z | 13108.0 | unpublished |
| npm | eko-moci81-miaww | 0.0.1-security | MAL-2025-84983 | 2025-11-13T02:08:45.579Z | 2025-11-11T04:25:34.000Z | -45.7 | unpublished |
| npm | eko-moci81-miaww | 0.0.1-security.0 | MAL-2025-84983 | 2025-11-13T02:25:00.536Z | 2025-11-11T04:25:34.000Z | -46.0 | unpublished |
| npm | eko-moci81-miaww | 0.0.1-security.1 | MAL-2025-84983 | 2025-11-13T02:42:02.197Z | 2025-11-11T04:25:34.000Z | -46.3 | no |
| npm | eko-moci81-miaww | 3.4.1 | MAL-2025-84983 | 2024-05-17T04:38:17.075Z | 2025-11-11T04:25:34.000Z | 13031.8 | unpublished |
| npm | erwin-jus61-sluey | 0.0.1-security | MAL-2025-50340 | 2025-11-12T23:16:37.449Z | 2025-11-10T04:05:19.000Z | -67.2 | unpublished |
| npm | erwin-jus61-sluey | 0.0.1-security.0 | MAL-2025-50340 | 2025-11-12T23:25:40.922Z | 2025-11-10T04:05:19.000Z | -67.3 | no |
| npm | erwin-jus61-sluey | 2.4.4 | MAL-2025-50340 | 2024-05-14T13:08:42.314Z | 2025-11-10T04:05:19.000Z | 13070.9 | unpublished |
| npm | erwin-ragi45-breki | 4.2.1 | MAL-2025-72803 | 2024-05-08T16:59:51.196Z | 2025-11-11T02:29:13.000Z | 13233.5 | no |
| npm | flights-ilutg-zilsdsdfsgauma | 1.1.2 | MAL-2025-181948 | 2024-05-26T07:15:47.405Z | 2025-11-12T22:25:03.000Z | 12855.2 | no |
| npm | fusion-jwt-eclipse-bunyan | 1.2.3 | MAL-2025-142738 | 2024-06-17T15:32:30.946Z | 2025-11-12T04:29:11.000Z | 12300.9 | no |
| npm | galih-lupis28-ruro | 0.0.1-security | MAL-2025-103035 | 2025-11-12T23:00:11.801Z | 2025-11-11T07:16:30.000Z | -39.7 | no |
| npm | galih-lupis28-ruro | 2.2.4 | MAL-2025-103035 | 2024-05-17T17:58:50.011Z | 2025-11-11T07:16:30.000Z | 13021.3 | unpublished |
| npm | gita-rujak72-breki | 0.0.1-security | MAL-2025-120341 | 2025-11-12T22:30:03.641Z | 2025-11-11T20:11:48.000Z | -26.3 | unpublished |
| npm | gita-rujak72-breki | 0.0.1-security.0 | MAL-2025-120341 | 2025-11-12T22:46:16.758Z | 2025-11-11T20:11:48.000Z | -26.6 | unpublished |
| npm | gita-rujak72-breki | 0.0.1-security.1 | MAL-2025-120341 | 2025-11-12T23:02:57.634Z | 2025-11-11T20:11:48.000Z | -26.9 | no |
| npm | gita-rujak72-breki | 4.2.1 | MAL-2025-120341 | 2024-05-15T01:46:21.256Z | 2025-11-11T20:11:48.000Z | 13098.4 | unpublished |
| npm | hereis-maniac-tanbu | 1.1.2 | MAL-2025-172368 | 2024-05-25T11:37:29.517Z | 2025-11-12T18:09:08.000Z | 12870.5 | no |
| npm | india-k9e-project | 0.0.1-security | MAL-2025-23139 | 2024-08-27T00:47:28.636Z | 2025-08-14T18:52:04.000Z | 8466.1 | no |
| npm | india-k9e-project | 1.0.0 | MAL-2025-23139 | 2024-06-28T14:53:30.414Z | 2025-08-14T18:52:04.000Z | 9892.0 | unpublished |
| npm | inevitable_shrimp_z3n | 0.0.1-security | MAL-2025-86718 | 2025-11-13T10:56:14.948Z | 2025-11-11T04:25:34.000Z | -54.5 | unpublished |
| npm | inevitable_shrimp_z3n | 0.0.1-security.0 | MAL-2025-86718 | 2025-11-13T11:12:28.075Z | 2025-11-11T04:25:34.000Z | -54.8 | unpublished |
| npm | inevitable_shrimp_z3n | 0.0.1-security.1 | MAL-2025-86718 | 2025-11-13T11:29:25.150Z | 2025-11-11T04:25:34.000Z | -55.1 | no |
| npm | inevitable_shrimp_z3n | 1.2.2 | MAL-2025-86718 | 2024-07-12T00:50:18.440Z | 2025-11-11T04:25:34.000Z | 11691.6 | unpublished |
| npm | irma-nasi87-sluey | 0.0.1-security | MAL-2025-134420 | 2025-11-12T18:21:15.976Z | 2025-11-11T22:56:38.000Z | -19.4 | unpublished |
| npm | irma-nasi87-sluey | 0.0.1-security.0 | MAL-2025-134420 | 2025-11-12T18:37:26.130Z | 2025-11-11T22:56:38.000Z | -19.7 | unpublished |
| npm | irma-nasi87-sluey | 0.0.1-security.1 | MAL-2025-134420 | 2025-11-12T18:54:20.593Z | 2025-11-11T22:56:38.000Z | -20.0 | no |
| npm | irma-nasi87-sluey | 3.2.4 | MAL-2025-134420 | 2024-05-13T16:11:51.944Z | 2025-11-11T22:56:38.000Z | 13134.7 | unpublished |
| npm | iwan-nasi28-riris | 0.0.1-security | MAL-2025-127539 | 2025-11-13T03:44:10.951Z | 2025-11-11T20:46:25.000Z | -31.0 | unpublished |
| npm | iwan-nasi28-riris | 0.0.1-security.0 | MAL-2025-127539 | 2025-11-13T03:59:49.893Z | 2025-11-11T20:46:25.000Z | -31.2 | unpublished |
| npm | iwan-nasi28-riris | 0.0.1-security.1 | MAL-2025-127539 | 2025-11-13T04:16:54.327Z | 2025-11-11T20:46:25.000Z | -31.5 | no |
| npm | iwan-nasi28-riris | 1.1.1 | MAL-2025-127539 | 2024-05-17T22:03:48.376Z | 2025-11-11T20:46:25.000Z | 13030.7 | unpublished |
| npm | jaja-mangut3-sukiwir | 0.0.1-security | MAL-2025-79142 | 2025-11-12T21:31:24.682Z | 2025-11-11T03:48:15.000Z | -41.7 | unpublished |
| npm | jaja-mangut3-sukiwir | 0.0.1-security.0 | MAL-2025-79142 | 2025-11-12T21:47:29.947Z | 2025-11-11T03:48:15.000Z | -42.0 | unpublished |
| npm | jaja-mangut3-sukiwir | 0.0.1-security.1 | MAL-2025-79142 | 2025-11-12T22:04:37.703Z | 2025-11-11T03:48:15.000Z | -42.3 | no |
| npm | jaja-mangut3-sukiwir | 3.1.1 | MAL-2025-79142 | 2024-05-14T14:40:22.355Z | 2025-11-11T03:48:15.000Z | 13093.1 | unpublished |
| npm | jazz_services-handler | 0.0.1-security | MAL-2025-1602 | 2025-02-28T16:05:31.877Z | 2025-02-28T16:06:11.000Z | 0.0 | no |
| npm | jazz_services-handler | 10.0.0 | MAL-2025-1602 | 2025-02-16T06:15:22.469Z | 2025-02-28T16:06:11.000Z | 297.8 | unpublished |
| npm | jazz_services-handler | 11.0.0 | MAL-2025-1602 | 2025-02-16T18:00:10.678Z | 2025-02-28T16:06:11.000Z | 286.1 | unpublished |
| npm | jazz_services-handler | 12.0.0 | MAL-2025-1602 | 2025-02-16T18:03:18.427Z | 2025-02-28T16:06:11.000Z | 286.0 | unpublished |
| npm | kapvino-socvni-famabapvcavnvai | 1.0.0 | MAL-2025-175239 | 2024-05-18T01:33:15.071Z | 2025-11-12T19:18:14.000Z | 13049.7 | no |
| npm | kuroichi12-men-spell | 1.0.0 | MAL-2025-157924 | 2024-05-05T22:00:35.701Z | 2025-11-12T16:47:05.000Z | 13338.8 | no |
| npm | mahnud-nofty-gosfga | 1.0.0 | MAL-2025-159097 | 2024-05-22T11:48:26.431Z | 2025-11-12T16:47:05.000Z | 12941.0 | no |
| npm | manadsi-sdada-mivafida | 1.0.0 | MAL-2025-159410 | 2024-05-16T10:07:50.675Z | 2025-11-12T16:47:05.000Z | 13086.7 | no |
| npm | managerial_raven_amber-5 | 3.1.4 | MAL-2025-112078 | 2024-05-21T18:35:52.096Z | 2025-11-11T07:47:12.000Z | 12925.2 | no |
| npm | meadow-octopus-aka637-project | 0.0.1-security | MAL-2025-45154 | 2024-08-27T00:17:42.485Z | 2025-09-05T17:10:25.000Z | 8992.9 | unpublished |
| npm | meadow-octopus-aka637-project | 0.0.1-security.0 | MAL-2025-45154 | 2024-08-27T00:29:16.854Z | 2025-09-05T17:10:25.000Z | 8992.7 | no |
| npm | meadow-octopus-aka637-project | 1.0.0 | MAL-2025-45154 | 2024-07-07T10:08:14.989Z | 2025-09-05T17:10:25.000Z | 10207.0 | unpublished |
| npm | mp3-file-zip-d-ownload-37823-billys-live-bait-gqddl-gymxld | 0.0.1-security | MAL-2025-26807 | 2024-09-15T23:52:27.624Z | 2025-08-14T18:52:04.000Z | 7987.0 | no |
| npm | mui-uglify-js-ophiuchus-cluster | 1.2.3 | MAL-2025-145214 | 2024-06-23T21:01:47.783Z | 2025-11-12T04:29:11.000Z | 12151.5 | no |
| npm | nadia-saguer61-miaww | 2.1.3 | MAL-2025-115923 | 2024-05-17T03:29:34.891Z | 2025-11-11T15:19:32.000Z | 13043.8 | no |
| npm | nokire-sekiya47 | 1.0.0 | MAL-2025-163437 | 2024-05-20T10:18:02.408Z | 2025-11-12T16:47:05.000Z | 12990.5 | no |
| npm | obsidian-iumeo-ks71t-night-project | 0.0.1-security | MAL-2025-28066 | 2024-08-27T00:19:59.268Z | 2025-08-14T18:52:04.000Z | 8466.5 | no |
| npm | obsidian-iumeo-ks71t-night-project | 1.0.0 | MAL-2025-28066 | 2024-07-08T05:11:40.361Z | 2025-08-14T18:52:04.000Z | 9661.7 | unpublished |
| npm | oddsfire-components | 0.0.1-security | MAL-2023-8619 | 2023-11-28T07:23:36.131Z | 2023-11-25T21:07:28.000Z | -58.3 | no |
| npm | patria-kue16-sukiwir | 0.0.1-security | MAL-2025-58122 | 2025-11-12T23:53:13.240Z | 2025-11-10T17:21:43.000Z | -54.5 | unpublished |
| npm | patria-kue16-sukiwir | 0.0.1-security.0 | MAL-2025-58122 | 2025-11-13T00:13:24.791Z | 2025-11-10T17:21:43.000Z | -54.9 | no |
| npm | patria-kue16-sukiwir | 3.2.1 | MAL-2025-58122 | 2024-05-14T23:48:19.603Z | 2025-11-10T17:21:43.000Z | 13073.6 | unpublished |
| npm | pitra-60 | 1.0.0 | MAL-2025-164333 | 2024-05-18T23:30:45.546Z | 2025-11-12T16:47:05.000Z | 13025.3 | no |
| npm | popular_whale_z3n | 0.0.1-security | MAL-2025-95940 | 2025-11-12T09:17:14.442Z | 2025-11-11T05:18:27.000Z | -28.0 | unpublished |
| npm | popular_whale_z3n | 0.0.1-security.0 | MAL-2025-95940 | 2025-11-12T09:33:19.721Z | 2025-11-11T05:18:27.000Z | -28.2 | unpublished |
| npm | popular_whale_z3n | 0.0.1-security.1 | MAL-2025-95940 | 2025-11-12T09:50:25.966Z | 2025-11-11T05:18:27.000Z | -28.5 | no |
| npm | popular_whale_z3n | 3.1.3 | MAL-2025-95940 | 2024-06-07T01:06:59.294Z | 2025-11-11T05:18:27.000Z | 12532.2 | unpublished |
| npm | previous_buzzard_requirement | 0.0.1-security | MAL-2025-96005 | 2025-11-12T04:22:58.571Z | 2025-11-11T05:18:27.000Z | -23.1 | unpublished |
| npm | previous_buzzard_requirement | 0.0.1-security.0 | MAL-2025-96005 | 2025-11-12T04:38:58.173Z | 2025-11-11T05:18:27.000Z | -23.3 | no |
| npm | previous_buzzard_requirement | 1.4.3 | MAL-2025-96005 | 2024-05-25T07:06:32.836Z | 2025-11-11T05:18:27.000Z | 12838.2 | unpublished |
| npm | project-vet57-kilo | 0.0.1-security | MAL-2025-30598 | 2024-08-27T00:39:42.335Z | 2025-08-14T18:52:04.000Z | 8466.2 | no |
| npm | project-vet57-kilo | 1.0.0 | MAL-2025-30598 | 2024-06-28T14:17:43.228Z | 2025-08-14T18:52:04.000Z | 9892.6 | unpublished |
| npm | protractor-hyperion-soap-halley | 1.2.3 | MAL-2025-146687 | 2024-06-18T19:29:02.460Z | 2025-11-12T04:29:11.000Z | 12273.0 | no |
| npm | sechub-website | 1.0.0 | MAL-2025-4193 | 2025-04-16T12:46:43.006Z | 2025-05-22T12:54:16.000Z | 864.1 | unpublished |
| npm | sheer_meadowlark_z3n | 0.0.1-security | MAL-2025-117025 | 2025-11-13T06:11:15.391Z | 2025-11-11T15:19:32.000Z | -38.9 | unpublished |
| npm | sheer_meadowlark_z3n | 0.0.1-security.0 | MAL-2025-117025 | 2025-11-13T06:27:23.691Z | 2025-11-11T15:19:32.000Z | -39.1 | unpublished |
| npm | sheer_meadowlark_z3n | 0.0.1-security.1 | MAL-2025-117025 | 2025-11-13T06:44:09.864Z | 2025-11-11T15:19:32.000Z | -39.4 | no |
| npm | sheer_meadowlark_z3n | 1.3.4 | MAL-2025-117025 | 2024-07-08T22:20:53.179Z | 2025-11-11T15:19:32.000Z | 11777.0 | unpublished |
| npm | shuiku-jiaxue-heji | 0.0.1-security | MAL-2025-46040 | 2024-10-01T18:42:29.382Z | 2025-09-05T17:10:25.000Z | 8134.5 | unpublished |
| npm | shuiku-jiaxue-heji | 0.0.1-security.0 | MAL-2025-46040 | 2024-10-01T18:58:42.005Z | 2025-09-05T17:10:25.000Z | 8134.2 | no |
| npm | silly_dinosaur_z3n | 2.2.3 | MAL-2025-117041 | 2024-07-09T03:21:21.250Z | 2025-11-11T15:19:32.000Z | 11772.0 | no |
| npm | sunderlan-uylud-vamkanaunin | 1.1.10 | MAL-2025-166461 | 2024-06-08T22:48:51.985Z | 2025-11-12T16:47:05.000Z | 12522.0 | no |
| npm | teagood-namakai37 | 1.0.0 | MAL-2025-167691 | 2024-05-22T15:40:40.651Z | 2025-11-12T16:47:05.000Z | 12937.1 | no |
| npm | thistle-zodiac-gfu867-project | 0.0.1-security | MAL-2025-36831 | 2024-08-27T00:06:53.084Z | 2025-08-14T18:52:04.000Z | 8466.8 | no |
| npm | thistle-zodiac-gfu867-project | 1.0.0 | MAL-2025-36831 | 2024-07-07T09:39:53.243Z | 2025-08-14T18:52:04.000Z | 9681.2 | unpublished |
| npm | tired_emu_z3n | 0.0.1-security | MAL-2025-97021 | 2025-11-12T13:18:08.277Z | 2025-11-11T05:18:27.000Z | -32.0 | unpublished |
| npm | tired_emu_z3n | 0.0.1-security.0 | MAL-2025-97021 | 2025-11-12T13:34:20.145Z | 2025-11-11T05:18:27.000Z | -32.3 | unpublished |
| npm | tired_emu_z3n | 0.0.1-security.1 | MAL-2025-97021 | 2025-11-12T13:51:09.912Z | 2025-11-11T05:18:27.000Z | -32.5 | no |
| npm | tired_emu_z3n | 2.1.4 | MAL-2025-97021 | 2024-06-11T08:42:39.925Z | 2025-11-11T05:18:27.000Z | 12428.6 | unpublished |
| npm | tool-cypress-atlas-weywot | 0.0.1-security | MAL-2025-46365 | 2024-09-04T09:37:22.347Z | 2025-09-05T17:10:25.000Z | 8791.6 | unpublished |
| npm | tool-cypress-atlas-weywot | 0.0.1-security.0 | MAL-2025-46365 | 2024-09-04T09:53:16.567Z | 2025-09-05T17:10:25.000Z | 8791.3 | no |
| npm | tool-cypress-atlas-weywot | 1.2.3 | MAL-2025-46365 | 2024-06-05T01:53:32.625Z | 2025-09-05T17:10:25.000Z | 10983.3 | unpublished |
| npm | umbra-less-loader-tachyon-hermes | 0.0.1-security | MAL-2025-37661 | 2024-09-04T10:22:56.067Z | 2025-08-14T18:52:04.000Z | 8264.5 | no |
| npm | umbra-less-loader-tachyon-hermes | 1.2.3 | MAL-2025-37661 | 2024-07-08T14:13:39.233Z | 2025-08-14T18:52:04.000Z | 9652.6 | unpublished |
| npm | vera-esdoger85-breki | 0.0.1-security | MAL-2025-123954 | 2025-11-12T20:03:00.729Z | 2025-11-11T20:11:48.000Z | -23.9 | unpublished |
| npm | vera-esdoger85-breki | 0.0.1-security.0 | MAL-2025-123954 | 2025-11-12T20:19:27.038Z | 2025-11-11T20:11:48.000Z | -24.1 | unpublished |
| npm | vera-esdoger85-breki | 0.0.1-security.1 | MAL-2025-123954 | 2025-11-12T20:36:19.195Z | 2025-11-11T20:11:48.000Z | -24.4 | no |
| npm | vera-esdoger85-breki | 2.1.3 | MAL-2025-123954 | 2024-05-14T16:34:10.396Z | 2025-11-11T20:11:48.000Z | 13107.6 | unpublished |
| npm | vuetify-thermochronology-csv-cryovolcano | 1.2.3 | MAL-2025-190201 | 2024-07-09T16:55:53.905Z | 2025-11-13T03:23:14.000Z | 11794.5 | no |
| npm | webpack-prettier-stylelint-indus-version | 1.2.3 | MAL-2025-149404 | 2024-06-21T14:40:26.055Z | 2025-11-12T04:29:11.000Z | 12205.8 | no |
| npm | zain-klipo91-sluey | 0.0.1-security | MAL-2025-138411 | 2025-11-14T08:05:17.102Z | 2025-11-11T22:56:38.000Z | -57.1 | unpublished |
| npm | zain-klipo91-sluey | 0.0.1-security.0 | MAL-2025-138411 | 2025-11-14T08:21:32.336Z | 2025-11-11T22:56:38.000Z | -57.4 | unpublished |
| npm | zain-klipo91-sluey | 0.0.1-security.1 | MAL-2025-138411 | 2025-11-14T08:38:34.875Z | 2025-11-11T22:56:38.000Z | -57.7 | no |
| npm | zain-klipo91-sluey | 2.2.4 | MAL-2025-138411 | 2024-05-07T22:58:11.693Z | 2025-11-11T22:56:38.000Z | 13272.0 | unpublished |

Withdrawn versions with a malware report:

| Platform | Mechanism | Withdrawn versions | With a malware report |
|---|---|---:|---:|
| PyPI | yanked | 46 | 0 |
| npm | unpublished | 406 | 85 |
| npm | deprecated (still installs) | 287 | 0 |
| crates.io | yanked | 232 | 0 |
| Go | retracted (all time) | 42 | 0 |

#### Which databases list them, and how late

| Platform | Database | Vulnerabilities listed | Published first | Median days behind the first |
|---|---|---:|---:|---:|
| PyPI | GHSA | 2 | 2 | – |
| PyPI | PYSEC | 2 | 0 | 43 |
| npm | MAL | 64 | 64 | – |
| crates.io | GHSA | 3 | 1 | 2 |
| crates.io | RUSTSEC | 3 | 3 | – |
| RubyGems | GHSA | 5 | 5 | – |
| Go | GHSA | 1 | 1 | – |
| Go | GO | 1 | 0 | 28 |
| Maven Central | GHSA | 4 | 4 | – |

Over the vulnerabilities affecting any sampled or withdrawn version. A database whose record carries the earliest
`published` time counts as first (ties count for each); the median is over the vulnerabilities it listed later.

### Sigstore across registries (verified 2026-10-14)

4 of 7 registries accept Sigstore bundles (npm, PyPI, RubyGems, Maven Central), all logged in the
public Rekor instance. In the trust matrix each bundle counts as a publisher signature and a transparency-log entry.

| | Sigstore | Since | Latest releases with a bundle | Registry verifies on upload | Best install client | Nearest equivalent |
|---|---|---|---:|---|---|---|
| **PyPI** | ✓ yes | 2024-11 | 21% (209/988) | yes | no (pip 26) | None left: PGP signature uploads were removed in 2023. |
| **npm** | ✓ yes | 2023-04 | 12% (122/1000) | yes | opt-in (npm 12) | Registry-applied ECDSA signatures on every tarball (dist.signatures), also checked only by `npm audit signatures`. |
| **crates.io** | ✗ no | – | – | n/a | n/a | None deployed. A TUF signing experiment exists; trusted publishing records the commit from the CI's OIDC token, but nothing is signed for consumers. |
| **RubyGems** | ✓ yes | 2024-12 | 6% (55/1000) | yes | no (gem / Bundler 4) | Legacy X.509 `gem cert` signatures: opt-in to verify, rarely used, not exposed by the API. |
| **Go** | ✗ no | – | – | n/a | n/a | sum.golang.org, Google's own append-only Merkle log of module hashes with signed tree heads, checked by the go command by default. A transparency log like Rekor, but of hashes, not publisher identities. |
| **Maven Central** | ✓ yes | 2025-01 | 0% (0/1000) | yes | no (Maven 3/4) | Mandatory PGP signatures on every file: long-lived publisher keys, not logged, not checked by Maven by default. |
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
| Identity-bound publish | PyPI | inferred | 21% | 779 | 0% (n=238) |
| Identity-bound publish | npm | observable | 11% | 0 | 0% (n=191) |
| Identity-bound publish | crates.io | observable | 7% | 0 | 0% (n=167) |
| Identity-bound publish | RubyGems | inferred | 12% | 7 | 0% (n=475) |
| Publisher signature | PyPI | observable | 21% | 0 | 0% (n=238) |
| Publisher signature | npm | observable | 12% | 0 | 3% (n=191) |
| Publisher signature | RubyGems | inferred | 6% | 945 | 0% (n=475) |
| Publisher signature | Maven Central | observable | 99% | 0 | 98% (n=350) |
| Registry integrity | npm | observable | 100% | 0 | 100% (n=191) |
| Registry integrity | Go | observable | 100% | 0 | 100% (n=573) |
| SLSA provenance | PyPI | observable | 0% | 0 | 0% (n=238) |
| SLSA provenance | npm | observable | 12% | 0 | 3% (n=191) |
| SLSA provenance | RubyGems | observable | 0% | 0 | 0% (n=475) |
| SLSA provenance | Maven Central | observable | 0% | 0 | 0% (n=350) |
| Source link | PyPI | observable | 21% | 0 | 0% (n=238) |
| Source link | npm | observable | 12% | 0 | 3% (n=191) |
| Source link | crates.io | observable | 7% | 0 | 0% (n=167) |
| Source link | RubyGems | observable | 6% | 0 | 0% (n=475) |
| Source link | Go | inferred | 99% | 14 | 97% (n=573) |
| Source link | Maven Central | observable | 0% | 0 | 0% (n=350) |
| Source link | Packagist | observable | 100% | 0 | 100% (n=457) |
| Transparency log | PyPI | inferred | 21% | 0 | 0% (n=238) |
| Transparency log | npm | inferred | 12% | 0 | 3% (n=191) |
| Transparency log | RubyGems | observable | 6% | 0 | 0% (n=475) |
| Transparency log | Go | observable | 100% | 0 | 100% (n=573) |
| Transparency log | Maven Central | observable | 0% | 0 | 0% (n=350) |
| MFA enforced | PyPI | inferred | 97% | 33 | 50% (n=238) |
| MFA enforced | npm | inferred | 0% | 997 | 1% (n=191) |
| MFA enforced | RubyGems | observable | 31% | 0 | 14% (n=475) |

### Trust-signal adoption among random active packages, latest version (snapshot 20261025-1832Z)

| | Identity-bound publish | Publisher signature | Registry integrity | SLSA provenance | Source link | Transparency log | MFA enforced |
|---|---|---|---|---|---|---|---|
| **PyPI** | ≥ 21% (209/988) [19–24%] | 21% (209/988) [19–24%] | — no mechanism | 0% (0/988) [0–0%] | 21% (209/988) [19–24%] | 21% (209/988) [19–24%] | ≥ 97% (955/988) [95–98%] · mandatory |
| **npm** | 11% (105/1000) [9–13%] | 12% (122/1000) [10–14%] | 100% (1000/1000) [100–100%] · mandatory | 12% (122/1000) [10–14%] | 12% (122/1000) [10–14%] | 12% (122/1000) [10–14%] | ≥ 0% (3/1000) [0–1%] |
| **crates.io** | 7% (72/1000) [6–9%] | — no mechanism | — no mechanism | — no mechanism | 7% (72/1000) [6–9%] | — no mechanism | — no mechanism |
| **RubyGems** | ≥ 12% (115/1000) [10–14%] | ≥ 6% (55/1000) [4–7%] | — no mechanism | 0% (0/1000) [0–0%] | 6% (55/1000) [4–7%] | 6% (55/1000) [4–7%] | 31% (310/1000) [28–34%] |
| **Go** | — no mechanism | — no mechanism | 100% (999/999) [100–100%] · mandatory | — no mechanism | ≥ 99% (985/999) [98–99%] | 100% (999/999) [100–100%] · mandatory | — no mechanism |
| **Maven Central** | — no mechanism | 99% (994/1000) [99–100%] · mandatory | — no mechanism | 0% (0/1000) [0–0%] | 0% (0/1000) [0–0%] | 0% (0/1000) [0–0%] | — no mechanism |
| **Packagist** | — no mechanism | — no mechanism | — no mechanism | — no mechanism | 100% (988/988) [100–100%] | — no mechanism | — no mechanism |

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
