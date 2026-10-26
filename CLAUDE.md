# pkg-trust-census

Census of trust-signal adoption across seven package registries, for a seminar paper. Bun + TypeScript,
no build step. Read [docs/methodology.md](docs/methodology.md) before changing what is measured, and
[docs/development.md](docs/development.md) for layout and workflow.

```sh
bun test              # must pass before any commit
bun run typecheck
bun run sources       # archive new sources (see below)
```

## Sources: every claim cites an archived, quoted source

- **Every source URL lives in [`src/sources/registry.ts`](src/sources/registry.ts) and nowhere else.** Facts,
  reports, scripts and docs refer to sources by id. Never paste a source URL into `src/facts/`, a comment or
  a doc; add it to the registry and cite the id. `test/sources.test.ts` fails on a duplicated source URL.
- **A citation quotes the passage it rests on**: `cite("sourceId", "verbatim passage")`. Copy the passage
  from the archived file under `sources/archive/`, never from memory or a search snippet. The test checks it
  against the archive (whitespace, Markdown and case are ignored; the words are not).
- **After adding a source, run `bun run sources`.** It archives the page with its access time and sha256 in
  `sources/manifest.json` and regenerates `docs/sources.md`. Commit `sources/` with the change.
- **Prefer primary sources**: the registry's own docs, blog or code, a PEP or RFC. For behaviour defined by
  code, cite the file in the registry's or client's repository.
- **If a source does not support a claim, change the claim**, or find a source that does. Do not weaken
  the quote until it matches. If a source contradicts a fact, fix the fact and say so.
- **When a page moves**, update its URL in the registry and re-archive; do not cite the redirect.
- Registry API endpoints the adapters read data from are not sources and stay in the adapters.
- Our own measurements (e.g. `scripts/probe-pq-tls.ts`) are sources too: a registry entry with a `command`,
  whose output is archived.

## Conventions

- **Use a library before writing one.** HTTP goes through `src/http/client.ts` (ky for retries, p-queue for
  per-host pacing), charts through Observable Plot (`src/report/charts.ts`), CSV through csv-stringify,
  versions through `semver` / `@renovatebot/pep440`, repository URLs through `hosted-git-info`.
- **Three-state signals.** `unknown` is never converted to `false`; an absent mechanism is `no_mechanism`,
  not `0%`.
- **Polite traffic.** Identify with the User-Agent, keep `HOST_POLICIES`, never work around rate limits or
  bot challenges, read nothing behind a login. The one exception is deps.dev's BigQuery dataset
  (`src/bigquery/`, a Google login): every query runs under `maximumBytesBilled`, is stored with its SQL and
  deps.dev snapshot, and only aggregates are committed: deps.dev's own data is CC-BY 4.0 (credit deps.dev
  wherever it is used), but package names and attestations it aggregates stay under the registries' terms.
- **`extract` is offline.** Every request an adapter needs goes through `fetch`, so `extract` can replay it
  from the cache.
- **Nothing published names a person.** The repository and the cache releases are public. Fixtures, archived
  sources and the published cache go through `src/publish/redact.ts`: each adapter lists the response fields
  that name people in `PERSONAL_DATA` (a new adapter must), and email addresses are replaced everywhere.
  `bun run cli publish` refuses to pack a cache whose redacted copy changes a signal or still names someone.
- **Docs describe the current state**, not its history (git has that). When behaviour changes, update
  `docs/methodology.md` and `docs/registries.md` in the same change.
