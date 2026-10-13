# pkg-trust-census

**How widely do package registries actually use their trust mechanisms?**

This tool measures how many of the top packages in seven ecosystems use trusted publishing, signatures,
provenance and related signals. Each run is a reproducible snapshot, with adoption traced back
quarterly to 2024.

Built for the seminar *Software Supply Chain Security* (WiSe 26/27): *"How can I trust my software
package managers?"*

> [!NOTE]
> This project was developed with AI assistance (Claude Code) under the author's direction. Every
> detection rule is documented in the [methodology](docs/methodology.md) and traceable to the registry
> response it was read from, so results can be checked independently. The software is provided as is,
> without warranty. Please verify findings before relying on them.

## What it measures

| | |
|---|---|
| **Ecosystems** | PyPI · npm · crates.io · RubyGems · Go · Maven Central · Packagist |
| **Signals** | identity-bound publish · publisher signature · registry integrity · SLSA provenance · source link · transparency log · MFA enforced |
| **Sample** | top 250 packages per ecosystem (pilot: 50) |
| **Timeline** | quarterly, back to 2024-01 |

Each signal is `true`, `false` or `unknown`. For each ecosystem the census also records whether the
registry exposes the signal at all, because *"0% adoption"* and *"the registry won't tell you"* are
different findings.

## Quick start

Requires [Bun](https://bun.sh).

```sh
bun install
bun test                  # unit tests, no network
bun run cli run --n 50    # all seven ecosystems, end to end
```

Results land in `data/out/<snapshot>/`. Start with `summary.md`. Runs are rate-limited and take a while.
If a run is interrupted, re-running it continues from the cache.

See [docs/development.md](docs/development.md) for running stage by stage, the output files and the
database.

## Etiquette

The tool collects only public metadata from documented public APIs. It uses no authentication, reads
nothing behind a login, and never works around rate limits.

- **Paced requests.** Requests are rate-limited per host and honour `Retry-After`. crates.io is held to
  one request per second, as its crawler policy asks ([`src/http/ratelimit.ts`](src/http/ratelimit.ts)).
- **Identified traffic.** Every request carries a User-Agent naming this project and repository. To add
  a contact address, as registries recommend:
  ```sh
  cp .env.example .env    # then set PKG_TRUST_CONTACT=you@example.org
  ```
- **No personal data.** Test fixtures are real registry responses with email addresses redacted and
  npm's per-user star lists removed.

## Documentation

| Document | Contents |
|---|---|
| [Methodology](docs/methodology.md) | Sampling, version selection, signal definitions, detection rules, limitations |
| [Development](docs/development.md) | CLI stages, output files, database, configuration |
| [Pre-flight findings](docs/preflight.md) | Verified API behaviour per registry, with evidence |
| [Implementation plan](docs/IMPLEMENTATION_PLAN.md) | Architecture, data model, milestones |

## License

[MIT](LICENSE)
