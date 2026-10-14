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
bun run cli --help
```

## Layout

| Path | Role |
|---|---|
| `src/cli.ts` | citty commands for the five stages, `run` and `status` |
| `src/stages/` | rank → fetch → extract → aggregate → report |
| `src/adapters/` | one per registry: ranking, the requests `fetch` makes, and parsing into versions and signals |
| `src/extract/` | registry-independent helpers: quarter anchors, version rules, signal construction |
| `src/facts/` | curated tables: availability classes, registry policies, baseline, Sigstore, post-quantum |
| `src/sources/` | the source registry, citations and quote matching |
| `src/http/` | the shared client (ky for retries, p-queue for per-host pacing), the response cache, transports |
| `src/report/` | labels and the SVG charts (Observable Plot, rendered headlessly through linkedom) |
| `src/db/` | Drizzle schema, migrations runner, zod validation |
| `sources/` | archived sources and their manifest (committed) |
| `data/out/` | report output per snapshot (committed; the results site is built from it) |
| `.github/workflows/pages.yml` | builds and deploys the results site |
| `docs/` | methodology, registry reference, this file, and the generated source list |

## Running the pipeline

Everything in one go (all seven ecosystems, a new snapshot):

```sh
bun run cli run --n 50
```

Or stage by stage. Each stage can be re-run on its own and is keyed by snapshot id:

```sh
bun run cli rank      --ecosystem pypi,npm --n 50
bun run cli fetch     --snapshot <id>     # omit --snapshot to continue the latest
bun run cli extract   --snapshot <id>
bun run cli aggregate --snapshot <id>
bun run cli report    --snapshot <id>
```

`fetch` is the only stage that touches the network, and it skips anything already cached, so an
interrupted run resumes for free. `extract` is pure, so parsers can be refined and re-run offline
without re-hitting any registry.

### Long runs

A full run is rate-limited by design (crates.io at 1 req/s) and takes a while. On a laptop, keep the
machine awake (`caffeinate -i bun run cli run --n 50` on macOS). If it sleeps mid-run, requests fail
with connection errors and are recorded as `fetch_error`. Re-running `fetch --snapshot <id>` retries
exactly those.

### Interactive prompts

The CLI prompts only when it is attached to a TTY *and* a needed choice was not given on the command
line (for example, which snapshot to continue when several exist). Under `CI=1` or a pipe it always
takes the non-interactive default, so a scheduled run cannot block on a prompt.

## Output

Results land in `data/out/<snapshot>/`:

| File | Contents |
|---|---|
| `README.md` | Landing page: every chart in reading order, linking to the tables and CSVs |
| `summary.md` | Coverage, error rate, headline numbers |
| `matrix.md` / `matrix.csv` | Ecosystem × signal adoption table (paste-ready) |
| `scores.csv`, `score_series.csv` | Trust summary score per ecosystem (overall and per category), and over time |
| `timeseries.csv` | Signal adoption per quarter |
| `baseline.md` / `baseline.csv` | Registry baseline (ecosystem-level properties) |
| `sigstore.md` / `sigstore.csv` | Which registries accept Sigstore bundles, who verifies them, nearest equivalents |
| `pqc.md` / `pqc.csv` | Post-quantum exposure of each mechanism, per ecosystem |
| `policies.md` / `policies.csv` | Governance (namespaces, confusable names, upload scanning) and containment (yank, deletion, advisories) |
| `withdrawals.csv` | Per package: versions yanked, unpublished, deprecated or retracted, with the version numbers |
| `packages.csv` | The sampled packages |
| `signals.csv` | Every signal with its evidence, rule (`signal_source`) and the responses it was read from |
| `charts/*.svg` | Charts: trust matrix, scores, publish authentication, registry baseline, governance and containment, withdrawals, Sigstore, post-quantum exposure, adoption per signal |

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

In the repository settings, Pages must be set to deploy from GitHub Actions.

## Configuration

Set in a git-ignored `.env`, which Bun loads automatically (see [`.env.example`](../.env.example)):

| Variable | Effect |
|---|---|
| `PKG_TRUST_CONTACT` | Contact address appended to the User-Agent |
| `PKG_TRUST_UA` | Replaces the whole User-Agent |
| `PKG_TRUST_TRANSPORT` | `fetch` or `curl`, overriding the automatic choice |
| `PKG_TRUST_DATA_DIR` | Where the database, cache and output live (default `data`) |

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

`bun run sources --refresh` re-fetches everything; a quote that no longer matches means the page changed
and the claim needs re-checking. A page that moved should get its new URL in the registry, not a redirect.

## HTTP

[`src/http/client.ts`](../src/http/client.ts) is the only way adapters reach the network. ky retries
transient statuses and honours `Retry-After`; a p-queue per host enforces the request rate and concurrency
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

Raw responses are gzipped under `data/cache/` and git-ignored (as is `data/trust.sqlite`), because npm packuments alone run to
hundreds of megabytes per snapshot. `data/cache/manifest.jsonl` *is* committed. It records the URL,
sha256, byte size, HTTP status and fetch time of every response, so integrity can be verified without
the payloads.

## Test fixtures

Fixtures are real registry responses with personal data removed: email addresses are replaced by
`redacted@example.invalid`, and npm's per-user star lists are dropped.
[`scripts/capture-fixtures.ts`](../scripts/capture-fixtures.ts) (`bun run fixtures`) applies the same
redaction on every capture.
