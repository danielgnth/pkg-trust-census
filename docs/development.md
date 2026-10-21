# Development

How to run the pipeline, what it produces, and how the database is organised. For what is measured
and why, see [methodology.md](methodology.md).

## Commands

```sh
bun install
bun test              # unit tests, no network
bun run typecheck
bun run cli status    # snapshots, cache and coverage
bun run sources       # archive sources missing from sources/manifest.json; --refresh re-archives all
bun run probe:tls     # which registry hosts negotiate post-quantum TLS (needs OpenSSL ≥ 3.5)
bun run check:depsdev # deps.dev's attestations against ours, latest snapshot (archived by `bun run sources`)
bun run cli --help
```

## Layout

| Path | Role |
|---|---|
| `src/cli.ts` | citty commands for the five stages, `run` and `status` |
| `src/stages/` | rank → fetch → extract → aggregate → report |
| `src/adapters/` | one per registry: ranking, the requests `fetch` makes, and parsing into versions and signals |
| `src/extract/` | registry-independent helpers: quarter anchors, version rules, signal construction |
| `src/advisories/` | OSV lookups (run by `fetch`, replayed by `extract`), alias grouping, package URLs |
| `src/sample/` | the random draw: seeded shuffle, activity rule, each registry's name list and activity check |
| `src/bigquery/` | deps.dev's BigQuery dataset: client, stored queries, npm/Maven name lists, the whole-registry query |
| `src/publish/` | redaction of personal data, and the publish stage for the cache release |
| `src/facts/` | curated tables: availability classes, registry policies, baseline, Sigstore, post-quantum, advisory method notes |
| `src/sources/` | the source registry, citations and quote matching |
| `src/http/` | the shared client (ky for retries, p-queue for per-host pacing), the response cache, transports |
| `src/report/` | labels, the SVG charts (Observable Plot, rendered headlessly through linkedom), the CycloneDX SBOM, the sample comparison and the whole-registry page |
| `src/db/` | Drizzle schema, migrations runner, zod validation |
| `sources/` | archived sources and their manifest (committed) |
| `data/out/` | report output per snapshot (committed; the results site is built from it) |
| `data/bigquery/` | stored BigQuery results per snapshot (committed; aggregates only) |
| `data/cache/`, `data/names/`, `data/publish/` | responses, draw inputs and the staged cache release, per snapshot (git-ignored) |
| `.github/workflows/pages.yml` | builds and deploys the results site |
| `docs/` | methodology, registry reference, this file, and the generated source list |

## Running the pipeline

Everything in one go (all seven ecosystems, a new snapshot, the top 500 and a random 1000):

```sh
bun run cli run --n 500 --random 1000
```

Or stage by stage. Each stage can be re-run on its own and is keyed by snapshot id:

```sh
bun run cli rank      --ecosystem pypi,npm --n 500
bun run cli rank      --snapshot <id> --layer random --n 1000   # [--seed s], default: the snapshot id
bun run cli fetch     --snapshot <id>     # omit --snapshot to continue the latest
bun run cli extract   --snapshot <id>
bun run cli aggregate --snapshot <id>
bun run cli report    --snapshot <id>
```

`rank` and `fetch` are the stages that touch the network (`registry` and `publish --upload` aside), and
both skip anything already cached, so an interrupted run resumes for free. After each package's registry
responses, `fetch` asks OSV about that package's versions. `extract` is pure, so parsers can be refined and
re-run offline without re-hitting any registry.

### Long runs

A full run is rate-limited by design (crates.io at 1 req/s) and takes hours. The pilot (*N* = 50) made about
5,700 requests, some 16 per package; the top 500 and a random 1000 come to about 170,000, plus the draws'
activity checks. The slowest host, RubyGems at 2 per second, takes three to four hours. On a laptop, keep the
machine awake (`caffeinate -i bun run cli run --n 500 --random 1000` on macOS). If it sleeps mid-run, requests
fail with connection errors and are recorded as `fetch_error`. Re-running `fetch --snapshot <id>` retries
exactly those.

The random draw downloads its inputs once per snapshot into `data/names/{snapshot}/`: PyPI's project list
(45 MB), Packagist's (12 MB), the crates.io dump (2 GB) and the RubyGems dump (680 MB), and it crawls Go's
module index over the 36-month window, month by month, four months at a time, which still takes hours.
Each is stored with its sha256 and reused on a restart, and each month of the Go crawl resumes from its own
cursor. The draw itself is seeded, so a restarted `rank` repeats it with cache hits. The rank stage writes
each layer's sample in one transaction, so an interrupted draw leaves no partial sample.

Maven Central enforces consumption limits on its heaviest users and lowers them over time. A run that
meets HTTP 429 there backs off as `Retry-After` asks. When retries run out during `fetch`, the packages are
recorded as `fetch_error` and fetched later by re-running `fetch`; during the draw's activity checks, `rank`
stops and is re-run later, continuing from the cache.

### Interactive prompts

The CLI prompts only when it is attached to a TTY *and* a needed choice was not given on the command
line (for example, which snapshot to continue when several exist). Under `CI=1` or a pipe it always
takes the non-interactive default, so a scheduled run cannot block on a prompt.

## Output

Results land in `data/out/<snapshot>/`:

| File | Contents |
|---|---|
| `README.md` | Landing page: every chart in reading order, linking to the tables and CSVs |
| `random/` | The same files for the random sample, when the snapshot has one |
| `layers.md` / `layers.csv` | Top against random sample, every share with its interval; overlap; the draw per registry |
| `random/draw.json` | The draw record: seed, name lists with their sha256, every rejected name and why |
| `registry.md` / `registry.csv` | Whole-registry Sigstore attestations from deps.dev, by quarter (after `cli registry`) |
| `requests.json` | Responses per host and status, and the sha256 of the full manifest published with the cache |
| `summary.md` | Coverage, error rate, headline numbers |
| `matrix.md` / `matrix.csv` | Ecosystem × signal adoption table (paste-ready) |
| `scores.csv`, `score_series.csv` | Trust summary score per ecosystem (overall and per category), and over time |
| `timeseries.csv` | Signal adoption per quarter |
| `baseline.md` / `baseline.csv` | Registry baseline (ecosystem-level properties) |
| `sigstore.md` / `sigstore.csv` | Which registries accept Sigstore bundles, who verifies them, nearest equivalents |
| `pqc.md` / `pqc.csv` | Post-quantum exposure of each mechanism, per ecosystem |
| `policies.md` / `policies.csv` | Governance (namespaces, confusable names, upload scanning) and containment (yank, deletion, advisories) |
| `withdrawals.csv` | Per package: versions yanked, unpublished, deprecated or retracted, with the version numbers |
| `advisories.md` / `advisories.csv` | Known advisories (OSV): exposure, known then and now, malware reports, database lag; every match with its purl and dates |
| `sbom.cdx.json` | CycloneDX 1.6 SBOM: the latest version of every sampled package and the vulnerabilities known for it |
| `packages.csv` | The sampled packages |
| `signals.csv` | Every signal with its evidence, rule (`signal_source`) and the responses it was read from |
| `charts/*.svg` | Charts: trust matrix, scores, publish authentication, registry baseline, governance and containment, withdrawals, known advisories, Sigstore, post-quantum exposure, adoption per signal |

## Results site

The newest snapshot is published to GitHub Pages at <https://danielgnth.github.io/pkg-trust-census/>,
together with the docs. Registries would rate-limit or block a CI runner, so the pipeline runs locally and
its output is committed; CI only renders it. To publish a run:

```sh
bun run cli run --n 50
git add data/out/<snapshot> && git commit
```

Keep only the latest snapshot in `data/out/`; git history has the older ones. On every push that touches
`data/out/` or `docs/`, [`pages.yml`](../.github/workflows/pages.yml) copies the snapshot with the
highest id and `docs/*.md` into one folder and builds it with Material for MkDocs. The site's config and
styles are written by the workflow, so the repository holds no site files. While staging, it pastes each
chart's SVG in place of its `![](charts/….svg)` link, so the marks keep their hover titles. Links out of
the site, such as `../src/…` or the source archives, point at the files on GitHub for that commit.

A random sample's pages (`random/`) and the comparison (`layers.md`) join the site's navigation when the
snapshot has them; links between site pages stay on the site.

In the repository settings, Pages must be set to deploy from GitHub Actions.

## Configuration

Set in a git-ignored `.env`, which Bun loads automatically (see [`.env.example`](../.env.example)):

| Variable | Effect |
|---|---|
| `PKG_TRUST_CONTACT` | Contact address appended to the User-Agent |
| `PKG_TRUST_UA` | Replaces the whole User-Agent |
| `PKG_TRUST_TRANSPORT` | `fetch` or `curl`, overriding the automatic choice |
| `PKG_TRUST_DATA_DIR` | Where the database, cache and output live (default `data`) |
| `PKG_TRUST_GCP_PROJECT` | Google Cloud project that runs BigQuery queries (npm/Maven name lists, `cli registry`) |
| `PKG_TRUST_BQ_MAX_GIB` | Bytes one BigQuery query may bill, in GiB (default 100) |

## Database

Drizzle ORM over `bun:sqlite`. [`src/db/schema.ts`](../src/db/schema.ts) is the single source of truth.
Migrations in [`drizzle/`](../drizzle) are generated from it and applied automatically on open.

```sh
bun run db:generate   # after editing src/db/schema.ts
bun run db:studio     # browse the data
```

Writes are guarded twice. [`src/db/validation.ts`](../src/db/validation.ts) derives zod schemas from the
Drizzle tables via `drizzle-zod`, so column types cannot drift. It also adds the rules SQL cannot
express: timestamp formats, quarter labels (`2024Q1`), sha256 shape, and cross-field consistency such
as *a row sampled by downloads must carry a download count*. CHECK constraints in the schema enforce
the enum domains and non-negative counts at the database level.

Both layers earn their place. A CHECK violation reports only `SQLITE_CONSTRAINT_CHECK`, with no
indication of which of several thousand rows was at fault. The zod layer names the package and the
field. The constraints remain as the backstop for any future caller that writes without the helpers.

## Sources

Every claim in `src/facts/` cites a source by id with the passage it rests on:

```ts
cite("npmUnpublishPolicy", "Once `package@version` has been used, you can never use it again.")
```

To add or change a claim:

1. Add the URL to [`src/sources/registry.ts`](../src/sources/registry.ts) if it is new. This file is the
   only place a source URL may appear. Prefer primary sources; for behaviour defined by code, link the file
   on GitHub (`/blob/` links are archived as raw files).
2. `bun run sources` archives it to `sources/archive/` and records the access time and sha256 in
   `sources/manifest.json`. It also regenerates [`docs/sources.md`](sources.md).
3. Copy the supporting passage from the archived file into `cite(...)`. Whitespace, Markdown links and
   emphasis, typographic quotes and case are ignored when matching; the words must be the source's.
4. `bun test` checks that every quote is in its archive, every source is archived and cited, and no
   source URL appears outside the registry.

Archived text has email addresses replaced (`redactEmails`); the manifest's sha256 is the original
response's. Archives committed before this redaction still carry addresses in git history.

`bun run sources --refresh` re-fetches everything; a quote that no longer matches means the page changed
and the claim needs re-checking. A page that moved should get its new URL in the registry, not a redirect.

## HTTP

[`src/http/client.ts`](../src/http/client.ts) is the only way adapters reach the network. ky retries
transient statuses (POST too: it is only used for OSV queries) and honours `Retry-After`; a p-queue per host enforces the request rate and concurrency
in `HOST_POLICIES` (crates.io: one request per second, as its crawler policy asks). Every response goes
through the cache, and `extract` replays from the cache alone.

Bun's `fetch` cannot traverse an HTTPS CONNECT proxy, which sandboxed environments often use. When
`HTTPS_PROXY` is set, a curl-backed transport is used instead; `PKG_TRUST_TRANSPORT=fetch|curl` pins the
choice.

## Charts

[`src/report/charts.ts`](../src/report/charts.ts) draws the figures with Observable Plot, rendered without a
browser through linkedom. `figure()` adds the title, legend and notes, which Plot would render as HTML.
Colours are plain hex attributes so the SVGs convert to PDF for LaTeX; every mark carries a `<title>` with
its exact numbers.

## Cache

Raw responses are gzipped under `data/cache/{snapshot}/` and git-ignored (as is `data/trust.sqlite`), because
npm packuments alone run to hundreds of megabytes per snapshot. Each snapshot has its own
`manifest.jsonl`, recording the URL, sha256, byte size, HTTP status and fetch time of every response; a
snapshot never reads another's responses. A POST is keyed `POST {url} {sha256 of the body}` and its entry
keeps the body (`requestBody`). The manifest is append-only, written by one serialised writer, and a
truncated last line from an interrupted run is skipped. It is not committed: the report writes
`requests.json` with its sha256 and per-host counts, and the manifest is published with the cache release.

## Publishing the cache

```sh
bun run cli publish --snapshot <id>            # stage in data/publish/<id>/ and check
bun run cli publish --snapshot <id> --upload   # then create or update the GitHub release cache-<id>
```

The stage redacts every response (`PERSONAL_DATA` in each adapter, plus `src/publish/redact.ts`), stops if a
listed field or an address survives, extracts the snapshot from both caches into scratch databases and stops
unless they agree, then packs one `cache-{ecosystem}.tar.gz` per registry beside `manifest.jsonl` (redacted)
and `manifest.original.jsonl`. GitHub caps release assets at 2 GiB each, with no limit on a release's total,
and the stage checks the cap. `--upload` runs `gh release create`, or `gh release upload --clobber` when the
release exists; it needs `gh auth login`. To rebuild a snapshot from a release, unpack every archive into one
folder with `manifest.jsonl` and run `bun run cli extract --snapshot <id> --cache <folder>`.

A new adapter must list its responses' personal fields in `PERSONAL_DATA`; the publish stage fails on any
address it leaves, but only the list catches names and handles.

## BigQuery

deps.dev's dataset is the one source read behind a login. Setup, once:

```sh
gcloud auth login                       # or application-default credentials
echo PKG_TRUST_GCP_PROJECT=<project> >> .env
```

The BigQuery sandbox needs no billing account. It grants 1 TiB of processed data a month and 10 GiB of
storage, and its tables expire after 60 days, so nothing is stored there. Queries read one partition of
`PackageVersions` (1–7 GB each, never the unpruned `…Latest` views), are dry-run first (an estimate that can
read 0 for a partition-filtered query), and run with `maximumBytesBilled` (`PKG_TRUST_BQ_MAX_GIB`). Each result is stored in a JSON file with its SQL, parameters,
deps.dev snapshot, bytes processed and job id, keyed by the hash of SQL, parameters and snapshot; a rerun
reuses it. Aggregates go to `data/bigquery/{snapshot}/` (committed); the npm and Maven name lists, which are
row-level, stay in `data/names/` (git-ignored), because deps.dev states no licence for the data. The dataset's
Analytics Hub listing, where public datasets state their terms, is visible only in the Cloud console.

```sh
bun run cli registry --snapshot <id>    # the whole-registry layer, then `report`
```

## Test fixtures

Fixtures are real registry responses with personal data removed by the same redaction as the published cache
(fields that name people, then email addresses). [`scripts/capture-fixtures.ts`](../scripts/capture-fixtures.ts)
(`bun run fixtures`) applies it on every capture.
