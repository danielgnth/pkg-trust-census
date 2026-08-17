# M0 — Pre-flight findings

**Run date:** 2026-08-17. All probes made against live public APIs with an identifying User-Agent.

Purpose: retire the spec's §8 unknowns *before* writing the general-case pipeline, and record the exact
endpoint + field for each signal so the extractor can be written against verified shapes rather than guesses.

---

## 1. Signal detection — verified

| Ecosystem | Endpoint | Field | Evidence |
|---|---|---|---|
| PyPI | `GET https://pypi.org/simple/{p}/`<br>`Accept: application/vnd.pypi.simple.v1+json` | `files[].provenance` — URL or `null` | non-null: `sigstore`, `cryptography`, `urllib3`, `requests`<br>null: `ruff` |
| npm | `GET https://registry.npmjs.org/{p}` | `versions[v].dist.attestations.url`<br>`…attestations.provenance.predicateType` | present: `sigstore@5.0.0` (`https://slsa.dev/provenance/v1`)<br>absent: `chalk@6.0.0` |
| crates.io | `GET https://crates.io/api/v1/crates/{c}/versions` | `trustpub_data` → `{provider, repository, run_id, sha}` | populated: `bon@3.9.3`, `cargo-semver-checks@0.50.0`, `uv-build@0.12.5`<br>null: `serde@1.0.229`, `tracing@0.1.44` |
| RubyGems | `GET https://rubygems.org/api/v1/versions/{g}.json` | `metadata.rubygems_mfa_required` (**per version**) | `"true"` on `rails@8.1.3.1` and `trusted_publishing_test@0.1.22` |
| Go | `GET https://sum.golang.org/lookup/{mod}@{ver}`<br>`GET https://proxy.golang.org/{mod}/@latest` | HTTP 200 = in transparency log<br>`Origin: {VCS, URL, Ref, Hash}` | `github.com/gorilla/mux@v1.8.1` returns log entry + tree head; `@latest` returns `Ref: refs/tags/v1.8.1`, `Hash: b4617d0…` |
| Maven Central | `GET https://search.maven.org/solrsearch/select?q=g:{g}+AND+a:{a}&core=gav&wt=json` | `docs[].ec[]` file-extension array | `.jar.sigstore.json` present on `dev.sigstore:protobuf-specs@0.4.3`, absent on `com.google.guava:guava@33.4.8-jre` |
| Packagist | `GET https://packagist.org/packages/{v}/{p}.json` | *(no signature field exists)* | version objects on `monolog/monolog` carry no signing key of any kind |

## 2. Ranking sources — verified

| Ecosystem | Source | Frame | Confirmed |
|---|---|---|---|
| PyPI | `hugovk/top-pypi-packages` `top-pypi-packages.json` | downloads | 15,000 rows, `{project, download_count}` |
| npm | ecosyste.ms seed → `api.npmjs.org/downloads/point/last-month/{≤128 names}` | downloads | bulk endpoint returns per-package counts in one call |
| crates.io | `/api/v1/crates?sort=downloads&per_page=100` | downloads | native |
| RubyGems | ecosyste.ms `rubygems.org?sort=downloads` | downloads | `bundler` = 3.65 B, `aws-sdk-core` = 1.73 B |
| Go | ecosyste.ms `proxy.golang.org?sort=dependent_packages_count` | **dependents** | `golang.org/x/sys` = 179,073 dependents |
| Maven | ecosyste.ms `repo1.maven.org?sort=dependent_packages_count` | **dependents** | `junit:junit` = 97,532 dependents |
| Packagist | `/explore/popular.json` | downloads | native, includes counts |

**Go and Maven Central publish no download counts anywhere** — ecosyste.ms returns `downloads: null` for both
registries. They are sampled by dependent count instead; `packages.rank_frame` records which frame produced
each row so the difference is visible in the data rather than buried in prose.

## 3. Findings that changed the design

### 3.1 Trusted publishing and attestation are never both exposed
crates.io reports trusted publishing directly (`trustpub_data`) but has **no attestation scheme at all**.
PyPI and npm report attestations, from which trusted publishing can only be *inferred*. No registry exposes both.
A single `has_trusted_publishing` boolean is therefore not comparable across ecosystems — replaced by five
three-state signal dimensions plus a `signal_availability` table.

### 3.2 RubyGems trusted publishing is not auditable via public API
Ruby Central's own `trusted_publishing_test` gem — which exists solely to exercise the trusted publishing
workflow — exposes no trusted-publishing field in either the v1 or v2 API. The feature is GA (it has a
permanent entry under "Publishing & Security" in the RubyGems guides), so this is a *deliberate absence of
telemetry*, not an unreleased feature. Per the spec's own framing, "the registry doesn't make this auditable
via public API" is a citable finding.

Compensating discovery: `rubygems_mfa_required` is per-version, so MFA-enforcement adoption is backfillable
into a trend line — a signal the spec assumed was ecosystem-level policy only.

### 3.3 Maven's `ec` array cannot detect GPG signatures at all
`com.google.guava:guava@33.4.8-jre` omits `.asc` from `ec`, yet `guava-33.4.8-jre.jar.asc` returns HTTP 200.

Checking both captured fixtures, the failure is sharper than "unreliable": **neither publisher lists a bare
`.jar.asc` entry.**

| artifact | `.asc`-related `ec` entries |
|---|---|
| `com.google.guava:guava@33.4.8-jre` | *(none)* |
| `dev.sigstore:protobuf-specs@0.4.3` | `.jar.asc.sha256`, `.jar.asc.sha512`, `.pom.asc.sha256`, … (checksums *of* the signature, never the signature) |

So `ec` offers at best a weak proxy (`.asc.sha256` presence), and Guava proves that its absence does not mean
the artifact is unsigned.

**Consequence:** `ec` is a valid positive signal for `.sigstore.json`, but GPG **must** be confirmed with an
explicit `HEAD` for `{artifact}.jar.asc` against `repo1.maven.org`. Trusting `ec` alone would have produced a
false "Maven has no GPG signing" result — the exact kind of silent wrong answer the spec's §6 warns about.

### 3.4 npm `dist.signatures` is universal and therefore not a differentiator
Present on every package checked, including `left-pad@1.3.0` (published 2016, long before npm signing existed)
— the registry signs on serve, so this reflects registry behaviour, not publisher behaviour.

| package | `dist.signatures` | `dist.attestations` |
|---|---|---|
| `lodash@4.17.21` | 1 | no |
| `left-pad@1.3.0` | 1 | no |
| `express@4.18.2` | 1 | no |
| `chalk@6.0.0` | 2 | no |
| `sigstore@5.0.0` | 1 | **yes** |

Only `dist.attestations` carries publisher intent. `dist.signatures` is recorded as an ecosystem-level fact
(registry signing, mandatory, 100%) rather than as a per-package variable.

### 3.5 PyPI attestations imply trusted publishing
PEP 740 specifies a generic attestation format "with the expectation that index providers adopt the format with
a suitable source of identity for signature verification, **such as Trusted Publishing**." PyPI's implementation
uses Trusted Publishing as that identity source, so attestations let a consumer verify a file "was uploaded via a
Trusted Publisher and not some other publishing mechanism (such as a locally-held API token)."

**Consequence for extraction:** on PyPI, `provenance != null` ⇒ `identity_publish = true`.
`provenance == null` ⇒ `identity_publish = **unknown**`, *not* `false` — a project can publish via Trusted
Publishing without emitting attestations. This asymmetry is why `identity_publish` on PyPI is recorded with
`availability = 'inferred'` rather than `'observable'`.

The same asymmetry applies to npm.

## 4. Other API facts worth recording

- **npm abbreviated packuments are unusable for this project.** `Accept: application/vnd.npm.install-v1+json`
  retains `dist.attestations` but drops the `time` object and `maintainers`. The backfill needs publish dates,
  so full packuments are mandatory — and they are large (`react` = 6.9 MB full vs 2.9 MB abbreviated, 2,912 versions).
- **PyPI exposes no maintainer list.** `/pypi/{p}/json` has only free-text `author_email` / `maintainer_email`.
  `maintainer_count` is recorded as `NULL` with `maintainer_count_source = 'unavailable'` rather than derived
  from parsing email strings into a number that would look real but would not be.
- **Owner counts are available** for npm (`maintainers`), crates.io (`/owners`), RubyGems (`/owners.json`) and
  Packagist (`maintainers`).
- **Version array ordering differs by registry.** PyPI's Simple API and npm's `time` map run oldest-first;
  RubyGems' `/versions/{g}.json` runs newest-first. Getting this backwards silently selects the wrong era of a
  package — it was caught here only because a trimmed Rails fixture kept 2005-era versions that predate the
  `rubygems_mfa_required` field. Each adapter must assert its own ordering rather than assume one.
- **Single-call full history** is available for PyPI (Simple API returns every file of every version with its
  `provenance`), RubyGems (`/versions/{g}.json`), Maven (solrsearch `core=gav`) and Packagist. This makes the
  quarterly backfill nearly free for four of seven ecosystems.

## 5. Environment finding: Bun's `fetch` cannot traverse an HTTPS CONNECT proxy

Discovered while capturing fixtures. In a sandbox that routes egress through an HTTPS CONNECT proxy, Bun's
`fetch` fails with *"The socket connection was closed unexpectedly"* for every host **not** on the proxy
bypass list. The bypassed hosts (pypi.org, registry.npmjs.org, proxy.golang.org) worked; crates.io,
rubygems.org, sum.golang.org, search.maven.org and packagist.org all failed — 5 of 13 fixtures captured.

Ruled out as causes:

| Hypothesis | Result |
|---|---|
| Missing CA trust | `NODE_EXTRA_CA_CERTS` and `SSL_CERT_FILE` already point at the bundle; setting them explicitly changes nothing |
| Bun ignores `HTTPS_PROXY` env | Passing `fetch(url, { proxy })` explicitly also fails |
| Registry-side rejection | curl to the same URLs returns 200 in ~0.6 s |
| Runtime-independent | Node 22 with `NODE_USE_ENV_PROXY=1` returns 200 |
| `node:http` CONNECT tunnel as a workaround | Fails with *"fetch() URL is invalid"* — Bun implements `node:http` over its own fetch, so it inherits the defect |

**Resolution:** HTTP access sits behind a `Transport` interface (`src/http/transport.ts`).
`FetchTransport` is the default; `CurlTransport` shells out to curl, which reads `HTTPS_PROXY` and the
system CA store natively, and is selected automatically when `HTTPS_PROXY` is set. `PKG_TRUST_TRANSPORT=fetch|curl`
pins the choice for a reproduction run. The full test suite passes under both.

This affects **only** sandboxed/proxied environments — on an ordinary developer machine `fetch` is used and
nothing changes. The abstraction is worth having regardless, since it makes the client testable without a network.

Two incidental notes from the same investigation:

- **crates.io enforces its crawler policy.** A request without a descriptive User-Agent returns HTTP 403 with
  `{"errors":[{"detail":"We are unable to process your request..."}]}`. The identifying UA is not merely polite,
  it is required.
- **`Bun.spawn` rejects arguments containing literal newlines**, so curl's `-w` format string passes `\n`
  escapes for curl itself to expand.

## 6. Deferred to M7

Registry-wide 2FA/MFA policy text, effective dates and thresholds for all seven ecosystems, each cited to a
primary source, land with the `ecosystem_facts` and `signal_availability` curation milestone. Several
documentation hosts (`docs.pypi.org`, `blog.pypi.org`) are blocked by this environment's egress policy and
will need either an allowlist entry or manual transcription.

Known-but-uncited at time of writing, to be confirmed in M7 rather than relied upon now:
PyPI mandates 2FA for publishing; npm has tiered 2FA tied to download volume; RubyGems has an MFA-required
tier for popular gem owners; Go has no publisher accounts at all so `mfa_enforced` is `n/a` by construction.
