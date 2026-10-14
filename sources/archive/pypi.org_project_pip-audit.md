[![CI](https://pypi-camo.freetls.fastly.net/eeda06a6eb5e5312f8bcb48313fd009ce81175fd/68747470733a2f2f6769746875622e636f6d2f707970612f7069702d61756469742f776f726b666c6f77732f43492f62616467652e737667)](https://github.com/pypa/pip-audit/actions/workflows/ci.yml) [![PyPI version](https://pypi-camo.freetls.fastly.net/b76476516c933259d0ed91316501de44b6e595c1/68747470733a2f2f62616467652e667572792e696f2f70792f7069702d61756469742e737667)](https://pypi.org/project/pip-audit) [![Packaging status](https://pypi-camo.freetls.fastly.net/fc3628eaf75430990e11754535765e831e0d177f/68747470733a2f2f7265706f6c6f67792e6f72672f62616467652f74696e792d7265706f732f707974686f6e3a7069702d61756469742e737667)](https://repology.org/project/python:pip-audit/versions) [![OpenSSF Scorecard](https://pypi-camo.freetls.fastly.net/01eb3328997519cad8a35d93802aec66757561b9/68747470733a2f2f6170692e736563757269747973636f726563617264732e6465762f70726f6a656374732f6769746875622e636f6d2f707970612f7069702d61756469742f6261646765)](https://api.securityscorecards.dev/projects/github.com/pypa/pip-audit) [![License](https://pypi-camo.freetls.fastly.net/3c2aefdda6201daf2a47e53c72de329149d3dc3f/68747470733a2f2f696d672e736869656c64732e696f2f6769746875622f6c6963656e73652f707970612f7069702d6175646974)](https://github.com/pypa/pip-audit/blob/main/LICENSE)

`pip-audit` is a tool for scanning Python environments for packages with known vulnerabilities. It uses the Python Packaging Advisory Database ([https://github.com/pypa/advisory-database](https://github.com/pypa/advisory-database)) via the [PyPI JSON API](https://warehouse.pypa.io/api-reference/json.html) as a source of vulnerability reports.

This project is maintained in part by [Trail of Bits](https://www.trailofbits.com/) with support from Google. This is not an official Google or Trail of Bits product.

## Index[](#user-content-index)

-   [Features](#user-content-features)
-   [Installation](#user-content-installation)
    -   [Third-party packages](#user-content-third-party-packages)
    -   [GitHub Actions](#user-content-github-actions)
    -   [`pre-commit` support](#user-content-pre-commit-support)
-   [Usage](#user-content-usage)
    -   [Environment variables](#user-content-environment-variables)
    -   [Exit codes](#user-content-exit-codes)
    -   [Dry runs](#user-content-dry-runs)
-   [Examples](#user-content-examples)
-   [Troubleshooting](#user-content-troubleshooting)
-   [Tips and Tricks](#user-content-tips-and-tricks)
-   [Security model](#user-content-security-model)
-   [Licensing](#user-content-licensing)
-   [Contributing](#user-content-contributing)
-   [Code of Conduct](#user-content-code-of-conduct)

## Features[](#user-content-features)

-   Support for auditing local environments and requirements-style files
-   Support for multiple vulnerability services ([PyPI](https://warehouse.pypa.io/api-reference/json.html#known-vulnerabilities), [OSV](https://osv.dev/docs/))
-   Support for emitting [SBOMs](https://en.wikipedia.org/wiki/Software_bill_of_materials) in [CycloneDX](https://cyclonedx.org/) XML or JSON
-   Support for automatically fixing vulnerable dependencies (`--fix`)
-   Human and machine-readable output formats (columnar, Markdown, JSON)
-   Seamlessly reuses your existing local `pip` caches

## Installation[](#user-content-installation)

`pip-audit` requires Python 3.10 or newer, and can be installed directly via `pip`:

python \-m pip install pip-audit

### Third-party packages[](#user-content-third-party-packages)

There are multiple **third-party** packages for `pip-audit`. The matrices and badges below list some of them:

[![Packaging status](https://pypi-camo.freetls.fastly.net/e59ef63b60da79600e55a883ae64b236617512ab/68747470733a2f2f7265706f6c6f67792e6f72672f62616467652f766572746963616c2d616c6c7265706f732f707974686f6e3a7069702d61756469742e737667)](https://repology.org/project/python:pip-audit/versions) [![Packaging status](https://pypi-camo.freetls.fastly.net/e342b0e12ede03d33cbe30c60a80563a0fbae4e9/68747470733a2f2f7265706f6c6f67792e6f72672f62616467652f766572746963616c2d616c6c7265706f732f7069702d61756469742e737667)](https://repology.org/project/pip-audit/versions) [![Conda - Platform](https://pypi-camo.freetls.fastly.net/e0bff6f92a91433be6aa8fcbd2a56741d0901047/68747470733a2f2f696d672e736869656c64732e696f2f636f6e64612f706e2f636f6e64612d666f7267652f7069702d61756469743f6c6f676f3d616e61636f6e6461267374796c653d666c6174)](https://anaconda.org/conda-forge/pip-audit) [![Conda (channel only)](https://pypi-camo.freetls.fastly.net/72da28717f17b03445aca72942cd7ce2b1d9fab5/68747470733a2f2f696d672e736869656c64732e696f2f636f6e64612f766e2f636f6e64612d666f7267652f7069702d61756469743f6c6f676f3d616e61636f6e6461267374796c653d666c617426636f6c6f723d6f72616e6765)](https://anaconda.org/conda-forge/pip-audit)

In particular, `pip-audit` can be installed via `conda`:

conda install \-c conda-forge pip-audit

Third-party packages are **not** directly supported by this project. Please consult your package manager's documentation for more detailed installation guidance.

### GitHub Actions[](#user-content-github-actions)

`pip-audit` has [an official GitHub Action](https://github.com/pypa/gh-action-pip-audit)!

You can install it from the [GitHub Marketplace](https://github.com/marketplace/actions/gh-action-pip-audit), or add it to your CI manually:

jobs:
  pip-audit:
    steps:
      \- uses: pypa/gh-action-pip-audit@v1.1.0
        with:
          inputs: requirements.txt

See the [action documentation](https://github.com/pypa/gh-action-pip-audit/blob/main/README.md) for more details and usage examples.

### `pre-commit` support[](#user-content-pre-commit-support)

`pip-audit` has [`pre-commit`](https://pre-commit.com/) support.

For example, using `pip-audit` via `pre-commit` to audit a requirements file:

  \- repo: https://github.com/pypa/pip-audit
    rev: v2.10.1
    hooks:
      \-   id: pip-audit
          args: \["-r", "requirements.txt"\]

ci:
  \# Leave pip-audit to only run locally and not in CI
  \# pre-commit.ci does not allow network calls
  skip: \[pip-audit\]

Any `pip-audit` arguments documented below can be passed.

## Usage[](#user-content-usage)

You can run `pip-audit` as a standalone program, or via `python -m`:

pip-audit \--help
python \-m pip\_audit \--help

```
usage: pip-audit [-h] [-V] [-l] [-r REQUIREMENT] [--locked] [-f FORMAT]
                 [-s SERVICE] [--osv-url OSV_URL] [-d] [-S]
                 [--desc [{on,off,auto}]] [--aliases [{on,off,auto}]]
                 [--cache-dir CACHE_DIR] [--progress-spinner {on,off}]
                 [--timeout TIMEOUT] [--path PATH] [-v] [--fix]
                 [--require-hashes] [--index-url INDEX_URL]
                 [--extra-index-url URL] [--skip-editable] [--no-deps]
                 [-o FILE] [--ignore-vuln ID] [--disable-pip]
                 [project_path]

audit the Python environment for dependencies with known vulnerabilities

positional arguments:
  project_path          audit a local Python project at the given path
                        (default: None)

options:
  -h, --help            show this help message and exit
  -V, --version         show program's version number and exit
  -l, --local           show only results for dependencies in the local
                        environment (default: False)
  -r REQUIREMENT, --requirement REQUIREMENT
                        audit the given requirements file; this option can be
                        used multiple times (default: None)
  --locked              audit lock files from the local Python project. This
                        flag only applies to auditing from project paths
                        (default: False)
  -f FORMAT, --format FORMAT
                        the format to emit audit results in (choices: columns,
                        json, cyclonedx-json, cyclonedx-xml, markdown)
                        (default: columns)
  -s SERVICE, --vulnerability-service SERVICE
                        the vulnerability service to audit dependencies
                        against (choices: osv, pypi, esms) (default: pypi)
  --osv-url OSV_URL     URL to use for the OSV API instead of the default
                        (default: https://api.osv.dev/v1/query)
  -d, --dry-run         without `--fix`: collect all dependencies but do not
                        perform the auditing step; with `--fix`: perform the
                        auditing step but do not perform any fixes (default:
                        False)
  -S, --strict          fail the entire audit if dependency collection fails
                        on any dependency (default: False)
  --desc [{on,off,auto}]
                        include a description for each vulnerability; `auto`
                        defaults to `on` for the `json` format. This flag has
                        no effect on the `cyclonedx-json` or `cyclonedx-xml`
                        formats. (default: auto)
  --aliases [{on,off,auto}]
                        includes alias IDs for each vulnerability; `auto`
                        defaults to `on` for the `json` format. This flag has
                        no effect on the `cyclonedx-json` or `cyclonedx-xml`
                        formats. (default: auto)
  --cache-dir CACHE_DIR
                        the directory to use as an HTTP cache for PyPI; uses
                        the `pip` HTTP cache by default (default: None)
  --progress-spinner {on,off}
                        display a progress spinner (default: on)
  --timeout TIMEOUT     set the socket timeout (default: 15)
  --path PATH           restrict to the specified installation path for
                        auditing packages; this option can be used multiple
                        times (default: [])
  -v, --verbose         run with additional debug logging; supply multiple
                        times to increase verbosity (default: 0)
  --fix                 automatically upgrade dependencies with known
                        vulnerabilities (default: False)
  --require-hashes      require a hash to check each requirement against, for
                        repeatable audits; this option is implied when any
                        package in a requirements file has a `--hash` option.
                        (default: False)
  --index-url INDEX_URL
                        base URL of the Python Package Index; this should
                        point to a repository compliant with PEP 503 (the
                        simple repository API); this will be resolved by pip
                        if not specified (default: None)
  --extra-index-url URL
                        extra URLs of package indexes to use in addition to
                        `--index-url`; should follow the same rules as
                        `--index-url` (default: [])
  --skip-editable       don't audit packages that are marked as editable
                        (default: False)
  --no-deps             don't perform any dependency resolution; requires all
                        requirements are pinned to an exact version (default:
                        False)
  -o FILE, --output FILE
                        output results to the given file (default: stdout)
  --ignore-vuln ID      ignore a specific vulnerability by its vulnerability
                        ID; this option can be used multiple times (default:
                        [])
  --disable-pip         don't use `pip` for dependency resolution; this can
                        only be used with hashed requirements files or if the
                        `--no-deps` flag has been provided (default: False)
```

### Environment variables[](#user-content-environment-variables)

`pip-audit` allows users to configure some flags via environment variables instead:

Flag

Environment equivalent

Example

`--format`

`PIP_AUDIT_FORMAT`

`PIP_AUDIT_FORMAT=markdown`

`--vulnerability-service`

`PIP_AUDIT_VULNERABILITY_SERVICE`

`PIP_AUDIT_VULNERABILITY_SERVICE=osv`

`--desc`

`PIP_AUDIT_DESC`

`PIP_AUDIT_DESC=off`

`--progress-spinner`

`PIP_AUDIT_PROGRESS_SPINNER`

`PIP_AUDIT_PROGRESS_SPINNER=off`

`--output`

`PIP_AUDIT_OUTPUT`

`PIP_AUDIT_OUTPUT=/tmp/example`

### Exit codes[](#user-content-exit-codes)

On completion, `pip-audit` will exit with a code indicating its status.

The current codes are:

-   `0`: No known vulnerabilities were detected.
-   `1`: One or more known vulnerabilities were found.

`pip-audit`'s exit code cannot be suppressed. See [Suppressing exit codes from `pip-audit`](#user-content-suppressing-exit-codes-from-pip-audit) for supported alternatives.

### Dry runs[](#user-content-dry-runs)

`pip-audit` supports the `--dry-run` flag, which can be used to control whether an audit (or fix) step is actually performed.

-   On its own, `pip-audit --dry-run` skips the auditing step and prints the number of dependencies that _would have been_ audited.
-   In fix mode, `pip-audit --fix --dry-run` performs the auditing step and prints out the fix behavior (i.e., which dependencies would be upgraded or skipped) that _would have been performed_.

## Examples[](#user-content-examples)

Audit dependencies for the current Python environment:

$ pip-audit
No known vulnerabilities found

Audit dependencies for a given requirements file:

$ pip-audit \-r ./requirements.txt
No known vulnerabilities found

Audit dependencies for a requirements file, excluding system packages:

$ pip-audit \-r ./requirements.txt \-l
No known vulnerabilities found

Audit dependencies for a local Python project:

$ pip-audit .
No known vulnerabilities found

Audit lockfiles for a local Python project:

$ pip-audit \--locked .
No known vulnerabilities found

`pip-audit` searches the provided path for various Python "project" files. At the moment, only `pyproject.toml` and `pylock.*.toml` are supported.

Audit dependencies when there are vulnerabilities present:

$ pip-audit
Found 2 known vulnerabilities in 1 package
Name  Version ID             Fix Versions
\----  ------- -------------- ------------
Flask 0.5     PYSEC-2019-179 1.0
Flask 0.5     PYSEC-2018-66  0.12.3

Audit dependencies including aliases:

$ pip-audit \--aliases
Found 2 known vulnerabilities in 1 package
Name  Version ID             Fix Versions Aliases
\----  ------- -------------- ------------ -------------------------------------
Flask 0.5     PYSEC-2019-179 1.0          CVE-2019-1010083, GHSA-5wv5-4vpf-pj6m
Flask 0.5     PYSEC-2018-66  0.12.3       CVE-2018-1000656, GHSA-562c-5r94-xh97

Audit dependencies including descriptions:

$ pip-audit \--desc
Found 2 known vulnerabilities in 1 package
Name  Version ID             Fix Versions Description
\----  ------- -------------- ------------ --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
Flask 0.5     PYSEC-2019-179 1.0          The Pallets Project Flask before 1.0 is affected by: unexpected memory usage. The impact is: denial of service. The attack vector is: crafted encoded JSON data. The fixed version is: 1. NOTE: this may overlap CVE-2018-1000656.
Flask 0.5     PYSEC-2018-66  0.12.3       The Pallets Project flask version Before 0.12.3 contains a CWE-20: Improper Input Validation vulnerability in flask that can result in Large amount of memory usage possibly leading to denial of service. This attack appear to be exploitable via Attacker provides JSON data in incorrect encoding. This vulnerability appears to have been fixed in 0.12.3. NOTE: this may overlap CVE-2019-1010083.

Audit dependencies in JSON format:

$ pip-audit \-f json | python \-m json.tool
Found 2 known vulnerabilities in 1 package
\[
  {
    "name": "flask",
    "version": "0.5",
    "vulns": \[
      {
        "id": "PYSEC-2019-179",
        "fix\_versions": \[
          "1.0"
        \],
        "aliases": \[
          "CVE-2019-1010083",
          "GHSA-5wv5-4vpf-pj6m"
        \],
        "description": "The Pallets Project Flask before 1.0 is affected by: unexpected memory usage. The impact is: denial of service. The attack vector is: crafted encoded JSON data. The fixed version is: 1. NOTE: this may overlap CVE-2018-1000656."
      },
      {
        "id": "PYSEC-2018-66",
        "fix\_versions": \[
          "0.12.3"
        \],
        "aliases": \[
          "CVE-2018-1000656",
          "GHSA-562c-5r94-xh97"
        \],
        "description": "The Pallets Project flask version Before 0.12.3 contains a CWE-20: Improper Input Validation vulnerability in flask that can result in Large amount of memory usage possibly leading to denial of service. This attack appear to be exploitable via Attacker provides JSON data in incorrect encoding. This vulnerability appears to have been fixed in 0.12.3. NOTE: this may overlap CVE-2019-1010083."
      }
    \]
  },
  {
    "name": "jinja2",
    "version": "3.0.2",
    "vulns": \[\]
  },
  {
    "name": "pip",
    "version": "21.3.1",
    "vulns": \[\]
  },
  {
    "name": "setuptools",
    "version": "57.4.0",
    "vulns": \[\]
  },
  {
    "name": "werkzeug",
    "version": "2.0.2",
    "vulns": \[\]
  },
  {
    "name": "markupsafe",
    "version": "2.0.1",
    "vulns": \[\]
  }
\]

Audit and attempt to automatically upgrade vulnerable dependencies:

$ pip-audit \--fix
Found 2 known vulnerabilities in 1 package and fixed 2 vulnerabilities in 1 package
Name  Version ID             Fix Versions Applied Fix
\----- ------- -------------- ------------ ----------------------------------------
flask 0.5     PYSEC-2019-179 1.0          Successfully upgraded flask (0.5 => 1.0)
flask 0.5     PYSEC-2018-66  0.12.3       Successfully upgraded flask (0.5 => 1.0)

## Troubleshooting[](#user-content-troubleshooting)

Have you resolved a problem with `pip-audit`? Help us by contributing to this section!

### `pip-audit` shows irrelevant vulnerability reports![](#user-content-pip-audit-shows-irrelevant-vulnerability-reports)

In a perfect world, vulnerability feeds would have an infinite signal-to-noise ratio: every vulnerability report would be (1) correct, and (2) applicable to every use of every dependency.

Unfortunately, neither of these is guaranteed: vulnerability feeds are not immune to extraneous or spam reports, and not all uses of a particular dependency map to all potential classes of vulnerabilities.

If your `pip-audit` runs produce vulnerability reports that aren't actionable for your particular application or use case, you can use the `--ignore-vuln ID` option to ignore specific vulnerability reports. `--ignore-vuln` supports aliases, so you can use a `GHSA-xxx` or `CVE-xxx` ID instead of a `PYSEC-xxx` ID if the report in question does not have a PYSEC ID.

For example, here is how you might ignore GHSA-w596-4wvx-j9j6, which is a common source of noisy vulnerability reports and false positives for users of [`pytest`](https://github.com/pytest-dev/pytest):

\# Run the audit as normal, but exclude any reports that match GHSA-w596-4wvx-j9j6
$ pip-audit \--ignore-vuln GHSA-w596-4wvx-j9j6

The `--ignore-vuln ID` option works with all other dependency resolution and auditing options, meaning that it should function correctly with requirements-style inputs, alternative vulnerability feeds, and so forth.

It can also be passed multiple times, to ignore multiple reports:

\# Run the audit as normal, but exclude any reports that match these IDs
$ pip-audit \--ignore-vuln CVE-XXX-YYYY \--ignore-vuln CVE-ZZZ-AAAA

### `pip-audit` takes longer than I expect![](#user-content-pip-audit-takes-longer-than-i-expect)

Depending on how you're using it, `pip-audit` may have to perform its own dependency resolution, which can take roughly as long as `pip install` does for a project. See the [security model](#user-content-security-model) for an explanation.

You have two options for avoiding dependency resolution: _audit a pre-installed environment_, or _ensure that your dependencies are already fully resolved_.

If you know that you've already fully configured an environment equivalent to the one that `pip-audit -r requirements.txt` would audit, you can simply reuse it:

\# Note the absence of any "input" arguments, indicating that the environment is used.
$ pip-audit

\# Optionally filter out non-local packages, for virtual environments:
$ pip-audit \--local

Alternatively, if your input is fully pinned (and optionally hashed), you can tell `pip-audit` to skip dependency resolution with either `--no-deps` (pinned without hashes) or `--require-hashes` (pinned including hashes).

The latter is equivalent to `pip`'s [hash-checking mode](https://pip.pypa.io/en/stable/cli/pip_install/#hash-checking-mode) and is preferred, since it offers additional integrity.

\# fails if any dependency is not fully pinned
$ pip-audit \--no-deps \-r requirements.txt

\# fails if any dependency is not fully pinned \*or\* is missing hashes
$ pip-audit \--require-hashes \-r requirements.txt

### `pip-audit` can't authenticate to my third-party index![](#user-content-pip-audit-cant-authenticate-to-my-third-party-index)

### Authenticated third-party or private indices[](#user-content-authenticated-third-party-or-private-indices)

`pip-audit` supports `--index-url` and `--extra-index-url` for configuring an alternate or supplemental package indices, just like `pip`.

When _unauthenticated_, these indices should work as expected. However, when a third-party index requires authentication, `pip-audit` has a few additional restrictions on top of ordinary `pip`:

-   Interactive authentication is **not** supported. In other words: `pip-audit` will **not** prompt you for a username/password for the index.
-   [`pip`'s `keyring` authentication](https://pip.pypa.io/en/stable/topics/authentication/#keyring-support) **is** supported, but in a limited fashion: `pip-audit` uses the `subprocess` keyring provider, since audits happen in isolated virtual environments. The `subprocess` provider in turn is subject to additional restrictions (such as a required username); [`pip`'s documentation](https://pip.pypa.io/en/stable/topics/authentication/#using-keyring-as-a-command-line-application) explains these in depth.

In addition to the above, some third-party indices have required, hard-coded usernames. For example, for Google Artifact registry, the hard-coded username is `oauth2accesstoken`. See [#742](https://github.com/pypa/pip-audit/issues/742) and [pip#11971](https://github.com/pypa/pip/issues/11971) for additional context.

## Tips and Tricks[](#user-content-tips-and-tricks)

### Running against a `pipenv` project[](#user-content-running-against-a-pipenv-project)

`pipenv` uses both a `Pipfile` and `Pipfile.lock` file to track and freeze dependencies instead of a `requirements.txt` file. `pip-audit` cannot process the `Pipfile[.lock]` files directly, however, these can be converted to a supported `requirements.txt` file that `pip-audit` can run against. `pipenv` has a built-in command to convert dependencies to a `requirements.txt` file (as of [`v2022.4.8`](https://pipenv.pypa.io/en/latest/changelog/#id206)):

$ pipenv run pip-audit \-r <(pipenv requirements)

### Suppressing exit codes from `pip-audit`[](#user-content-suppressing-exit-codes-from-pip-audit)

`pip-audit` intentionally does not support internally suppressing its own exit codes.

Users who need to suppress a failing `pip-audit` invocation can use one of the standard shell idioms for doing so:

pip-audit || true

or, to exit entirely:

pip-audit || exit 0

The exit code can also be captured and handled explicitly:

pip-audit
exitcode\="${?}"
\# do something with ${exitcode}

See [Exit codes](#user-content-exit-codes) for a list of potential codes that need handling.

### Reporting only fixable vulnerabilities[](#user-content-reporting-only-fixable-vulnerabilities)

In development workflows, you may want to ignore the vulnerabilities that haven't been remediated yet and only investigate them in your release process. `pip-audit` does not support ignoring unfixed vulnerabilities. However, you can export its output in JSON format and externally process it. For example, if you want to exit with a non-zero code only when the detected vulnerabilities have known fix versions, you can process the output using [jq](https://github.com/jqlang/jq) as:

test \-z "$(pip-audit \-r requirements.txt \--format\=json 2\>/dev/null | jq '.dependencies\[\].vulns\[\].fix\_versions\[\]')"

A simple (and inefficient) example of using this method would be:

test \-z "$(pip-audit \-r requirements.txt \--format\=json 2\>/dev/null | jq '.dependencies\[\].vulns\[\].fix\_versions\[\]')" || pip-audit \-r requirements.txt

which runs `pip-audit` as usual and exits with a non-zero code only if there are fixed versions for the known vulnerabilities.

## Security Model[](#user-content-security-model)

This section exists to describe the security assumptions you **can** and **must not** make when using `pip-audit`.

TL;DR: **If you wouldn't `pip install` it, you should not `pip audit` it.**

`pip-audit` is a tool for auditing Python environments for packages with _known vulnerabilities_. A "known vulnerability" is a publicly reported flaw in a package that, if uncorrected, _might_ allow a malicious actor to perform unintended actions.

`pip-audit` **can** protect you against known vulnerabilities by telling you when you have them, and how you should upgrade them. For example, if you have `somepackage==1.2.3` in your environment, `pip-audit` **can** tell you that it needs to be upgraded to `1.2.4`.

You **can** assume that `pip-audit` will make a best effort to _fully resolve_ all of your Python dependencies and _either_ fully audit each _or_ explicitly state which ones it has skipped, as well as why it has skipped them.

`pip-audit` is **not** a static code analyzer. It analyzes dependency trees, not code, and it **cannot** guarantee that arbitrary dependency resolutions occur statically. To understand why this is, refer to Dustin Ingram's [excellent post on dependency resolution in Python](https://dustingram.com/articles/2018/03/05/why-pypi-doesnt-know-dependencies/).

As such: you **must not** assume that `pip-audit` will **defend** you against malicious packages. In particular, it is **incorrect** to treat `pip-audit -r INPUT` as a "more secure" variant of `pip-audit`. For all intents and purposes, `pip-audit -r INPUT` is functionally equivalent to `pip install -r INPUT`, with a small amount of **non-security isolation** to avoid conflicts with any of your local environments.

`pip-audit` is first and foremost an auditing tool for _Python_ packages. You **must not** assume that `pip-audit` will detect or flag "transitive" vulnerabilities that might be exposed through Python packages, but are not actually part of the package itself. For example, `pip-audit`'s vulnerability information sources are unlikely to include an advisory for a vulnerable shared library that a popular Python package _might_ use, since the Python package's version is not strongly connected to the shared library's version.

## Licensing[](#user-content-licensing)

`pip-audit` is licensed under the Apache 2.0 License.

`pip-audit` reuses and modifies examples from [`resolvelib`](https://github.com/sarugaku/resolvelib), which is licensed under the ISC license.

## Contributing[](#user-content-contributing)

See [the contributing docs](CONTRIBUTING.md) for details.

## Code of Conduct[](#user-content-code-of-conduct)

Everyone interacting with this project is expected to follow the [PSF Code of Conduct](https://github.com/pypa/.github/blob/main/CODE_OF_CONDUCT.md).

## Release files for pip-audit 2.10.1

For a detailed explanation of source distributions (sdists) and built distributions (wheels), please see the [package formats documentation](https://packaging.python.org/en/latest/discussions/package-formats/#package-formats "External link").

### Source distribution (sdist)

Source distribution for pip-audit 2.10.1

File

Size

Uploaded

[pip\_audit-2.10.1.tar.gz](https://files.pythonhosted.org/packages/66/a4/f21d5f0a0edabcbce31560b73c7c5a6f72ae87af4236fd1069c8f59a353d/pip_audit-2.10.1.tar.gz)

54.3 kB

Jun 10, 2026

[Details](#pip_audit-2.10.1.tar.gz)

* * *

### Built distribution (wheel)

Table of built distributions (wheels) for pip-audit 2.10.1

File

Interpreter

ABI

Platform

[Reset](https://pypi.org/project/pip-audit/#files)

[pip\_audit-2.10.1-py3-none-any.whl](https://files.pythonhosted.org/packages/a3/a7/b0c504148114047bd1bc9d97447453c6850ca176bb2f3c0038835994e8b7/pip_audit-2.10.1-py3-none-any.whl) 62.0 kB Jun 10, 2026

Python 3

none

any

[Details](#pip_audit-2.10.1-py3-none-any.whl)

* * *

**Total release size:** 116.3 kB

## Release history [Release notifications](/help/#project-release-notifications) | [RSS feed](/rss/project/pip-audit/releases.xml)

This release

![](https://pypi.org/static/images/blue-cube.572a5bfb.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)

![](https://pypi.org/static/images/white-cube.2351a86c.svg)
