### Trust-signal adoption among top packages, latest version (snapshot 20261025-1832Z)

| | Identity-bound publish | Publisher signature | Registry integrity | SLSA provenance | Source link | Transparency log | MFA enforced |
|---|---|---|---|---|---|---|---|
| **PyPI** | ≥ 44% (222/500) [40–49%] | 44% (222/500) [40–49%] | — no mechanism | 0% (0/500) [0–1%] | 41% (205/500) [37–45%] | 44% (222/500) [40–49%] | ≥ 94% (470/500) [92–96%] · mandatory |
| **npm** | 34% (170/500) [30–38%] | 34% (170/500) [30–38%] | 100% (500/500) [99–100%] · mandatory | 34% (170/500) [30–38%] | 34% (170/500) [30–38%] | 34% (170/500) [30–38%] | ≥ 79% (395/500) [75–82%] |
| **crates.io** | 16% (79/500) [13–19%] | — no mechanism | — no mechanism | — no mechanism | 16% (79/500) [13–19%] | — no mechanism | — no mechanism |
| **RubyGems** | ≥ 22% (112/500) [19–26%] | ≥ 16% (78/500) [13–19%] | — no mechanism | 0% (0/500) [0–1%] | 16% (78/500) [13–19%] | 16% (78/500) [13–19%] | 24% (121/500) [21–28%] |
| **Go** | — no mechanism | — no mechanism | 100% (500/500) [99–100%] · mandatory | — no mechanism | ≥ 68% (341/500) [64–72%] | 100% (500/500) [99–100%] · mandatory | — no mechanism |
| **Maven Central** | — no mechanism | 95% (476/500) [93–97%] · mandatory | — no mechanism | 0% (0/500) [0–1%] | 0% (2/500) [0–1%] | 0% (2/500) [0–1%] | — no mechanism |
| **Packagist** | — no mechanism | — no mechanism | — no mechanism | — no mechanism | 100% (498/499) [99–100%] | — no mechanism | — no mechanism |

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
