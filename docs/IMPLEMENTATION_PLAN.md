# Implementation Plan — Cross-Ecosystem Package Trust Signal Scraper

**Project:** Seminar Software Supply Chain Security (WiSe 26/27) — "How can I trust my software package managers?"
**Status:** plan approved, pre-flight (§8 of the spec) largely resolved against live APIs on 2026-08-17.
**Stack:** Bun 1.3 + TypeScript + `bun:sqlite`, no build step, no native modules.

---

## 1. Decisions taken

| Decision | Choice |
|---|---|
| Signal representation | Three-state (`true` / `false` / `unknown`) + a `signal_availability` table, so "0% adoption" and "registry doesn't expose it" are visibly different |
| Signal taxonomy | **Five dimensions** (§3), not two booleans |
| Time dimension | Latest version **+ quarterly backfill to 2024-01** → adoption curves from a single snapshot |
| Ecosystems | **Seven**: PyPI, npm, crates.io, RubyGems, Go, Maven Central, Packagist |
| Sampling frame | Downloads where published; **dependents for Go and Maven** (neither publishes download counts anywhere) |
| Sample size | Pilot **N=50** across all seven, then scale to **N=250** (1,750 packages) |
| Runtime / storage | Bun + `bun:sqlite` + TypeScript |
| Raw cache | Gzipped, git-ignored, with a committed `manifest.jsonl` of URL + sha256 + size + timestamp |
| Repeat runs | Manual CLI, but headless + idempotent + snapshot-keyed so a cron workflow can be switched on later |
| Outputs | CSV + paste-ready Markdown matrix + generated SVG charts |

---

## 2. Pre-flight results (spec §8) — verified against live APIs

All seven ecosystems have a **confirmed working ranking source and a confirmed signal extraction path**. This retires the spec's stated implementation risk before any pipeline code is written.

| Ecosystem | Signal endpoint & field | Verified against |
|---|---|---|
| **PyPI** | `GET /simple/{p}/` with `Accept: application/vnd.pypi.simple.v1+json` → `files[].provenance` (URL or `null`) | non-null: `sigstore`, `cryptography`, `urllib3`, `requests`; null: `ruff` |
| **npm** | `GET /{p}` (full packument) → `versions[v].dist.attestations.{url, provenance.predicateType}` | `sigstore@5.0.0` has it; `chalk@6.0.0` does not |
| **crates.io** | `GET /api/v1/crates/{c}/versions` → `trustpub_data: {provider, repository, run_id, sha}` | populated: `bon`, `cargo-semver-checks`, `uv-build`; null: `serde`, `tracing` |
| **RubyGems** | **No trusted-publishing field exists.** But `metadata.rubygems_mfa_required` is present **per version** | Ruby Central's own `trusted_publishing_test` gem exposes no TP field in v1 or v2 API |
| **Go** | `sum.golang.org/lookup/{mod}@{ver}` (HTTP 200 = in transparency log); `proxy.golang.org/{mod}/@latest` → `Origin: {VCS, URL, Ref, Hash}` | `github.com/gorilla/mux@v1.8.1` |
| **Maven Central** | solrsearch `core=gav` → per-version `ec[]` file-extension array; `.sigstore.json` present ⇒ Sigstore | `dev.sigstore:protobuf-specs` has `.jar.sigstore.json`; `guava` does not |
| **Packagist** | No signing or attestation mechanism exists — version objects carry no signature field | `monolog/monolog` version keys inspected |

### Three findings that changed the design

1. **Trusted publishing and attestation are different signals, and no registry exposes both.** crates.io reports trusted publishing directly but has no attestation scheme at all; PyPI and npm report attestations, from which trusted publishing is only *inferred*. A single `has_trusted_publishing` column is not comparable across ecosystems — hence the five-dimension taxonomy.

2. **RubyGems trusted publishing is not auditable via public API.** Ruby Central's own test gem for the feature exposes no flag. Per the spec's own framing this is a legitimate, citable finding, not a collection failure. Compensating discovery: `rubygems_mfa_required` is per-version, so MFA-enforcement adoption is itself backfillable into a trend line — a signal the spec did not anticipate having at all.

3. **Maven's `ec` array is unreliable for GPG.** `guava`'s `ec` omitted `.asc` even though `guava-33.4.8-jre.jar.asc` returns HTTP 200, while `dev.sigstore`'s `ec` listed it. `ec` content varies by publisher and era. **Therefore:** treat `ec` as a positive signal for `.sigstore.json` only, and confirm `.asc` with an explicit `HEAD` to `repo1.maven.org`.

### Remaining M0 items

- Confirm PEP 740 attestations on PyPI can *only* be issued via Trusted Publishing (governs whether `provenance` ⇒ `identity_publish = true` or `unknown`).
- Confirm `dist.signatures` is universal on npm (observed on both a provenance and a non-provenance package ⇒ likely registry-wide signing, not a differentiator).
- Confirm RubyGems has no artifact-signing scheme at all.
- Capture current 2FA/MFA policy text + effective dates for all seven, with citations, for `ecosystem_facts`.

---

## 3. Signal taxonomy

Five dimensions, each three-state per package-version:

| id | Meaning |
|---|---|
| `identity_publish` | Published via OIDC / trusted publishing — no long-lived API token |
| `artifact_signature` | A cryptographic signature over the artifact (GPG, Sigstore, registry signing) |
| `build_provenance` | Attestation linking artifact → source commit → builder (SLSA / in-toto) |
| `transparency_log` | Inclusion in a public append-only log (Go sumdb, Sigstore Rekor) |
| `mfa_enforced` | MFA required for the publishing account |

Per-signal value ∈ `true` | `false` | `unknown`.
Per-ecosystem availability ∈ `observable` | `inferred` | `not_exposed` | `no_mechanism`, plus a `mandatory` flag.

This is what stops Maven (mandatory GPG, ~100%) and Go (mandatory transparency log, ~100%) from scoring a misleading zero, and it lets Packagist's `no_mechanism` read as a substantive result rather than missing data.

**Expected availability matrix** (to be filled authoritatively in M7 with citations):

| | identity_publish | artifact_signature | build_provenance | transparency_log | mfa_enforced |
|---|---|---|---|---|---|
| PyPI | inferred | observable | **observable** | inferred | mandatory |
| npm | inferred | observable (universal) | **observable** | inferred | tiered policy |
| crates.io | **observable** | no_mechanism | no_mechanism | no_mechanism | policy |
| RubyGems | not_exposed | verify (likely none) | not_exposed | no_mechanism | **observable** |
| Go | n/a (no accounts) | no_mechanism | partial (`Origin` VCS ref) | **observable, mandatory** | n/a |
| Maven | not_exposed | **observable, mandatory** | observable (Sigstore) | inferred | not_exposed |
| Packagist | no_mechanism | no_mechanism | no_mechanism | no_mechanism | not_exposed |

---

## 4. Data model (`data/trust.sqlite`)

```
snapshots(snapshot_id PK, started_at, finished_at, tool_version, config_json)

ecosystem_facts(ecosystem PK, display_name, registry_url,
                mandates_2fa, mfa_policy_note,
                trusted_publishing_ga_date, trusted_publishing_mechanism,
                notes, sources)                       -- hand-curated, cited

signal_availability(ecosystem, signal_id PK,
                    availability,                     -- observable|inferred|not_exposed|no_mechanism
                    mandatory, detection_method, notes)

packages(snapshot_id, ecosystem, package_name PK,
         rank_frame,                                  -- 'downloads' | 'dependents'
         rank, download_count, dependent_count,
         latest_version, latest_publish_date,
         maintainer_count, maintainer_count_source,
         repository_url, fetch_timestamp, fetch_error)

package_versions(snapshot_id, ecosystem, package_name, version PK,
                 published_at, is_latest, quarter_anchor,   -- '2024Q1' …
                 raw_response_path, raw_sha256)

version_signals(snapshot_id, ecosystem, package_name, version, signal_id PK,
                value,                                -- true|false|unknown
                evidence,                             -- e.g. the provenance URL, trustpub repo
                signal_source)                        -- endpoint + JSON path
```

`version_signals` is deliberately **tidy/long format**: one row per version per signal. Five nullable wide columns would be awkward to aggregate and impossible to extend; long format makes the maturity matrix a single `GROUP BY` and lets a sixth signal be added without a migration.

Every signal row is traceable to an endpoint + JSON path (`signal_source`) and to a byte-exact cached response (`raw_sha256`), which is what makes the paper's methodology section defensible.

---

## 5. Per-ecosystem fetch plan

Cost is quoted per package for the **full quarterly backfill**, not just the latest version.

| Ecosystem | Ranking | Signal + history fetch | Cost |
|---|---|---|---|
| **PyPI** | `hugovk/top-pypi-packages` (verified live, 15,000 rows) | `/simple/{p}/` returns every file of every version with `provenance` | **1 call** |
| **npm** | ecosyste.ms seed → `api.npmjs.org/downloads/point/last-month/{≤128 names}` for authoritative counts | Full packument: `versions[*].dist`, `time{}`, `maintainers` | 1 call, **multi-MB** (`react` = 6.9 MB) |
| **crates.io** | `/api/v1/crates?sort=downloads&per_page=100` | `/crates/{c}/versions?per_page=100` (paginate) + `/owners` | 2–5 calls |
| **RubyGems** | ecosyste.ms `sort=downloads` (verified) → confirm via `/gems/{g}.json` | `/api/v1/versions/{g}.json` = all versions w/ per-version metadata; + `/owners.json` | 3 calls |
| **Go** | ecosyste.ms `proxy.golang.org` `sort=dependent_packages_count` (verified) | `@v/list`, `@latest`, `@v/{ver}.info`, + `sum.golang.org/lookup/` per anchor | 2 + 2/anchor |
| **Maven** | ecosyste.ms `repo1.maven.org` `sort=dependent_packages_count` (verified) | solrsearch `core=gav` (all versions + `ec` in one call) + **HEAD `.asc`** per anchor | 1 + 1/anchor |
| **Packagist** | `explore/popular.json` (verified) | `/packages/{v}/{p}.json` = downloads, maintainers, all versions | **1 call** |

**Known per-ecosystem gotchas to handle explicitly:**

- **Go module path escaping** — uppercase letters escape to `!lowercase` in proxy URLs (`github.com/BurntSushi/toml` → `github.com/!burnt!sushi/toml`). Silent wrong-package fetches if missed.
- **npm scoped names** — `@scope/name` must be URL-encoded as `@scope%2Fname` and cannot be used raw as a filename.
- **Maven coordinates** — `groupId:artifactId`, not a single string; needs its own identifier type throughout.
- **PyPI name normalisation** — PEP 503 (lowercase, runs of `-_.` → `-`) before hitting the Simple API.
- **npm `maintainers`** is only on the full packument, not the abbreviated one; the abbreviated form also lacks `time`, which the backfill needs — so full packuments are mandatory.
- **PyPI has no maintainer list.** `/pypi/{p}/json` gives only free-text `author_email` / `maintainer_email`. Record `maintainer_count = NULL` with `maintainer_count_source = 'unavailable'` rather than parsing emails into a fake number.

---

## 6. Architecture

Five stages, each independently re-runnable, each keyed by `snapshot_id`:

```
rank → fetch → extract → aggregate → report
```

- **rank** — per ecosystem, produce candidates + counts → `data/rankings/{ecosystem}_{snapshot}.json`.
- **fetch** — network-only. Writes gzipped raw responses + appends to `manifest.jsonl`. Skips anything already cached with a matching sha256, so an interrupted run resumes for free.
- **extract** — **pure, no network.** Reads the cache, writes `packages` / `package_versions` / `version_signals`. Re-runnable in seconds as parsers are refined, which is the whole point of never discarding raw responses.
- **aggregate** — the ecosystem × signal maturity matrix, plus adoption-over-time series from the quarterly anchors.
- **report** — `summary.md` with counts fetched, error rate, coverage and headline numbers, for at-a-glance sanity checking of each run.

### HTTP client (the one component worth building carefully)

Everything else is adapters; this is the shared risk.

- Per-host **token bucket** with per-host concurrency caps. crates.io publishes a crawler policy demanding a descriptive User-Agent with contact info and roughly ≤1 req/s — comply exactly.
- User-Agent: `pkg-trust-scraper/0.1 (SSCS Seminar WiSe 26/27; +https://github.com/danielgnth/expert-octo-carnival)`
- Exponential backoff on 429/5xx, **honouring `Retry-After`**.
- Content-addressed cache write: gzip body, sha256 it, record `{url, sha256, bytes, http_status, fetched_at, ecosystem, package}` in `manifest.jsonl`.
- Distinguish "fetched, 404" (a fact — record it) from "failed to fetch" (an error — record `fetch_error`). Never let a missing field silently become `false`.

### Adapter interface

```ts
interface EcosystemAdapter {
  id: EcosystemId;
  rankFrame: 'downloads' | 'dependents';
  rank(n: number, http: HttpClient): Promise<Candidate[]>;
  fetch(pkg: Candidate, http: HttpClient): Promise<void>;   // network only, writes cache
  extract(pkg: Candidate, cache: Cache): ExtractedPackage;  // pure
}
```

Seven implementations of one interface. The pilot proves the interface on PyPI before the other six are written.

---

## 7. Repository layout

```
src/
  cli.ts                    # bun run src/cli.ts <stage> --ecosystem <id> --n <N>
  http/{client,cache,ratelimit}.ts
  db/{schema.sql,open.ts,queries.ts}
  adapters/{pypi,npm,crates,rubygems,go,maven,packagist}.ts
  extract/signals.ts        # shared three-state logic + quarter-anchor selection
  aggregate/{matrix,timeseries}.ts
  report/{summary,charts}.ts
  types.ts
data/
  cache/{ecosystem}/{slug}/{urlhash}.json.gz    # git-ignored
  cache/manifest.jsonl                          # committed — integrity record
  rankings/{ecosystem}_{snapshot}.json          # committed
  trust.sqlite                                  # committed
  out/{snapshot}/{matrix.md,packages.csv,signals.csv,summary.md,charts/*.svg}
docs/
  IMPLEMENTATION_PLAN.md
  preflight.md              # M0 findings + citations
  methodology.md            # paste-ready methodology section for the paper
test/fixtures/              # small committed real responses, per ecosystem
```

Cache paths use a filesystem-safe slug plus a URL hash — this sidesteps npm scoped names, Go module paths and Maven coordinates all at once, while staying human-browsable.

**Raw cache is git-ignored, `manifest.jsonl` is committed.** Gzipped npm packuments alone would be a few hundred MB per snapshot and a second snapshot doubles it. The manifest gives reviewers byte-exact integrity verification and lets `extract` be re-derived offline; if the paper needs the raw corpus available, it ships as a release asset or archive upload rather than as git history.

---

## 8. Milestones

| # | Deliverable | Exit criterion |
|---|---|---|
| **M0** | `docs/preflight.md` + test fixtures | Remaining §2 items confirmed; 2FA policy text cited for all seven |
| **M1** | Bun skeleton: schema, HTTP client, cache, manifest, CLI | `bun test` green on the client; cache hit/miss and resumability demonstrated |
| **M2** | PyPI rank + fetch, N=20 | Interrupt mid-run, resume, zero re-fetches |
| **M3** | PyPI extract + aggregate + charts | Matrix + adoption curve render; format judged paper-ready |
| **M4** | crates.io + npm | The two richest signals (`trustpub_data`, `dist.attestations`) land end-to-end |
| **M5** | RubyGems + Packagist | The two negative-finding ecosystems; `not_exposed` vs `no_mechanism` renders correctly |
| **M6** | Go + Maven | Dependents sampling frame; module-path escaping and `.asc` HEAD both handled |
| **M7** | `ecosystem_facts` + `signal_availability` curated | Every row cited to a primary source |
| **M8** | Pilot run, N=50 × 7 | Error rate < 5%; results reviewed for plausibility before scaling |
| **M9** | Full run, N=250 × 7 | 1,750 packages; final CSV + matrix + charts + summary |
| **M10** | *(later)* second snapshot | Trend datapoint; cheap because fetch skips warm cache |

M2 uses PyPI first deliberately: one call per package returns the entire version history *with* signals, so it is the cheapest ecosystem on which to prove caching, resumability, quarter-anchor selection and the matrix output format.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| npm packument volume (~1.4 GB uncompressed at N=250) | Gzip on write; stream-parse; npm is the only ecosystem with this profile |
| ecosyste.ms is a third-party intermediary for 3 of 7 ranking sources | Used only to *seed candidate lists*; authoritative counts come from each registry where they exist. Label clearly in the methodology section |
| Go/Maven sampled by dependents, others by downloads | Record `rank_frame` per package row; state the caveat explicitly in the paper. Both frames are reported in the output so the difference is visible, not hidden |
| PyPI/npm trusted publishing is inferred, not observed | Encoded as `availability = 'inferred'` rather than asserted as fact — the inference is visible in the data model itself |
| Registry APIs change shape mid-project | Raw cache + fixture tests mean a shape change is caught by a failing test, and old snapshots stay re-extractable |
| Quarter anchors sparse for slow-moving packages | Anchor = last version published **at or before** each quarter boundary; record `null` where the package did not yet exist |

---

## 10. Extensibility toward Avenue B

The `packages` table already keys on `(ecosystem, package_name)`, which maps directly onto purls. Adding a generated `purl` column (`pkg:pypi/requests`, `pkg:golang/github.com%2Fgorilla%2Fmux`, `pkg:maven/com.google.guava/guava`) makes this dataset a drop-in lookup table for an SBOM blast-radius tool — deps.dev already returns purls for Go, confirming the mapping. One column now, no redesign later. Worth deciding after M9, once the adoption numbers show whether Avenue B is interesting.
