or [browse advisories](/advisories/)

## Tooling

### `cargo-audit`

Audit `Cargo.lock` files for crates with security vulnerabilities.

[Get started](https://github.com/rustsec/rustsec/blob/main/cargo-audit/README.md)

\> cargo audit
    Scanning Cargo.lock for vulnerabilities (4 crate dependencies)
Crate:     lz4-sys
Version:   1.9.3
Title:     Memory corruption in liblz4
Date:      2022-08-25
ID:        RUSTSEC-2022-0051
URL:       https://rustsec.org/advisories/RUSTSEC-2022-0051
Solution:  Upgrade to >=1.9.4
Dependency tree:
lz4-sys 1.9.3
└── crate 0.1.0

error: 1 vulnerability found!
    

### `cargo-deny`

Audit `Cargo.lock` files for crates with security vulnerabilities, limit the usage of particular dependencies, their licenses, sources to download from, detect multiple versions of same packages in the dependency tree and more.

[Get started](https://embarkstudios.github.io/cargo-deny/)

### `cargo-auditable`

Embed the dependency tree into compiled executables, to make production Rust binaries auditable by cargo-audit.

[Get started](https://github.com/rust-secure-code/cargo-auditable)

### `cargo-audit` Github action

Audit changes, schedule dependencies audits and open issues for found vulnerabilities using cargo-audit with the `rust-audit-check` Github action.

[Get started](https://github.com/rustsec/audit-check)

### `cargo-deny` Github action

Audit changes and schedule dependencies audits using cargo-deny with the `cargo-deny-action` Github action.

[Get started](https://github.com/marketplace/actions/cargo-deny)

## Data Interchange

 [![OSV logo](/img/osv-logo-dark.svg)](https://osv.dev/)

[We export all our data to](https://osv.dev/) [Open Source Vulnerabilities](https://osv.dev/) in real time. This enables many other tools, such as [Trivy](https://aquasecurity.github.io/trivy/), to access RustSec advisories.

You can access RustSec advisories in the OSV format either directly as a [zip archive](https://codeload.github.com/rustsec/advisory-db/zip/refs/heads/osv) or using the [OSV API](https://osv.dev/docs/).

 [![GitHub logo](/img/github-logo-dark.svg)](https://github.com/advisories)

The [Github Advisory Database](https://github.com/advisories) imports our advisories and makes them available in its [public API](https://docs.github.com/en/graphql/reference/objects#securityadvisory).

This allows [dependabot](https://docs.github.com/en/code-security/dependabot/dependabot-security-updates/about-dependabot-security-updates) to fix vulnerable dependencies for you by raising pull requests with security updates.

[![Debian logo](/img/debian-logo.svg)](https://rustsec.debian.net)

The [Debian Rust Team](https://rust-team.pages.debian.net/book/) imports our advisories and automatically cross-references them with Debian packages.

Their [Debian Rust Security Tracker](https://rustsec.debian.net) knows which crate versions were used in each binary package and flags packages built with known-vulnerable code.

## About

![](/img/rustsec-logo-square.svg)

The [RustSec Advisory Database](https://github.com/RustSec/advisory-db) is a repository of security advisories filed against Rust crates published via [crates.io](https://crates.io) maintained by the [Rust Secure Code Working Group](https://rust-lang.org/governance/teams/#team-wg-secure-code).
