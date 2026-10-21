## Keyboard shortcuts

Press ← or → to navigate between chapters

Press S or / to search in the book

Press ? to show this help

Press Esc to hide this help

## [cargo-yank(1)](#cargo-yank1)

## [NAME](#name)

cargo-yank — Remove a pushed crate from the index

## [SYNOPSIS](#synopsis)

`cargo yank` \[_options_\] _crate_@_version_  
`cargo yank` \[_options_\] `--version` _version_ \[_crate_\]

## [DESCRIPTION](#description)

The yank command removes a previously published crate’s version from the server’s index. This command does not delete any data, and the crate will still be available for download via the registry’s download link.

Cargo will not use a yanked version for any new project or checkout without a pre-existing lockfile, and will generate an error if there are no longer any compatible versions for your crate.

This command requires you to be authenticated with either the `--token` option or using [cargo-login(1)](cargo-login.html).

If the crate name is not specified, it will use the package name from the current directory.

### [How yank works](#how-yank-works)

For example, the `foo` crate published version `1.5.0` and another crate `bar` declared a dependency on version `foo = "1.5"`. Now `foo` releases a new, but not semver compatible, version `2.0.0`, and finds a critical issue with `1.5.0`. If `1.5.0` is yanked, no new project or checkout without an existing lockfile will be able to use crate `bar` as it relies on `1.5`.

In this case, the maintainers of `foo` should first publish a semver compatible version such as `1.5.1` prior to yanking `1.5.0` so that `bar` and all projects that depend on `bar` will continue to work.

As another example, consider a crate `bar` with published versions `1.5.0`, `1.5.1`, `1.5.2`, `2.0.0` and `3.0.0`. The following table identifies the versions cargo could use in the absence of a lockfile for different SemVer requirements, following a given release being yanked:

Yanked Version / SemVer requirement

`bar = "1.5.0"`

`bar = "=1.5.0"`

`bar = "2.0.0"`

`1.5.0`

Use either `1.5.1` or `1.5.2`

**Return Error**

Use `2.0.0`

`1.5.1`

Use either `1.5.0` or `1.5.2`

Use `1.5.0`

Use `2.0.0`

`2.0.0`

Use either `1.5.0`, `1.5.1` or `1.5.2`

Use `1.5.0`

**Return Error**

### [When to yank](#when-to-yank)

Crates should only be yanked in exceptional circumstances, for example, an accidental publish, unintentional SemVer breakages, or a significantly broken and unusable crate. In the case of security vulnerabilities, [RustSec](https://rustsec.org/) is typically a less disruptive mechanism to inform users and encourage them to upgrade, and avoids the possibility of significant downstream disruption irrespective of susceptibility to the vulnerability in question.

A common workflow is to yank a crate having already published a semver compatible version, to reduce the probability of preventing dependent crates from compiling.

When addressing copyright, licensing, or personal data issues with a published crate, simply yanking it may not suffice. In such cases, contact the maintainers of the registry you used. For crates.io, refer to their [policies](https://crates.io/policies) and contact them at [redacted@example.invalid](mailto:redacted@example.invalid).

If credentials have been leaked, the recommended course of action is to revoke them immediately. Once a crate has been published, it is impossible to determine if the leaked credentials have been copied. Yanking only prevents Cargo from selecting this version when resolving dependencies by default. Existing lock files or direct downloads are not affected, so yanking cannot stop further spreading of the leaked credentials.

## [OPTIONS](#options)

### [Yank Options](#yank-options)

[`--vers` _version_](#option-cargo-yank---vers)

[`--version` _version_](#option-cargo-yank---version)

The version to yank or un-yank.

[`--undo`](#option-cargo-yank---undo)

Undo a yank, putting a version back into the index.

[`--token` _token_](#option-cargo-yank---token)

API token to use when authenticating. This overrides the token stored in the credentials file (which is created by [cargo-login(1)](cargo-login.html)).

[Cargo config](../reference/config.html) environment variables can be used to override the tokens stored in the credentials file. The token for crates.io may be specified with the `CARGO_REGISTRY_TOKEN` environment variable. Tokens for other registries may be specified with environment variables of the form `CARGO_REGISTRIES_NAME_TOKEN` where `NAME` is the name of the registry in all capital letters.

[`--index` _index_](#option-cargo-yank---index)

The URL of the registry index to use.

[`--registry` _registry_](#option-cargo-yank---registry)

Name of the registry to use. Registry names are defined in [Cargo config files](../reference/config.html). If not specified, the default registry is used, which is defined by the `registry.default` config key which defaults to `crates-io`.

### [Display Options](#display-options)

[`-v`](#option-cargo-yank--v)

[`--verbose`](#option-cargo-yank---verbose)

Use verbose output. May be specified twice for “very verbose” output which includes extra output such as dependency warnings and build script output. May also be specified with the `term.verbose` [config value](../reference/config.html).

[`-q`](#option-cargo-yank--q)

[`--quiet`](#option-cargo-yank---quiet)

Do not print cargo log messages. May also be specified with the `term.quiet` [config value](../reference/config.html).

[`--color` _when_](#option-cargo-yank---color)

Control when colored output is used. Valid values:

-   `auto` (default): Automatically detect if color support is available on the terminal.
-   `always`: Always display colors.
-   `never`: Never display colors.

May also be specified with the `term.color` [config value](../reference/config.html).

### [Common Options](#common-options)

[`+`_toolchain_](#option-cargo-yank-+toolchain)

If Cargo has been installed with rustup, and the first argument to `cargo` begins with `+`, it will be interpreted as a rustup toolchain name (such as `+stable` or `+nightly`). See the [rustup documentation](https://rust-lang.github.io/rustup/overrides.html) for more information about how toolchain overrides work.

[`--config` _KEY=VALUE_ or _PATH_](#option-cargo-yank---config)

Overrides a Cargo configuration value. The argument should be in TOML syntax of `KEY=VALUE`, or provided as a path to an extra configuration file. This flag may be specified multiple times. See the [command-line overrides section](../reference/config.html#command-line-overrides) for more information.

[`-C` _PATH_](#option-cargo-yank--C)

Changes the current working directory before executing any specified operations. This affects things like where cargo looks by default for the project manifest (`Cargo.toml`), as well as the directories searched for discovering `.cargo/config.toml`, for example. This option must appear before the command name, for example `cargo -C path/to/my-project build`.

This option is only available on the [nightly channel](https://doc.rust-lang.org/book/appendix-07-nightly-rust.html) and requires the `-Z unstable-options` flag to enable (see [#10098](https://github.com/rust-lang/cargo/issues/10098)).

[`-h`](#option-cargo-yank--h)

[`--help`](#option-cargo-yank---help)

Prints help information.

[`-Z` _flag_](#option-cargo-yank--Z)

Unstable (nightly-only) flags to Cargo. Run `cargo -Z help` for details.

## [ENVIRONMENT](#environment)

See [the reference](../reference/environment-variables.html) for details on environment variables that Cargo reads.

## [EXIT STATUS](#exit-status)

-   `0`: Cargo succeeded.
-   `101`: Cargo failed to complete.

## [EXAMPLES](#examples)

1.  Yank a crate from the index:
    
    ```
    cargo yank foo@1.0.7
    ```
    

## [SEE ALSO](#see-also)

[cargo(1)](cargo.html), [cargo-login(1)](cargo-login.html), [cargo-publish(1)](cargo-publish.html)

[](../commands/cargo-publish.html "Previous chapter")[](../commands/report-commands.html "Next chapter")

[](../commands/cargo-publish.html "Previous chapter")[](../commands/report-commands.html "Next chapter")
