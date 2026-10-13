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

## 6. Note for the extractor (M3)

The M2 fetch produced a preliminary read: **11 of the top 20 PyPI packages** carry a PEP 740 provenance URL
on their newest file (`packaging`, `typing-extensions`, `certifi`, `urllib3`, `idna`, `requests`,
`charset-normalizer`, `cryptography`, `pluggy`, `aiobotocore`, `numpy` — but not `boto3`, `setuptools`,
`botocore`, `cffi`, `pygments`, `pyyaml`, `python-dateutil`, `six`, `pycparser`).

That figure is indicative only, and the extractor must be more careful than the probe was. `files[]` is a flat
list across *all* versions and mixes sdists with wheels, so "the last file" is neither necessarily the latest
version nor representative of it. M3 must group files by version and define explicitly whether a version counts
as attested when *any* or *all* of its files carry provenance — a package can ship an attested sdist alongside
unattested wheels. Record the choice in the methodology section; `signal_source` should name the rule applied.

## 7. Deferred to M7

Registry-wide 2FA/MFA policy text, effective dates and thresholds for all seven ecosystems, each cited to a
primary source, land with the `ecosystem_facts` and `signal_availability` curation milestone. Several
documentation hosts (`docs.pypi.org`, `blog.pypi.org`) are blocked by this environment's egress policy and
will need either an allowlist entry or manual transcription.

Known-but-uncited at time of writing, to be confirmed in M7 rather than relied upon now:
PyPI mandates 2FA for publishing; npm has tiered 2FA tied to download volume; RubyGems has an MFA-required
tier for popular gem owners; Go has no publisher accounts at all so `mfa_enforced` is `n/a` by construction.

## 8. Addendum (2026-10-13): findings from implementing M3–M7

Probes made while writing the extractors. Three of them change earlier findings.

### 8.1 npm trusted publishing is *observable*, not inferred
Versions published through npm trusted publishing carry `versions[v]._npmUser.trustedPublisher =
{id, oidcConfigId}`, e.g. `sigstore@5.0.0`: `{"id":"github","oidcConfigId":"oidc:a123e7c7-…"}`; 4 of
`sigstore`'s 40 versions carry it. This supersedes the claim in §3.5 that "the same asymmetry applies to
npm". On npm, `identity_publish` is read directly, and its absence is a real negative.

### 8.2 RubyGems exposes Sigstore attestations through an undocumented-in-API endpoint
`GET https://rubygems.org/api/v1/attestations/{gem}-{version}.json` returns the Sigstore bundles for a
version (`[]` when it has none; 404 for an unknown gem). The bundle is a `hashedrekord` message signature
with a Fulcio certificate that binds the source repository, commit and workflow. RubyGems.org renders these
as "Provenance" on the gem page. Positive: `rails-8.1.4`, `trusted_publishing_test-0.1.23` (Rekor logIndex
2620824623). Negative: `nokogiri-1.18.10` and its platform build return `[]`.

§3.2's finding still holds for **trusted publishing itself**: no per-version marker exists. But RubyGems is no
longer a negative-finding ecosystem for signing, provenance or transparency logging. Those three are now
measured.

### 8.3 `search.maven.org` is stale; the Maven extraction path changed
On 2026-10-13, solrsearch's newest Guava release was `33.4.8-jre` (2025-04-14), while
`repo1.maven.org/…/guava/maven-metadata.xml` listed `33.7.2-jre` (lastUpdated 2026-09-29). Repeated queries
also began returning non-JSON responses. The index is unusable for current data. Replacement:

- versions: `maven-metadata.xml` (authoritative, in deploy order, undated);
- dates: `HEAD {artifact}-{v}.pom` → `Last-Modified` (Guava 33.4.8: `Mon, 14 Apr 2025 17:25:22 GMT`, which
  matches solr's timestamp);
- signatures: `HEAD {artifact}-{v}.pom.asc` and `.pom.sigstore.json`. The `.pom` is used rather than the
  `.jar` because every artifact has one, including BOMs and other `pom`-packaged artifacts.

Because `ec[]` is no longer read, §3.3's trap is avoided by construction.

`<release>` in `maven-metadata.xml` is the last deployed non-SNAPSHOT, which can be a pre-release
(`org.slf4j:slf4j-api` → `2.1.0-alpha1`). The newest stable entry is used as "latest" instead.

### 8.4 Smaller facts
- **crates.io** `/crates/{c}/versions?sort=date` paginates by `meta.next_page` (seek token). The crate
  endpoint with `?include=default_version` returns `crate.default_version` without the full version list.
  `/owners` mixes `kind: "user"` and `kind: "team"`.
- **Go**: `@v/list` returns tags unordered; `.info` carries `Origin` for 2024-era releases too
  (`testify v1.9.0`). sumdb returns 404 for a version it does not know.
- **npm downloads API**: the bulk form (`/point/last-month/a,b,c`) rejects scoped names; those need one
  request each.
- **Packagist** `popular.json` paginates via `next`, and reports all-time `downloads` alongside an ordering
  that is not by that number (`symfony/deprecation-contracts`, 969M, ranks above `psr/log`, 1.3B).
- **RubyGems 2FA policy** (now cited in `ecosystem_facts`): MFA required for owners of gems above 180M
  downloads since 2022-08-15. **PyPI**: 2FA required for all accounts from 2024-01-01. **npm**: 2FA for local
  publishing and 7-day granular tokens were announced without effective dates, so npm MFA stays
  `not_exposed`. *(Superseded by §10: the plan is dated 2025-09-22, and npm MFA is now `inferred`.)*

## 9. Availability audit (2026-10-13)

Every `no_mechanism` and `not_exposed` cell, re-checked against primary sources. The rule applied: a cell is
**no_mechanism** when the registry offers no way to have the property (for `mfa_enforced`: no way to *require*
MFA for a publish), and **not_exposed** when the mechanism exists but the public API does not say who uses it.

| Cell | Was | Verdict | Evidence |
|---|---|---|---|
| crates · artifact_signature | no_mechanism | **confirmed** | No signing in production. A TUF signing experiment exists (`rf-signing-experiment/tuf-repository`); the 2026-01 and 2026-07 crates.io updates announce none |
| crates · build_provenance | no_mechanism | **confirmed, with a consistency issue** | No attestation format. But `trustpub_data` records repository, run id and commit, the same kind of registry-recorded source link as Go's `Origin`, which *is* counted (§9.1) |
| crates · transparency_log | no_mechanism | **confirmed** | — |
| crates · mfa_enforced | not_exposed | **corrected → no_mechanism** | crates.io has no MFA; GitHub OAuth does not reveal whether 2FA was used; publishing uses API tokens |
| go · identity_publish | no_mechanism | **confirmed** | No publisher accounts |
| go · artifact_signature | no_mechanism | **confirmed for publisher signing, with a consistency issue** | Module authors cannot sign. sum.golang.org is a Google-signed Merkle log of hashes, the same kind of registry-applied integrity statement as npm's `dist.signatures`, which *is* counted (§9.1) |
| go · mfa_enforced | no_mechanism | **confirmed** | No publisher accounts |
| maven · build_provenance | no_mechanism | **wrong** | slsa-github-generator's Maven and Gradle builders publish `{artifactId}-{version}.jar.build.slsa` to Central (`actions/maven/publish/action.yml`). Central does not validate these, but they are detectable by HEAD |
| packagist · identity / signature / provenance | no_mechanism | **confirmed** | Trusted publishing, hosted artifacts and SLSA provenance are a stated long-term direction, not live (Packagist blog, 2026-05-27) |
| packagist · transparency_log | no_mechanism | **confirmed, note added** | A security-event log (ownership, maintainers, version-reference changes) went live 2026-05. It is login-gated (`/transparency-log` redirects to `/login/`) and is not a tamper-evident log of artifacts |
| npm · mfa_enforced | not_exposed | **confirmed** | A per-package "require 2FA" publishing setting exists (npm docs) but does not appear in the packument |
| rubygems · identity_publish | not_exposed | **confirmed** | §3.2 and §8.2 |
| maven · identity_publish | not_exposed | **corrected → no_mechanism** | The Central Portal Publisher API authenticates "via a user token header" only; there is no OIDC option |
| maven · mfa_enforced | not_exposed | **corrected → no_mechanism** | Sonatype account MFA is optional and covers portal login; deployments use user tokens |
| packagist · mfa_enforced | not_exposed | **corrected → no_mechanism** | MFA is optional; mandatory MFA and public MFA status were announced 2026-05-27 and are not live (no MFA field on profiles or in the package JSON, checked 2026-10-13) |

### 9.1 Equivalent mechanisms scored inconsistently
The audit found that the same mechanism, seen in different registries, landed in different cells:

| Mechanism | Where it appears | Currently scored as |
|---|---|---|
| Registry-applied integrity signature | npm `dist.signatures`; Go sum.golang.org signed tree heads | npm: artifact_signature (100%); Go: no mechanism |
| Registry-recorded source commit | Go `.info` `Origin`; crates.io `trustpub_data.sha` | Go: build_provenance (inferred); crates: no mechanism |
| CI-identity Sigstore signature (Fulcio certificate binding repo, workflow, commit; Rekor-logged) | PyPI PEP 740 *publish* attestation; RubyGems attestations; Maven `.sigstore.json`; npm attestations | PyPI and RubyGems: signature + provenance + tlog; Maven: signature + tlog only |
| SLSA provenance statement | npm `dist.attestations.provenance`; PyPI (second accepted predicate); Maven `.jar.build.slsa` | npm: provenance; PyPI: not distinguished from publish attestations; Maven: not measured |

Also: one attestation drives three columns on PyPI and RubyGems (signature, provenance, tlog) and two on npm,
so the columns are not independent measurements.

**Resolution (2026-10-13).** The taxonomy went from five signals to seven, so that each mechanism above
lands in exactly one place:

- **registry_integrity**: npm `dist.signatures` and Go's sum.golang.org. `artifact_signature` now means
  publisher-originated only.
- **build_provenance**: SLSA statements only (npm; PyPI's SLSA predicate, read from the provenance object;
  Maven `.jar.build.slsa`; RubyGems DSSE bundles).
- **source_link**: a commit established by someone other than the uploader's machine. That is a Fulcio
  certificate's source digest (PyPI, RubyGems, Maven Sigstore), crates.io `trustpub_data.sha`, Go `Origin`, or
  Packagist's `source.reference`.

In the pilot, **no PyPI attestation in the top 50 is SLSA**. All are the publish predicate, so PyPI's
SLSA share is 0%, while its source-link share equals its attestation share (64%).

## 10. MFA re-audit (2026-10-13)

Prompted by a third-party summary of registry 2FA policies. Each claim was checked against the primary
source; three of ours were wrong or out of date.

| Cell / fact | Was | Now | Evidence |
|---|---|---|---|
| npm · mfa_enforced | not_exposed | **inferred** | 2FA is required for maintainers of high-impact packages, ">1 million weekly downloads or … more than 500 dependents", from 2022-11-01, with 15 days' notice (GitHub changelog 2022-11-01). Same account-level kind of mandate as PyPI's, which was already counted. Weekly downloads for any past window are public (`api.npmjs.org/downloads/point/{start}:{end}/{pkg}`, scoped names unescaped; verified `@babel/core`, 404 for unknown packages) |
| npm · policy note | "plan announced 2025-12-15" | **2025-09-22** | The cited URL redirects to *Our plan for a more secure npm supply chain*, dated 2025-09-22. Since 2026-07-31, bypass-2FA tokens can no longer manage tokens, maintainers, access or trusted publishing; they lose direct publish in a planned 2027-01 change (GitHub changelog 2026-07-31) |
| packagist · immutable versions | since 2026-05 | **since 2026-07** | The 2026-05-27 post only scheduled it (composer/packagist#1742, merged 2026-06-05); *Immutable Versions on Packagist* (2026-07-07) announces it as live. It fixes version → commit, not archive bytes, which the forge still generates |
| packagist · transparency log | "went live 2026-05" | **exists; date not stated** | The 2026-05-27 post lists it as already in place. Since 2026-07 it also records soft-deletions, recoveries and blocked retags. Still login-gated (`/transparency-log` → 302 `/login/`, checked 2026-10-13) |
| packagist · mfa_enforced | no_mechanism | **confirmed** | MFA events in the log ("in about six months" from 2026-05-27), profile MFA status, MFA for larger packages and for all accounts are all planned, none dated. No MFA marker on `/users/Seldaek/` or in either package JSON. The 2026-08 org-level MFA enforcement is a Private Packagist feature, not Packagist.org |
| crates · mfa_enforced | no_mechanism | **confirmed, note added** | GitHub requires 2FA of code contributors (2023), but crates.io neither checks it nor needs it for token publishing. A per-crate `trustpub_only` flag (forbids token publishing) is on `GET /api/v1/crates/{c}`, current value only |
| rubygems · 180M rule | not applied | **still not applied** | Only all-time download totals exist, so when a gem crossed 180M cannot be dated (methodology, limitation 5) |
| maven, go · mfa_enforced | no_mechanism | **confirmed** | No change |

**npm rule as implemented.** For each kept release published on or after 2022-11-01, one request for the
seven days ending 15 days before its publication day (UTC). More than 1,000,000 ⇒ `true`; otherwise, or
when npm has no count, `unknown`. Releases before 2022-11-01 cost no request and stay `unknown`. The
dependents half of the rule and the earlier top-100 (2022-02-01) and top-500 (2022-05) cohorts are not
reconstructable, which is why the cell is a lower bound.

## 11. RubyGems trusted publishing is inferable (2026-10-13)

rubygems.org rejects an attestation unless the push authenticated with a trusted-publisher token:
`Pusher#verify_sigstore` returns *"Pushing with an attestation requires trusted publishing"* (HTTP 400)
otherwise. The check shipped in the same change that first accepted attestations (rubygems.org#4987,
2024-11-14), and the push path is the only code that creates them (admin actions only repair existing
ones). So a non-empty `/api/v1/attestations/{g}-{v}.json` proves trusted publishing, the same inference as
PyPI's. `rubygems · identity_publish` moves from **not_exposed** to **inferred**; absence stays `unknown`,
since trusted publishing need not emit attestations. §3.2's finding that no *direct* marker exists stands.

## 12. Is maintainer 2FA *enabled* visible anywhere? (2026-10-13)

Where 2FA is optional or only partly enforced, the weaker question is whether a maintainer has it switched
on. No registry answers it publicly:

| Registry | Checked | Result |
|---|---|---|
| Packagist | `/users/{u}/` page, `packages/{p}.json` `maintainers[]` (`name`, `avatar_url` only), `/transparency-log` (302 → login) | **Not yet.** MFA events in the public log were announced for about six months after 2026-05-27, and profile MFA status after that. Re-check from 2026-11 |
| npm | packument `maintainers[]` / `_npmUser` (name, email), `/-/package/{p}/collaborators` (name → permission), `/-/package/{p}/access` (GET 405) | No 2FA field; the per-package "require 2FA" setting is write-only |
| RubyGems | `/api/v1/gems/{g}/owners.json` (`id`, `handle`, `role`), `/api/v1/profiles/{u}.json` (`id`, `handle`), gem and profile pages | No 2FA field. The gem page's "Version published with MFA" is rendered from `rubygems_mfa_required` (`_aside.html.erb`), the policy flag already measured, not whether MFA was used |
| crates.io | `/api/v1/users/{u}`, `/api/v1/crates/{c}/owners` | No 2FA field; GitHub exposes another user's 2FA only to that user's org owners |
| Maven Central | namespace pages | No 2FA field |
| PyPI | user page | Moot: 2FA is mandatory for every account |
| Go | — | No accounts |

## 13. Post-quantum evidence (2026-10-13)

What each cell of `src/facts/pqc.ts` rests on.

**TLS** (`bun run probe:tls`, OpenSSL 3.6.4, offering X25519MLKEM768 first):

| Hosts | Protocol | Group | Certificate |
|---|---|---|---|
| registry.npmjs.org, api.npmjs.org | TLS 1.2 (TLS 1.3 refused: protocol_version alert) | X25519 | ECDSA P-256 |
| pypi.org, files.pythonhosted.org, upload.pypi.org | TLS 1.3 | X25519MLKEM768 | RSA-2048 |
| crates.io, index.crates.io, static.crates.io | TLS 1.3 | X25519MLKEM768 | RSA-2048 |
| rubygems.org, index.rubygems.org | TLS 1.3 | X25519MLKEM768 | RSA-2048 |
| proxy.golang.org, sum.golang.org | TLS 1.3 | X25519MLKEM768 | ECDSA P-256 |
| repo1.maven.org, repo.maven.apache.org, central.sonatype.com | TLS 1.3 | X25519MLKEM768 | ECDSA P-256 |
| packagist.org, repo.packagist.org | TLS 1.3 | X25519MLKEM768 | RSA-2048 |
| api.github.com, codeload.github.com (Packagist archives) | TLS 1.3 | X25519 | ECDSA P-256 |

**Signatures**:

- npm registry key (`/-/npm/v1/keys`): `ecdsa-sha2-nistp256`. It also signs the publish attestation.
- sum.golang.org: signed notes with algorithm byte 0x01, i.e. Ed25519 (`golang.org/x/mod/sumdb/note`).
- Sigstore trusted root (`sigstore/root-signing` `targets/trusted_root.json`): Fulcio root and
  intermediate ECDSA P-384, TSA ECDSA P-384, Rekor `PKIX_ECDSA_P256_SHA_256` and the Rekor v2 shard
  `log2025-1` `PKIX_ED25519`, CT log ECDSA P-256. Leaf certificates in real bundles (PyPI `sigstore`, RubyGems
  `rails`, npm `sigstore@5.0.0`): ECDSA P-256 keys, signed ecdsa-with-SHA384. Sigstore's ML-DSA instance is
  targeted for mid-2027 as a separate trust root (Sigstore blog, 2026-10-02).
- Maven `.pom.asc` on the latest release of the 50 sampled artifacts (signature packet algorithm byte):
  RSA 34, EdDSA 6, ECDSA 5, DSA 4, one 404 (`javax.servlet:servlet-api` 2.5). None uses the RFC 9980
  (2026-06) ML-DSA composites; GnuPG cannot produce them yet.
- Trusted publishing: the OIDC JWKS of GitHub Actions (`token.actions.githubusercontent.com`) and GitLab
  (`gitlab.com/oauth/discovery/keys`) contain only RSA keys, `RS256`.

