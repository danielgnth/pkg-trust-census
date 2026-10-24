# pkg-trust-census

This tool measures how many of the top packages in seven ecosystems use trusted publishing, signatures,
provenance and related signals. Each run is a reproducible snapshot, with adoption traced back
quarterly to 2024.

Built for the seminar *Software Supply Chain Security* (WiSe 26/27): *"How can I trust my software
package managers?"*

**Latest results: <https://danielgnth.github.io/pkg-trust-census/>**

> [!NOTE]
> This project was developed with AI assistance (Claude Code) under the author's direction. Every
> detection rule is documented in the [methodology](docs/methodology.md) and traceable to the registry
> response it was read from, and every curated claim quotes an archived [source](docs/sources.md), so
> results can be checked independently. The software is provided as is,
> without warranty. Please verify findings before relying on them.

## What it measures

| | |
|---|---|
| **Ecosystems** | PyPI · npm · crates.io · RubyGems · Go · Maven Central · Packagist |
| **Signals** | identity-bound publish · publisher signature · registry integrity · SLSA provenance · source link · transparency log · MFA enforced |
| **Sample** | top 250 packages per ecosystem (pilot: 50) |
| **Timeline** | quarterly, back to 2024-01 |
| **Advisories** | known vulnerabilities and malware reports per sampled release (OSV), with a CycloneDX SBOM of the sample |

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

Results land in `data/out/<snapshot>/`. Start with its `README.md`. Runs are rate-limited and take a while.
If a run is interrupted, re-running it continues from the cache.

See [docs/development.md](docs/development.md) for running stage by stage, the output files and the
database.

## Etiquette

The tool collects only public metadata from documented public APIs. It uses no authentication, reads
nothing behind a login, and never works around rate limits.

- **Paced requests.** Requests are rate-limited per host and honour `Retry-After`. crates.io is held to
  one request per second, as its crawler policy asks ([`src/http/client.ts`](src/http/client.ts)).
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
| [Registry reference](docs/registries.md) | Which endpoint and field each signal is read from, per registry |
| [Sources](docs/sources.md) | Every source the curated facts cite, with access date and archived copy |
| [Development](docs/development.md) | Layout, CLI stages, output files, sources workflow, database |

## License

[MIT](LICENSE)
