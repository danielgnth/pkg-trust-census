## Basic Usage[#](#basic-usage)

The `bun` CLI contains a Node.js-compatible package manager designed to be a dramatically faster replacement for `npm`, `yarn`, and `pnpm`. It's a standalone tool that works in existing Node.js projects; if your project has a `package.json`, you can use `bun install`.

**⚡️ 25x faster** — Switch from `npm install` to `bun install` in any Node.js project to make your installations up to 25x faster.

[![Bun installation speed
comparison](https://user-images.githubusercontent.com/709451/147004342-571b6123-17a9-49a2-8bfd-dcfc5204047e.png)](https://user-images.githubusercontent.com/709451/147004342-571b6123-17a9-49a2-8bfd-dcfc5204047e.png)

To install all dependencies of a project:

`bun install`:

-   **Installs** all `dependencies`, `devDependencies`, and `optionalDependencies`. Bun installs `peerDependencies` by default.
-   **Runs** your project's `{pre|post}install` and `{pre|post}prepare` scripts at the appropriate time. For security reasons Bun _does not execute_ lifecycle scripts of installed dependencies unless they are [trusted](/docs/pm/lifecycle).
-   **Writes** a `bun.lock` lockfile to the project root.

* * *

## Logging[#](#logging)

To modify logging verbosity:

* * *

## Lifecycle scripts[#](#lifecycle-scripts)

Unlike other npm clients, Bun does not execute arbitrary lifecycle scripts like `postinstall` for installed dependencies. Executing arbitrary scripts represents a potential security risk.

To tell Bun to allow lifecycle scripts for a particular package, add the package to `trustedDependencies` in your package.json.

Then re-install the package. Bun reads this field and runs lifecycle scripts for `my-trusted-package`.

Lifecycle scripts run in parallel during installation. To adjust the maximum number of concurrent scripts, use the `--concurrent-scripts` flag. The default is two times the reported cpu count or GOMAXPROCS.

Bun automatically optimizes postinstall scripts for popular packages (like `esbuild` and `sharp`) by determining which scripts need to run. To disable these optimizations:

* * *

## Workspaces[#](#workspaces)

Bun supports `"workspaces"` in package.json. See [workspaces](/docs/pm/workspaces).

* * *

## Installing dependencies for specific packages[#](#installing-dependencies-for-specific-packages)

In a monorepo, you can install the dependencies for a subset of packages using the `--filter` flag.

See [filtering](/docs/pm/filter#bun-install-and-bun-outdated).

* * *

## Overrides and resolutions[#](#overrides-and-resolutions)

Bun supports npm's `"overrides"` and Yarn's `"resolutions"` in `package.json`. Both specify a version range for _metadependencies_, the dependencies of your dependencies. See [overrides and resolutions](/docs/pm/overrides).

* * *

## Global packages[#](#global-packages)

To install a package globally, use the `-g`/`--global` flag. Use it to install command-line tools.

* * *

## Production mode[#](#production-mode)

To install in production mode (without `devDependencies`):

`--production` implies `--frozen-lockfile`. It only controls what gets installed. `devDependencies` already in `node_modules` from an earlier install stay there. Use [`bun prune --production`](/docs/pm/cli/prune) to remove them.

For reproducible installs, use `--frozen-lockfile`. Bun installs the exact versions specified in the lockfile and does not update it. If your `package.json` disagrees with `bun.lock`, Bun exits with an error.

Bun does not enable `--frozen-lockfile` automatically in CI; pass the flag or use `bun ci`. If there is no lockfile at all, `--frozen-lockfile` installs from `package.json` without writing one.

`--frozen-lockfile` works on a pruned monorepo checkout (e.g. `turbo prune` output, or a Docker context with only some workspace folders copied in). If a workspace listed in `bun.lock` is missing its `package.json` on disk, Bun skips it with a `note:` and does not install its exclusive dependencies. If a remaining workspace depends on a skipped one, the install fails.

To validate the lockfile without installing, use `bun install --frozen-lockfile --dry-run`.

### Offline installs[#](#offline-installs)

With a warm cache, `bun install` can run without the network:

`--prefer-offline` is also what `install.prefer = "offline"` in `bunfig.toml` selects; `install.offline = true` is the config form of `--offline`. With a complete restored cache, `--offline --frozen-lockfile` makes a CI install fully deterministic and network-free; `--prefer-offline` still fetches whatever the cache is missing.

An install is only certain to cache the packages that it places in `node_modules`. To warm the cache for an `--offline` install, run an install on the same platform that places at least the same packages. An install with `--production` or `--omit` does not cache the groups it leaves out.

See [lockfile](/docs/pm/lockfile) for more on `bun.lock`.

* * *

## Omitting dependencies[#](#omitting-dependencies)

To omit dev, peer, or optional dependencies, use the `--omit` flag.

* * *

## Dry run[#](#dry-run)

To perform a dry run, without installing anything:

* * *

## Non-npm dependencies[#](#non-npm-dependencies)

Bun supports installing dependencies from Git, GitHub, and local or remotely-hosted tarballs. See [`bun add`](/docs/pm/cli/add).

* * *

## Installation strategies[#](#installation-strategies)

Bun supports two package installation strategies that determine how dependencies are organized in `node_modules`:

### Hoisted installs[#](#hoisted-installs)

The traditional npm/Yarn approach that flattens dependencies into a shared `node_modules` directory:

### Isolated installs[#](#isolated-installs)

A pnpm-like approach that creates strict dependency isolation to prevent [phantom dependencies](/docs/pm/isolated-installs), packages you can import without declaring them in `package.json`:

Isolated installs create a central package store in `node_modules/.bun/` with symlinks in the top-level `node_modules`. This ensures packages can only access their declared dependencies.

### Default strategy[#](#default-strategy)

The default linker strategy depends on whether you're starting fresh or have an existing project:

-   **New workspaces/monorepos**: `isolated` (prevents phantom dependencies)
-   **New single-package projects**: `hoisted` (traditional npm behavior)
-   **Existing projects (made pre-v1.3.2)**: `hoisted` (preserves backward compatibility)

A `configVersion` field in your lockfile controls the default. For a detailed explanation, see [isolated installs](/docs/pm/isolated-installs).

* * *

## Minimum release age[#](#minimum-release-age)

To protect against supply chain attacks where malicious packages are quickly published, you can configure a minimum age requirement for npm packages. Bun filters out package versions published more recently than the specified threshold (in seconds) during installation.

You can also configure this in `bunfig.toml`:

When the minimum age filter is active:

-   It only affects new package resolution; existing packages in `bun.lock` remain unchanged
-   Bun filters all dependencies (direct and transitive) to meet the age requirement when resolving them
-   When the age gate blocks versions, a stability check detects rapid bugfix patterns
    -   If multiple versions were published close together just outside your age gate, Bun extends the filter to skip those potentially unstable versions and selects an older, more mature version
    -   The check searches up to 7 days past the age gate; if releases are still rapid beyond that, Bun ignores the stability check
    -   Exact version requests (like `package@1.1.1`) still respect the age gate but bypass the stability check
-   Bun treats versions without a `time` field as passing the age check (the npm registry should always provide timestamps)

For more advanced security scanning, including integration with services and custom filtering, see the [Security Scanner API](/docs/pm/security-scanner-api).

* * *

## Configuration[#](#configuration)

### Configuring `bun install` with `bunfig.toml`[#](#configuring-bun-install-with-bunfig-toml)

On `bun install`, `bun remove`, and `bun add`, Bun looks for `bunfig.toml` in:

1.  `$XDG_CONFIG_HOME/.bunfig.toml` or `$HOME/.bunfig.toml`
2.  `./bunfig.toml`

If Bun finds both, it loads both. Keys set in the project's `bunfig.toml` override the same keys in the global file.

Configuring with `bunfig.toml` is optional. These are the default values:

### Configuring with environment variables[#](#configuring-with-environment-variables)

Environment variables take priority over `bunfig.toml`.

Name

Description

`BUN_CONFIG_REGISTRY`

Set an npm registry (default: [https://registry.npmjs.org](https://registry.npmjs.org))

`BUN_CONFIG_TOKEN`

Set an auth token for the default registry

`BUN_CONFIG_YARN_LOCKFILE`

Save a Yarn v1-style yarn.lock

`BUN_CONFIG_SKIP_SAVE_LOCKFILE`

Don’t save a lockfile

`BUN_CONFIG_SKIP_LOAD_LOCKFILE`

Don’t load a lockfile

`BUN_CONFIG_SKIP_INSTALL_PACKAGES`

Don’t install any packages

Bun uses the fastest installation method available on the target platform: `clonefile` on macOS and `hardlink` on Linux and Windows. You can change the installation method with the `--backend` flag. When unavailable or on error, `clonefile` and `hardlink` fall back to a platform-specific implementation of copying files.

Bun stores installed packages from npm in `~/.bun/install/cache/${name}@${version}`. If the semver version has a `build` or a `pre` tag, Bun replaces it with a hash of that value. This reduces the chances of errors from long file paths, but complicates figuring out where a package was installed on disk.

When the `node_modules` folder exists, Bun decides whether to install a package by checking that the `"name"` and `"version"` in its `package.json` at the expected `node_modules` location match the expected name and version. It uses a custom JSON parser which stops parsing as soon as it finds `"name"` and `"version"`.

When a `bun.lock` doesn’t exist or `package.json` has changed dependencies, Bun downloads and extracts tarballs eagerly while resolving.

When a `bun.lock` exists and `package.json` hasn’t changed, Bun downloads missing dependencies lazily. If the package with a matching `name` and `version` already exists in the expected location within `node_modules`, Bun doesn’t attempt to download the tarball.

## CI/CD[#](#ci-cd)

Use the official [`oven-sh/setup-bun`](https://github.com/oven-sh/setup-bun) action to install `bun` in a GitHub Actions pipeline:

For CI/CD environments that want to enforce reproducible builds, use `bun ci` to fail the build if the package.json is out of sync with the lockfile:

`bun ci` is equivalent to `bun install --frozen-lockfile`. It installs exact versions from `bun.lock` and fails if `package.json` doesn't match the lockfile. To use `bun ci` or `bun install --frozen-lockfile`, you must commit `bun.lock` to version control.

In your workflow, run `bun ci` instead of `bun install`:

## Platform-specific dependencies?[#](#platform-specific-dependencies)

Bun stores normalized `cpu` and `os` values from npm in the lockfile, along with the resolved packages. It skips downloading, extracting, and installing packages disabled for the current target at runtime. This means the lockfile doesn't change between platforms/architectures even if the packages ultimately installed do change.

### `--cpu` and `--os` flags[#](#cpu-and-os-flags)

You can override the target platform for package selection:

These flags install packages for the specified platform instead of the current system. Use them for cross-platform builds or when preparing deployments for different environments.

**Accepted values for `--cpu`**: `arm`, `arm64`, `ia32`, `mips`, `mipsel`, `ppc`, `ppc64`, `s390`, `s390x`, `x32`, `x64`

**Accepted values for `--os`**: `aix`, `darwin`, `freebsd`, `linux`, `openbsd`, `sunos`, `win32`, `android`

## Peer dependencies?[#](#peer-dependencies)

Bun handles peer dependencies like Yarn: `bun install` installs them automatically. If the dependency is marked optional in `peerDependenciesMeta`, Bun uses an existing dependency if possible.

## Lockfile[#](#lockfile)

`bun.lock` is Bun’s lockfile format. See [our blog post about the text lockfile](https://bun.com/blog/bun-lock-text-lockfile).

Before Bun 1.2, the lockfile was binary and called `bun.lockb`. To upgrade an old lockfile to the new format, run `bun install --save-text-lockfile --frozen-lockfile --lockfile-only`, then delete `bun.lockb`.

## Cache[#](#cache)

To delete the cache:

## Platform-specific backends[#](#platform-specific-backends)

For performance, `bun install` uses different system calls to install dependencies depending on the platform. You can force a specific backend with the `--backend` flag.

**`hardlink`** is the default backend on Linux and Windows. Benchmarking showed it to be the fastest on Linux.

**`clonefile`** is the default backend on macOS. Benchmarking showed it to be the fastest on macOS. It is only available on macOS.

**`clonefile_each_dir`** is similar to `clonefile`, except it clones each file individually per directory. It is only available on macOS and tends to perform slower than `clonefile`. Unlike `clonefile`, `clonefile_each_dir` does not recursively clone subdirectories in one system call.

**`copyfile`** is the fallback used when any of the above fail, and is the slowest. On macOS, it uses `fcopyfile()`; on Linux, it uses `copy_file_range()`.

**`symlink`** is typically only used for `file:` dependencies internally (for example `file:../foo` and transitive `file:` dependencies). `link:` dependencies do not use this backend; Bun installs them as a single symlink to the linked directory.

If you install with `--backend=symlink`, Node.js won't resolve node\_modules of dependencies unless each dependency has its own node\_modules folder or you pass `--preserve-symlinks` to `node` or `bun`. See [Node.js documentation on `--preserve-symlinks`](https://nodejs.org/api/cli.html#--preserve-symlinks).

Bun uses a binary format for caching npm registry responses. This loads much faster than JSON and tends to be smaller on disk. These files live in `~/.bun/install/cache/*.npm`. The filename pattern is `${hash(packageName)}.npm`. It’s a hash so that Bun doesn’t need to create extra directories for scoped packages.

Bun's usage of `Cache-Control` ignores `Age`. This improves performance, but means Bun may be about 5 minutes behind the latest package version metadata from npm.

## pnpm migration[#](#pnpm-migration)

Bun migrates projects from pnpm automatically. When Bun detects a `pnpm-lock.yaml` file and no `bun.lock` file exists, it converts the lockfile to `bun.lock` during installation. The original `pnpm-lock.yaml` file remains unmodified.

Migration only runs when `bun.lock` is absent. There is currently no opt-out flag for pnpm migration.

The migration process handles:

### Lockfile Migration[#](#lockfile-migration)

-   Converts `pnpm-lock.yaml` (lockfile versions 7–9, including pnpm 11's multi-document files) to `bun.lock`
-   Preserves resolved versions and integrity hashes
-   Preserves peer dependency ranges and `peerDependenciesMeta`, so the next `bun install` leaves the migrated lockfile unchanged
-   Migrates git, GitHub, tarball URL, `file:`, and `npm:` alias dependencies, including transitive ones
-   Resolves pnpm named registries (`name@registry:version`) via `namedRegistries` in `pnpm-workspace.yaml`
-   Converts injected workspace packages (`dependenciesMeta.*.injected`) to ordinary workspace dependencies
-   Handles patched dependencies, matching pnpm's hash-only `patchedDependencies` entries to the patch files
-   Skips `runtime:` entries (pnpm-managed Node.js versions) with a warning

### Workspace Configuration[#](#workspace-configuration)

When a `pnpm-workspace.yaml` file exists, Bun migrates workspace settings to your root `package.json`:

Bun moves the workspace packages list and catalogs to the `workspaces` field in `package.json`:

### Catalog Dependencies[#](#catalog-dependencies)

Bun preserves dependencies that use pnpm's `catalog:` protocol:

### Configuration Migration[#](#configuration-migration)

Bun migrates the following pnpm configuration from both `pnpm-lock.yaml` and `pnpm-workspace.yaml`:

-   **Overrides**: Moved from `pnpm.overrides` to root-level `overrides` in `package.json`
-   **Patched Dependencies**: Moved from `pnpm.patchedDependencies` to root-level `patchedDependencies` in `package.json`
-   **Workspace Overrides**: Applied from `pnpm-workspace.yaml` to root `package.json`

### Requirements and limitations[#](#requirements-and-limitations)

-   Requires pnpm lockfile version 7 or higher
-   Workspace packages must have a `name` field in their `package.json`
-   All catalog entries referenced by dependencies must exist in the catalogs definition
-   Every workspace in `pnpm-lock.yaml` must have its `package.json` on disk (in Docker, copy them in before `bun install`)
-   Relative `link:` dependencies and git dependencies with a sub-directory (`resolution.path`) are not supported
-   If migration fails for any of these reasons, Bun prints why and resolves from scratch instead

After migration, you can safely remove `pnpm-lock.yaml` and `pnpm-workspace.yaml` files.

## Yarn migration[#](#yarn-migration)

Bun migrates a `yarn.lock` the same way when no `bun.lock` exists: both Yarn v1 lockfiles and Yarn 2+ ("Berry", the YAML format with a `__metadata` header) are converted to `bun.lock` during `bun install` or `bun pm migrate`, keeping every locked version. The original `yarn.lock` is left in place.

A Yarn Berry lockfile is migrated only when Bun can keep everything it pins. If one package, patch, workspace or dependency cannot be carried over exactly, Bun prints the reason, does not migrate, and resolves from `package.json` instead (`bun pm migrate` exits with an error).

For Yarn Berry lockfiles the migration handles:

-   npm packages, including `npm:` aliases, dist-tags, and per-package tarball URLs (`__archiveUrl`); integrity hashes are taken from the registry, because Berry's `checksum` is a hash of Yarn's own cache archive
-   workspaces (from the root `package.json` `workspaces` globs) and `workspace:` ranges
-   `patch:` dependencies: patches in your project (for example `.yarn/patches`) are added to `patchedDependencies` in `package.json` for npm, git and tarball packages, and `patch:` ranges in `package.json` are rewritten to the plain range they patch; Yarn's builtin compatibility patches are dropped
-   `file:` folders and tarballs, tarball URLs, and git / `github:` dependencies (pinned to the locked commit)
-   `portal:` and `link:` dependencies, which are installed like `file:` dependencies; Bun does not support these protocols in `package.json`, so the ranges are rewritten to `file:` and a warning reports that the folder is now copied instead of linked
-   optional dependencies and peer dependencies (`dependenciesMeta` / `peerDependenciesMeta`), and `conditions` (`os` / `cpu`)
-   `resolutions` in the root `package.json`, applied the way Yarn applies them: the first matching entry wins, and `parent@version/name` names the version the parent is locked to
-   `catalog:` ranges, read from `catalog` / `catalogs` in `.yarnrc.yml` and copied into the `workspaces` object of `package.json`
-   Yarn 2 and 3 lockfiles, which write ranges without quotes (`wrappy: 1`)

Limitations:

-   the `dependencies` that `packageExtensions` in `.yarnrc.yml` add to a package; the extensions built into Yarn are not applied
-   `libc` conditions are ignored, and Yarn settings such as `nodeLinker` and `supportedArchitectures` are not migrated
-   integrity hashes come from the registry manifest; Yarn's `checksum` is not checked

The lockfile is not migrated when it has:

-   a dependency with no lockfile entry (`yarn.lock` is older than `package.json`), or a workspace that the `package.json` `workspaces` globs do not match
-   a registry for Yarn (`npmRegistryServer` or `npmScopes` in a `.yarnrc.yml` of the project, a parent folder or the home folder, or `YARN_NPM_REGISTRY_SERVER`) that is not the registry Bun is configured with for that package, or that is written with an environment variable (`${VAR}`); configure the registry in `bunfig.toml` or `.npmrc` and run the migration again. Yarn fetches the `@jsr` scope from `npm.jsr.io` by default, so that scope needs the same configuration
-   a package whose integrity the registry manifest does not give, for example an `__archiveUrl` on another host
-   a patch that `patchedDependencies` cannot express: several patch files for one package, a patch on a `file:` / `portal:` / `link:` folder, or a patch file outside the project
-   an entry with a protocol Bun does not have (for example `exec:`), or a git dependency on a package inside a repository (`#workspace=`)
-   a dependency of the root `package.json` that has the name of a workspace and that Yarn installed from somewhere else (`enableTransparentWorkspaces: false`); Bun links the workspace under that name
-   a name in both `dependencies` and `devDependencies` when the version Yarn installed for the `devDependencies` range is not in the `dependencies` range, which is the one Bun reads
-   a `__metadata.version` outside 4 to 10, a key written twice, or a YAML merge key (`<<`)

The edits to `package.json` (rewritten ranges, `patchedDependencies`, catalogs) are written when `bun.lock` is saved. A command that does not write `package.json` (`--dry-run`, `--no-save`) does not migrate a lockfile that needs them.

* * *

## CLI Usage[#](#cli-usage)

### General Configuration[#](#general-configuration)

\--configstring

Specify path to config file (bunfig.toml)

\--cwdstring

Set a specific cwd

### Dependency Scope & Management[#](#dependency-scope-management)

\--productionboolean

Don't install devDependencies

\--no-saveboolean

Don't update package.json or save a lockfile

\--savebooleandefault:true

Save to package.json

\--omitstring

Exclude 'dev', 'optional', or 'peer' dependencies from install

\--only-missingboolean

Only add dependencies to package.json if they are not already present

### Dependency Type & Versioning[#](#dependency-type-versioning)

\--devboolean

Add dependency to "devDependencies"

\--optionalboolean

Add dependency to "optionalDependencies"

\--peerboolean

Add dependency to "peerDependencies"

\--exactboolean

Add the exact version instead of the ^ range

### Lockfile Control[#](#lockfile-control)

\--yarnboolean

Write a yarn.lock file (yarn v1)

\--frozen-lockfileboolean

Disallow changes to lockfile

\--save-text-lockfileboolean

Save a text-based lockfile

\--lockfile-onlyboolean

Generate a lockfile without installing dependencies

### Network & Registry Settings[#](#network-registry-settings)

\--castring

Provide a Certificate Authority signing certificate

\--cafilestring

File path to Certificate Authority signing certificate

\--registrystring

Use a specific registry by default, overriding .npmrc, bunfig.toml and environment variables

### Installation Process Control[#](#installation-process-control)

\--dry-runboolean

Resolve dependencies but don't install packages, update package.json, or save a lockfile (the project's own lifecycle scripts still run)

\--forceboolean

Always request the latest versions from the registry & reinstall all dependencies

\--globalboolean

Install globally

\--backendstring

Platform-specific optimizations: "clonefile", "hardlink", "symlink", "copyfile"

\--filterstring

Install packages for the matching workspaces

\--analyzeboolean

Recursively analyze & install all dependencies of files passed as arguments

### Caching Options[#](#caching-options)

\--cache-dirstring

Store & load cached data from a specific directory path

\--no-cacheboolean

Ignore manifest cache entirely

### Output & Logging[#](#output-logging)

\--silentboolean

Don't log anything

\--verboseboolean

Excessively verbose logging

\--no-progressboolean

Disable the progress bar

\--no-summaryboolean

Don't print a summary

### Security & Integrity[#](#security-integrity)

\--no-verifyboolean

Skip verifying integrity of newly downloaded packages

\--trustboolean

Add to trustedDependencies in the project's package.json and install the package(s)

### Concurrency & Performance[#](#concurrency-performance)

\--concurrent-scriptsnumber

Maximum number of concurrent jobs for lifecycle scripts (default: 2x CPU cores)

\--network-concurrencynumberdefault:48

Maximum number of concurrent network requests

### Lifecycle Script Management[#](#lifecycle-script-management)

\--ignore-scriptsboolean

Skip lifecycle scripts for all packages, including the project's package.json and trusted dependencies

### Help Information[#](#help-information)

\--helpboolean

Print this help menu
