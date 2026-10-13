# Development

How to run the pipeline, what it produces, and how the database is organised. For what is measured
and why, see [methodology.md](methodology.md).

## Commands

```sh
bun install
bun test              # unit tests, no network
bun run typecheck
bun run cli status    # snapshots, cache and coverage
bun run probe:tls     # which registry hosts negotiate post-quantum TLS (needs OpenSSL ≥ 3.5)
bun run cli --help
```

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
| `summary.md` | Coverage, error rate, headline numbers |
| `matrix.md` / `matrix.csv` | Ecosystem × signal adoption table (paste-ready) |
| `scores.csv`, `score_series.csv` | Trust summary score per ecosystem, and over time |
| `timeseries.csv` | Signal adoption per quarter |
| `baseline.md` / `baseline.csv` | Registry baseline (ecosystem-level properties) |
| `sigstore.md` / `sigstore.csv` | Which registries accept Sigstore bundles, who verifies them, nearest equivalents |
| `pqc.md` / `pqc.csv` | Post-quantum exposure of each mechanism, per ecosystem |
| `policies.md` / `policies.csv` | Governance (namespaces, confusable names, upload scanning) and containment (yank, deletion, advisories) |
| `withdrawals.csv` | Per package: versions yanked, unpublished, deprecated or retracted, with the version numbers |
| `packages.csv` | The sampled packages |
| `signals.csv` | Every signal with its evidence and source |
| `charts/*.svg` | Charts: trust matrix, scores, publish authentication, registry baseline, governance and containment, withdrawals, Sigstore, post-quantum exposure, adoption per signal |

## Configuration

Set in a git-ignored `.env`, which Bun loads automatically (see [`.env.example`](../.env.example)):

| Variable | Effect |
|---|---|
| `PKG_TRUST_CONTACT` | Contact address appended to the User-Agent |
| `PKG_TRUST_UA` | Replaces the whole User-Agent |

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

## Cache

Raw responses are gzipped under `data/cache/` and git-ignored, because npm packuments alone run to
hundreds of megabytes per snapshot. `data/cache/manifest.jsonl` *is* committed. It records the URL,
sha256, byte size, HTTP status and fetch time of every response, so integrity can be verified without
the payloads.

## Test fixtures

Fixtures are real registry responses with personal data removed: email addresses are replaced by
`redacted@example.invalid`, and npm's per-user star lists are dropped.
[`scripts/capture-fixtures.ts`](../scripts/capture-fixtures.ts) (`bun run fixtures`) applies the same
redaction on every capture.
