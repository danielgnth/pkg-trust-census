# pkg-trust-scraper

Cross-ecosystem package trust signal scraper.
Seminar Software Supply Chain Security (WiSe 26/27) — *"How can I trust my software package managers?"*

Measures how widely trust and attestation mechanisms are actually adopted across seven package
registries, as a reproducible point-in-time snapshot with an adoption-over-time backfill.

| | |
|---|---|
| **Ecosystems** | PyPI, npm, crates.io, RubyGems, Go, Maven Central, Packagist |
| **Signals** | identity-bound publish · artifact signature · build provenance · transparency log · MFA enforcement |
| **Sample** | top 250 per ecosystem (pilot: 50) |
| **Backfill** | quarterly anchors to 2024-01, derived from a single snapshot |
| **Stack** | Bun + TypeScript + Drizzle ORM over `bun:sqlite`, no build step, no native modules |

## Documents

- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — architecture, data model, milestones
- [`docs/preflight.md`](docs/preflight.md) — verified API findings (M0), with evidence

## Quick start

```sh
bun install
bun test              # unit tests, no network
bun run cli status    # snapshots, cache and coverage
bun run cli --help
```

Pipeline stages, each independently re-runnable and keyed by snapshot id:

```sh
bun run cli rank      --ecosystem pypi --n 50
bun run cli fetch     --snapshot <id>     # omit --snapshot to continue the latest
bun run cli extract   --snapshot <id>
bun run cli aggregate --snapshot <id>
bun run cli report    --snapshot <id>
```

`fetch` is the only stage that touches the network, and it skips anything already cached — an
interrupted run resumes for free. `extract` is pure, so parsers can be refined and re-run offline
without re-hitting any registry.

The CLI prompts only when it is attached to a TTY *and* a needed choice was not given on the command
line (for example, which snapshot to continue when several exist). Under `CI=1` or a pipe it always
takes the non-interactive default, so a scheduled run cannot block on a prompt.

### Database

Drizzle ORM over `bun:sqlite`. [`src/db/schema.ts`](src/db/schema.ts) is the single source of truth;
migrations in [`drizzle/`](drizzle) are generated from it and applied automatically on open.

```sh
bun run db:generate   # after editing src/db/schema.ts
bun run db:studio     # browse the data
```

Writes are guarded twice. [`src/db/validation.ts`](src/db/validation.ts) derives zod schemas from the
Drizzle tables via `drizzle-zod`, so column types cannot drift, and layers on the rules SQL cannot
express — timestamp formats, quarter labels (`2024Q1`), sha256 shape, and cross-field consistency such
as *a row sampled by downloads must carry a download count*. CHECK constraints in the schema enforce
the enum domains and non-negative counts at the database level.

Both layers earn their place: a CHECK violation reports only `SQLITE_CONSTRAINT_CHECK` with no
indication of which of several thousand rows was at fault, whereas the zod layer names the package and
the field. The constraints remain as the backstop for any future caller that writes without the helpers.

## Why five signals instead of two

The obvious data model — a `has_trusted_publishing` boolean and a `has_provenance_attestation`
boolean — does not survive contact with the registries:

- **crates.io** reports trusted publishing directly (`trustpub_data`) but has no attestation scheme at all.
- **PyPI and npm** report attestations, from which trusted publishing can only be *inferred*.
- **Maven Central** mandates GPG signing (~100% adoption) and has no OIDC equivalent.
- **Go** mandates transparency-log inclusion for every module and has no publisher accounts at all.
- **Packagist** has no mechanism of any kind.
- **RubyGems** has trusted publishing, but does not expose adoption through its public API.

Two booleans would score Maven and Go at zero, which is precisely backwards. So each package-version
is scored on five dimensions, each three-state (`true` / `false` / `unknown`), alongside a
`signal_availability` table recording whether a given ecosystem makes a given signal
`observable`, `inferred`, `not_exposed`, or `no_mechanism`.

That distinction is the point: **"0% adoption" and "the registry will not tell you" are different
findings**, and the second one is itself a result worth reporting.

## Reproducibility

Every row in the output traces to an endpoint plus JSON path (`signal_source`) and to a byte-exact
cached response (`raw_sha256`).

Raw responses are gzipped under `data/cache/` and **git-ignored** — npm packuments alone run to
hundreds of megabytes per snapshot. `data/cache/manifest.jsonl` **is** committed: it records the URL,
sha256, byte size, HTTP status and fetch time of every response, so integrity is verifiable and the
extract stage is re-derivable offline without the payloads.

A failed fetch is recorded as `fetch_error`, and a missing field as `unknown`. Neither is ever
silently converted into `false`.

## Etiquette

All data is public metadata from documented public APIs. No authentication, no scraping behind auth,
no rate-limit circumvention.

Requests are paced per host, identify the project and a contact address, and honour `Retry-After`.
crates.io publishes a crawler policy asking for roughly one request per second with an identifying
User-Agent; that limit is configured in [`src/http/ratelimit.ts`](src/http/ratelimit.ts).

Override the contact string with `PKG_TRUST_UA` if you re-run this yourself — please do not send
requests carrying someone else's email address.
