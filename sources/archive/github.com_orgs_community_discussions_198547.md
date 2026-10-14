#  [![@community](https://avatars.githubusercontent.com/u/93784371?s=60&v=4) GitHub Community](/community)

# Preparing for npm v12: install scripts and non-registry sources become opt-in #198547

[Answered](#discussioncomment-17254466) by [JamieMagee](/JamieMagee "JamieMagee")

[leobalter](/leobalter) asked this question in [npm](/orgs/community/discussions/categories/npm)

[Preparing for npm v12: install scripts and non-registry sources become opt-in](#top) #198547

 [![@leobalter](https://avatars.githubusercontent.com/u/301201?s=40&v=4) leobalter](/leobalter)

Jun 9, 2026 · 20 comments · 36 replies

[Answered](#discussioncomment-17254466) by [JamieMagee](/JamieMagee "JamieMagee") [Return to top](#top)

Discussion options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

edited

### Uh oh!

There was an error while loading. Please reload this page.

## 

[![](https://avatars.githubusercontent.com/u/301201?s=64&v=4)

leobalter

](/leobalter)[Jun 9, 2026](#discussion-10229178)

Maintainer

Hi everyone — sharing this so maintainers, application developers, and CI operators have time to prepare for [behavioral changes landing in **npm v12 (estimated July 2026)**](https://github.blog/changelog/2026-06-09-upcoming-breaking-changes-for-npm-v12/). Everything below is already available in **npm 11.16.0** so you can migrate today.

## What is changing in v12

Three `npm install` defaults change, each closing an automatic code-execution or code-fetch path:

1.  **Install scripts are off by default.** `preinstall`, `install`, and `postinstall` from dependencies won't run unless explicitly allowed.
2.  **`--allow-git` defaults to `none`.** Git dependencies (direct or transitive) won't resolve unless allowed. Available since npm 11.10.0; [previously announced Feb 2026](https://github.blog/changelog/2026-02-18-npm-bulk-trusted-publishing-config-and-script-security-now-generally-available/).
3.  **`--allow-remote` defaults to `none`.** Remote URL dependencies (e.g. https tarballs) won't resolve unless allowed. Available since npm 11.15.0.

`--allow-file` and `--allow-directory` exist too, but their defaults are **not** changing in v12.

Most of this post focuses on install scripts, since that's the migration with the most moving parts.

## Why install scripts

Install-time lifecycle scripts are the single largest code-execution surface in the npm ecosystem. Every `npm install` runs scripts from every transitive dependency, so a single compromised package anywhere in your tree can execute arbitrary code on a developer machine or CI runner. Making script execution opt-in closes that path while keeping it one command away for the packages you trust.

## The commands

-   `npm approve-scripts` — allow scripts for specific dependencies. Writes the allowlist to your `package.json`.
-   `npm deny-scripts` — explicitly block scripts for a dependency (survives `--all` and future review prompts).
-   `npm approve-scripts --allow-scripts-pending` — read-only: lists every package whose scripts aren't yet covered, without changing anything.
-   `allow-scripts` config / `--allow-scripts=<pkg,...>` — the mechanism for **global installs and `npx`** (see below).
-   `strict-allow-scripts` config / `--strict-allow-scripts` — opt into the **v12 enforcing behavior today**.

By default, `npm approve-scripts <pkg>` pins the approval to the installed version (`pkg@1.2.3`). Use `--no-allow-scripts-pin` if you'd rather allow any future version by name.

## Recommended first step: allow what you already have

If you're adopting this on an existing project, the fastest safe migration is to **allow everything currently in your tree first**, then tighten later — rather than agonizing over each package and delaying rollout:

npm install                      # warns about packages with skipped scripts
npm approve-scripts --allow-scripts-pending   # review the list
npm approve-scripts --all        # approve everything currently pending
git add package.json && git commit -m "chore: snapshot current install-script allowlist"

This gets you protected against _new, unexpected_ scripts immediately. You can then `npm deny-scripts` anything you don't actually need.

## "If you have X, do Y" — migration recipes

### Native modules (anything built on `node-gyp`)

Includes `sharp`, `better-sqlite3`, `canvas`, `bcrypt`, `node-sass`, `bufferutil`, `utf-8-validate`, and many DB drivers. Note: these are blocked even if they have no explicit install script, because npm runs an implicit `node-gyp rebuild` for any package with a `binding.gyp`.

npm approve-scripts        # approve node-gyp + the native packages you use

### Cypress, Playwright, or Puppeteer

These download browser/runtime binaries via `postinstall`.

npm approve-scripts        # approve: cypress / playwright / @playwright/browser-\* / puppeteer

Or control downloads yourself with each tool's explicit command (`npx playwright install`, `npx cypress install`) after `npm install`.

### Electron

npm approve-scripts        # approve: electron

### Husky (git hooks)

npm approve-scripts        # approve: husky

Or move husky setup into an explicit `prepare` script you invoke during bootstrap.

### CI pipelines

1.  Upgrade your CI image to npm 11.16.0+.
2.  Run your install and check logs for skipped-script warnings.
3.  Commit the allowlist from `npm approve-scripts` so installs are reproducible.
4.  Consider `--strict-allow-scripts` so CI fails loudly on anything unreviewed (see below).

### Publishing a package that needs install scripts

Your downstream users won't run your scripts by default in v12. Two things help:

1.  **Document it** — add a note to your README and link `npm approve-scripts`.
2.  **Reduce the need** — ship prebuilt binaries (`prebuild`, `prebuildify`, `node-pre-gyp`) or move setup into an explicit command users run after install.

If your package has high download volume or many dependents, the npm team may reach out to coordinate — or reach out to us first (see "How to get help").

## Global installs and `npx`

`npm approve-scripts` / `npm deny-scripts` only work inside a project with a `package.json` — they'll error (`EGLOBAL`) for global installs and `npx`. For those contexts, use the `allow-scripts` config or flag instead:

npm install -g --allow-scripts=canvas,sharp <pkg\>
# or persist it:
npm config set allow-scripts=canvas,sharp --location=user

## Migrating from a blanket `ignore-scripts=true`

If you currently keep `ignore-scripts=true` in your `.npmrc`, `npm approve-scripts --allow-scripts-pending` will still list the packages that _would_ need approval, so you can move from a blanket ignore onto a precise allowlist. Note that while `ignore-scripts=true` remains set, it takes precedence and no scripts run — the allowlist does not override it. Remove `ignore-scripts` once your allowlist is in place.

## Timeline

Version

Date

Behavior

npm 11.16.0

Available now

Features available; warnings by default; opt into enforcement with `strict-allow-scripts`

npm 12

Estimated July 2026

`allowScripts` off by default; `--allow-git` and `--allow-remote` default to `none`

## How to get help

-   **General questions and discussion:** reply in this thread.
-   **Bugs or regressions:** [npm/cli issues](https://github.com/npm/cli/issues), tag `allowScripts`.
-   **Maintainers of high-impact packages:** open an issue in [npm/cli](https://github.com/npm/cli/issues) tagged `maintainer-outreach`.
-   **Enterprise customers:** contact your GitHub or Microsoft account team.

## References

-   [`allow-scripts` config](https://docs.npmjs.com/cli/v11/using-npm/config#allow-scripts)
-   [`npm approve-scripts`](https://docs.npmjs.com/cli/v11/commands/npm-approve-scripts)
-   [`npm deny-scripts`](https://docs.npmjs.com/cli/v11/commands/npm-deny-scripts)
-   [Breaking changes PR for npm v12](https://github.com/npm/cli/pull/9387)

13 You must be logged in to vote

👍 14 😄 1 🎉 8 ❤️ 7 🚀 4 👀 1

All reactions

-   👍 14
-   😄 1
-   🎉 8
-   ❤️ 7
-   🚀 4
-   👀 1

Answered by [JamieMagee](/JamieMagee) [Jun 10, 2026](https://github.com/orgs/community/discussions/198547#discussioncomment-17254466)

`strict-allow-scripts` is not the v12 default and won't be. The v12 default is softer: an install script you haven't approved gets skipped, you get a warning, and the install still succeeds. So `npm install -D esbuild` just works. esbuild lands in `node_modules`, its `postinstall` is skipped, you see a warning saying so. No failure, and no chicken-and-egg.

The wall is coming entirely from `strict-allow-scripts=true`. That turns the skip into a hard error that fires _before_ npm writes anything, so esbuild never gets installed. That's why `approve-scripts esbuild` can't find it afterward. There's nothing on disk to approve yet.

The other two are doing what they should. `--allow-scripts` is blocked in proj…

[View full answer](#discussioncomment-17254466)

## Replies: 20 comments · 36 replies

### 

This comment has been hidden.

[Sign in to view](/login?return_to=https%3A%2F%2Fgithub.com%2Forgs%2Fcommunity%2Fdiscussions%2F198547)

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

### 

[![](https://avatars.githubusercontent.com/u/792378?s=64&v=4)

mrbusche

](/mrbusche)[Jun 9, 2026](#discussioncomment-17242773)

Will Node 26 eventually ship with npm 12? Or will that wait until Node 27?

5 You must be logged in to vote

All reactions

2 replies

[![@rvillane](https://avatars.githubusercontent.com/u/11447528?s=60&v=4)](/rvillane)

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

#### 

[rvillane](/rvillane) [Jun 11, 2026](#discussioncomment-17271387)

> Will Node 26 eventually ship with npm 12? Or will that wait until Node 27?

wondering the same, also can consider manually updating NPM to v12 in Node 24 if needed

All reactions

[![@JamieMagee](https://avatars.githubusercontent.com/u/1358764?s=60&v=4)](/JamieMagee)

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

#### 

[JamieMagee](/JamieMagee) [Jun 11, 2026](#discussioncomment-17272548)

We are hoping to backport npm 12 to Node 24 & 26. Though, ultimately, that decision lies with the Node release team. You can follow the discussion here: [nodejs/Release#1161](https://github.com/nodejs/Release/issues/1161)

👍 1

All reactions

-   👍 1

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

### 

[![](https://avatars.githubusercontent.com/u/20663065?s=64&v=4)

sebdanielsson

](/sebdanielsson)[Jun 9, 2026](#discussioncomment-17242986)

Would’ve been nice with a default min package age too👍

25 You must be logged in to vote

❤️ 5

All reactions

-   ❤️ 5

1 reply

[![@VladSez](https://avatars.githubusercontent.com/u/16666234?s=60&v=4)](/VladSez)

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

#### 

[VladSez](/VladSez) [Jun 10, 2026](#discussioncomment-17253779)

hard agree

All reactions

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

### 

[![](https://avatars.githubusercontent.com/u/173813?s=64&v=4)

tbroyer

](/tbroyer)[Jun 9, 2026](#discussioncomment-17243122)

There should be a way out of ignore-scripts, while keeping it for NPM < 11.16.0

In a shared CI environment, we set a global `npm_config_ignore_scripts` environment variable, and could easily set `npm_config_strict_allow_scripts`. We cannot force every project to upgrade to NPM >= 11.16.0.  
Ideally there should be a way to have `npm_config_ignore_scripts` respected in NPM < 11.16.0 projects, and using `allowScripts` in NPM >= 11.16.0 projects. Maybe some other flag allowing to ignore `npm_config_ignore_scripts`.

4 You must be logged in to vote

👍 1

All reactions

-   👍 1

1 reply

[![@JamieMagee](https://avatars.githubusercontent.com/u/1358764?s=60&v=4)](/JamieMagee)

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

#### 

[JamieMagee](/JamieMagee) [Jun 10, 2026](#discussioncomment-17254638)

IMO The env var winning is a feature, not a gap. You set `npm_config_ignore_scripts` globally, which sits at the env level, and a project's `package.json` can't override that with `allowScripts`. Env outranks project, and `ignore-scripts` beats `allowScripts` regardless. If a user says "run nothing," a repo shouldn't be able to switch its own scripts back on.

Old npm keeping the blanket block while new npm uses the allowlist, is being discussed in [npm/cli#9450](https://github.com/npm/cli/issues/9450). The migration half already landed: `approve-scripts --allow-scripts-pending` now lists packages even under `ignore-scripts=true`, so you can build the allowlist without dropping your global block first.

👍 1

All reactions

-   👍 1

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

### 

[![](https://avatars.githubusercontent.com/u/11942682?s=64&v=4)

chronoB

](/chronoB)[Jun 10, 2026](#discussioncomment-17248536)

What is the recommended way to install new packages that include scripts?

Current behaviour when `strict-allow-scripts=true` is set in the .npmrc:  
`npm install -D esbuild` fails because `esbuild` includes a `postinstall` script.  
`npm approve-scripts esbuild` fails because esbuild is not installed  
`npm install -D esbuild --allow-scripts=esbuild` fails because the option is only for global installs.  
`npm install -D esbuild --dangerously-allow-all-scripts` works but it bypasses the whole allowScripts mechanism although I only wanted to allow the script for esbuild.

Am I missing something?

1 You must be logged in to vote

All reactions

10 replies

[![@JamieMagee](https://avatars.githubusercontent.com/u/1358764?s=60&v=4)](/JamieMagee)

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

#### 

[JamieMagee](/JamieMagee) [Jun 10, 2026](#discussioncomment-17254466)

`strict-allow-scripts` is not the v12 default and won't be. The v12 default is softer: an install script you haven't approved gets skipped, you get a warning, and the install still succeeds. So `npm install -D esbuild` just works. esbuild lands in `node_modules`, its `postinstall` is skipped, you see a warning saying so. No failure, and no chicken-and-egg.

The wall is coming entirely from `strict-allow-scripts=true`. That turns the skip into a hard error that fires _before_ npm writes anything, so esbuild never gets installed. That's why `approve-scripts esbuild` can't find it afterward. There's nothing on disk to approve yet.

The other two are doing what they should. `--allow-scripts` is blocked in project installs on purpose (it's for `-g` and `npx`), and `--dangerously-allow-all-scripts` skips the whole policy by design.

So I'd just not run strict on your dev machine. Keep it in CI, where the package is already in `package.json` and already approved. Locally:

npm install -D esbuild        # installs; postinstall skipped + warning
npm approve-scripts esbuild   # writes the allowScripts entry
npm rebuild esbuild           # runs the now-approved postinstall

Commit the `package.json` and CI passes, because esbuild is now covered. If you really want strict locally too, add new packages with `--no-strict-allow-scripts` for that one command, then approve and rebuild.

Marked as answer

👍 7

All reactions

-   👍 7

Answer selected by [leobalter](/leobalter)

[![@tbroyer](https://avatars.githubusercontent.com/u/173813?s=60&v=4)](/tbroyer)

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

#### 

[tbroyer](/tbroyer) [Jun 10, 2026](#discussioncomment-17254586)

> `strict-allow-scripts` is not the v12 default and won't be.

This is not what the "Try the breaking behavior now" section above says though.

👍 1

All reactions

-   👍 1

[![@JamieMagee](https://avatars.githubusercontent.com/u/1358764?s=60&v=4)](/JamieMagee)

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

#### 

[JamieMagee](/JamieMagee) [Jun 10, 2026](#discussioncomment-17254611)

I'll get that updated.

👍 2

All reactions

-   👍 2

[![@marypcbuk](https://avatars.githubusercontent.com/u/38077532?s=60&v=4)](/marypcbuk)

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

#### 

[marypcbuk](/marypcbuk) [Jun 11, 2026](#discussioncomment-17270402)

and strict is mentioned as the way to opt in for 11 because the more nuanced approach of the allowlist isn't supported there?

All reactions

[![@JamieMagee](https://avatars.githubusercontent.com/u/1358764?s=60&v=4)](/JamieMagee)

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

#### 

[JamieMagee](/JamieMagee) [Jun 11, 2026](#discussioncomment-17270473)

Yeah, 11 does enforce the `true`/`false` record keeping in `allowScripts`. But, at its core, the breaking change between 11 and 12 is that in 11 unreviewed scripts (absent from `allowScripts`) still run and in 12 they don't.

`strict-allow-scripts` does bring that breaking behaviour forward to 11, but it's even stricter than what 12 will be.

👍 1

All reactions

-   👍 1

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

edited

### Uh oh!

There was an error while loading. Please reload this page.

### 

[![](https://avatars.githubusercontent.com/u/3629489?s=64&v=4)

vbjay

](/vbjay)[Jun 11, 2026](#discussioncomment-17265860)

Does the allow hash the allowed scripts and npm compare hash before running? Is this just accept package x's {type of script} and if changed could still just run arbitrary code on an update? If version matching then does npm disallow version delete and republish same version? If not then there is a hole of I replace version 1.2 version with a new bad version. You accepted that version range and I snuck something different in.

2 You must be logged in to vote

All reactions

15 replies

[![@vbjay](https://avatars.githubusercontent.com/u/3629489?s=60&v=4)](/vbjay)

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

edited

### Uh oh!

There was an error while loading. Please reload this page.

#### 

[vbjay](/vbjay) [Jun 12, 2026](#discussioncomment-17279540)

Thanks for this writeup and for the clarifications throughout the thread — particularly the confirmation that `strict-allow-scripts` is not the v12 default, and that Dependabot does not touch `allowScripts`. Both of those are important distinctions that deserve more prominence in the original post.

Pulling together a few threads from the discussion, I think there are a few connected follow-on priorities worth calling out. One note upfront: reading through the `12.0.0-pre.1` release notes, several real improvements have already landed — the `ignore-scripts=true` + `--allow-scripts-pending` listing bug is fixed, `allowScripts` is now enforced across `prune`, `dedupe`, `uninstall`, `audit fix`, and `link`, and bundled dependency hardening is in. That's meaningful progress. The gaps below are about what's still open.

* * *

### The real gap in `--allow-scripts-pending`

The thread confirmed that the pending output shows the lifecycle script values from `package.json`. So if the script is `node install.js`, that is what you see. What you do not see is what is inside `install.js`, what it requires, what those files do, or whether any of them perform network calls, invoke `child_process`, read credentials from `process.env`, or write outside the package directory.

This is also visible in how arborist works: install scripts are read from actual files on disk. The code path runs through real files — `install.js`, `setup.js`, `download.js`, whatever the chain leads to. Those files are there. They are just not surfaced in the pending output.

[@kimballa](https://github.com/kimballa) described this from real testing: a transitive dependency's `install.js` that just `require`s another file means opening an IDE and tracing a call stack through unfamiliar code. That is not just a workflow gap — it is a workflow that often will not happen in practice. The approval can easily become "`node install.js` — looks reasonable, approve."

This is the core limitation. `--allow-scripts-pending` identifies which packages need attention. It does not fully help answer: _what exactly am I approving?_

A review-report mode would help. Not to prove a script is safe, but to surface the obvious execution path so the decision is informed rather than reflexive. At minimum, that could include:

-   lifecycle script name and exact command value
-   local files directly referenced by that command, such as `install.js`, `setup.js`, shell scripts, or binaries
-   obvious local files those scripts reference, where statically detectable
-   risk signals such as `child_process`, `eval`, network calls, credential/env access, or writes outside the package directory
-   a diff against the previously approved version's lifecycle scripts and referenced files, where one exists

The response was to open an issue in `npm/cli` or `npm/rfcs`, which makes sense — and I plan to do that. This feels like the feature that determines whether an `allowScripts` approval becomes a meaningful security decision or a renamed click-through.

* * *

### Dev machine vs. CI/CD

The guidance that emerged here — do not necessarily run `strict-allow-scripts` on dev machines, but do run it in CI — is practical given the chicken-and-egg problem with new package installs under strict mode.

But the security implication is worth stating explicitly in the docs:

In the recommended local workflow, approvals are often created under the soft-skip model, then enforced by CI under strict mode. That means CI strict enforcement is only as trustworthy as the approval that was committed. The approval step may happen when a developer is simply trying to unblock a local install, with the least context and the most pressure to move forward.

That is not an argument against the recommended split — it is probably the right operational model. But it means the review-report feature above is not just nice-to-have; it is what makes the approval step trustworthy enough to rely on.

One additional note on urgency: the npm team is actively pursuing backporting npm 12 to Node 24 and Node 26 (see [nodejs/Release#1161](https://github.com/nodejs/Release/issues/1161)). If that lands, these defaults reach the two active LTS lines rather than waiting for Node 27. That is the right call for security, but it also means the tooling needs to be ready for a much larger audience on a shorter timeline.

* * *

### Version bump vs. new script

Something [@kimballa](https://github.com/kimballa) raised that deserves more attention: pending output should distinguish between very different cases:

-   a version bump where the lifecycle script is unchanged
-   a version bump where the lifecycle script changed
-   a package that previously had no lifecycle script and now does

Those are very different risk signals. If they all appear as the same kind of pending approval, developers are pushed toward reflexive approve/reject on the package name alone.

Even simple labels would help:

```
[new lifecycle script]
[lifecycle script changed since last approved version]
[lifecycle script unchanged since last approved version]
```

That would make the approval list easier to triage and less likely to collapse into bulk approval.

* * *

### Bots and AI agents modifying `allowScripts`

The thread confirmed that Dependabot does not currently touch `allowScripts`, which is the right behavior.

The broader issue is that IDE extensions, AI coding agents, and automated "fix the build" workflows already modify `package.json`. As `allowScripts` becomes a normal part of that file, there will be natural pressure for tools to resolve pending approval warnings by updating the allowlist — because resolving warnings is what they are built to do.

The docs should state explicitly that `allowScripts` is a code-execution permission list, not ordinary package metadata. Automated modification of it should be treated as security-sensitive.

Because `allowScripts` lives inside `package.json`, CODEOWNERS alone may not be enough to protect it at field level. A CI check may be needed to flag PRs that expand `allowScripts`, remove `denyScripts` entries, change `false` to `true`, or add name-only approvals without a deliberate human approval commit.

* * *

None of this is a v12 blocker. The core change is the right call and a real improvement to the ecosystem's default security posture, and the pre.1 progress shows the team is actively tightening the edges.

These feel like the layer that determines whether `allowScripts` becomes a real audit trail or a list developers learn to clear as quickly as possible. The foundation is solid — I plan to open an issue in `npm/cli` to track the review-report idea specifically, and will link back here when that's up.

👍 1

All reactions

-   👍 1

[![@vbjay](https://avatars.githubusercontent.com/u/3629489?s=60&v=4)](/vbjay)

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

#### 

[vbjay](/vbjay) [Jun 13, 2026](#discussioncomment-17290751)

See [npm/rfcs#897](https://github.com/npm/rfcs/issues/897)

All reactions

[![@vbjay](https://avatars.githubusercontent.com/u/3629489?s=60&v=4)](/vbjay)

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

#### 

[vbjay](/vbjay) [Jun 14, 2026](#discussioncomment-17299261)

Also see the work in [vbjay/npm-cli#1](https://github.com/vbjay/npm-cli/pull/1). Copilot keeps mucking with the description and title but it's my attempt at adding the reporting to npm. Eventually when I get this to where I see it I will merge into finalized pr branch that I can submit to npm repo. Feel free to review or send feedback. If you feel the rfc needs work send feedback on that too. I'm just kicking the ball around trying to showcase my vision on the reporting.

All reactions

[![@vbjay](https://avatars.githubusercontent.com/u/3629489?s=60&v=4)](/vbjay)

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

#### 

[vbjay](/vbjay) [Jun 14, 2026](#discussioncomment-17299802)

Example from my smoke test in the work

## ✅ PASS — approve-scripts smoke report

All packages with lifecycle scripts are correctly identified as **pending** approval.

Package

Type

Status

Top risks

`@sentry/cli@1.77.3`

transitive

⏳ pending

makes network requests, may write outside the package directory, uses child\_process (can spawn external commands)

`canvas@2.11.2`

direct

⏳ pending

builds native code (node-gyp / binding.gyp)

`esbuild@0.20.0`

direct

⏳ pending

uses child\_process (can spawn external commands), makes network requests

Full Markdown report

# npm Lifecycle Script Approval Review

> **Note:** This report is best-effort and does not claim to prove a package is safe.  
> A human must review this evidence before approving or denying any package.

## Package: @sentry/cli@1.77.3

**Location:** `node_modules/@sentry/cli`  
**Dependency type:** transitive  
**Approval status:** pending  
**Change:** no previous approval found (new)

**Introduced by:**

-   allow-scripts-demo → @sentry/webpack-plugin@1.21.0 → @sentry/cli@1.77.3
-   allow-scripts-demo → ember-cli-deploy-sentry-cli@3.1.0 → @sentry/cli@1.77.3

**Lifecycle scripts:**

{
  "install": "node ./scripts/install.js"
}

### Referenced files

#### `scripts/install.js`

**Reason:** referenced by lifecycle script: `install`  
**SHA-256:** `f693c46a257952dd4f4c76cc7f7c3ab4536599e2ad0548a27d7a8183536f6c93`  
**Size:** 839 B

**Detected signals:**

-   reads process.env
-   makes network requests
-   may write outside the package directory
-   imports local files

**Local imports:**

-   `js/install.js`

#### `js/install.js`

**Reason:** required by ./scripts/install.js  
**SHA-256:** `a15ee1c659fe9f3368eb99cde08f424f4b44cf963fa8b9c6427458a970a95e2c`  
**Size:** 8.9 kB

**Detected signals:**

-   reads process.env
-   makes network requests
-   writes files to disk
-   may write outside the package directory
-   references external URLs
-   imports local files

**Local imports:**

-   `js/helper.js`
-   `package.json`
-   `js/logger.js`

#### `js/helper.js`

**Reason:** required by ./js/install.js  
**SHA-256:** `76f511fd75cf4cb2afc251a9ba62ecbbc8aeb571233d13e4958a4d82f2a1359c`  
**Size:** 6.1 kB

**Detected signals:**

-   uses child\_process (can spawn external commands)
-   reads process.env

#### `package.json`

**Reason:** required by ./js/install.js  
**SHA-256:** `8ab62ccee75956b622201e5d16bccec41c6883b0771146310bc6ded8e26f5a9d`  
**Size:** 1.9 kB

**Detected signals:**

-   references external URLs

#### `js/logger.js`

**Reason:** required by ./js/install.js  
**SHA-256:** `d7d63601d3347efc93425f4f93049cfb9ed2b9ead1dce662c9c1bed3cba302e0`  
**Size:** 253 B

### Risk summary

-   makes network requests
-   may write outside the package directory
-   uses child\_process (can spawn external commands)

### Suggested review focus

-   confirm what remote endpoints are contacted and whether responses are verified
-   confirm whether file writes are scoped to the package directory
-   confirm what external commands are executed and whether they are constrained

* * *

## Package: canvas@2.11.2

**Location:** `node_modules/canvas`  
**Dependency type:** direct  
**Approval status:** pending  
**Change:** no previous approval found (new)

**Introduced by:**

-   allow-scripts-demo → canvas@2.11.2

**Lifecycle scripts:**

{
  "install": "node-gyp rebuild"
}

### Referenced files

#### `<inline>`

**Reason:** inline lifecycle script: `install`

**Detected signals:**

-   builds native code (node-gyp / binding.gyp)

### Native build (node-gyp)

**`binding.gyp` SHA-256:** `684e491f30b36151ebc98bef3eef17a1078b1227003ceaea6fec355441813666`

> **Warning:** `binding.gyp` could not be parsed: Expected ',' or '\]' after array element in JSON at position 680 (line 26 column 5)  
> Inspect the file manually before approving.

### Risk summary

-   builds native code (node-gyp / binding.gyp)

### Suggested review focus

-   review the binding.gyp targets — inspect native source files for unsafe C/C++ operations, verify external library dependencies are expected, and check platform-specific conditions

* * *

## Package: esbuild@0.20.0

**Location:** `node_modules/esbuild`  
**Dependency type:** direct  
**Approval status:** pending  
**Change:** no previous approval found (new)

**Introduced by:**

-   allow-scripts-demo → esbuild@0.20.0

**Lifecycle scripts:**

{
  "postinstall": "node install.js"
}

### Referenced files

#### `install.js`

**Reason:** referenced by lifecycle script: `postinstall`  
**SHA-256:** `a061231445c23fe8ed9f1f102a639adc796982541b3cc5976beb7544dca24a77`  
**Size:** 11.0 kB

**Detected signals:**

-   uses child\_process (can spawn external commands)
-   reads process.env
-   makes network requests
-   references external URLs

### Risk summary

-   uses child\_process (can spawn external commands)
-   makes network requests

### Suggested review focus

-   confirm what external commands are executed and whether they are constrained
-   confirm what remote endpoints are contacted and whether responses are verified

* * *

JSON report

{
  "packages": \[
    {
      "name": "@sentry/cli",
      "version": "1.77.3",
      "location": "node\_modules/@sentry/cli",
      "approvalStatus": "pending",
      "dependencyType": "transitive",
      "introducedBy": \[
        \[
          "allow-scripts-demo",
          "@sentry/webpack-plugin@1.21.0",
          "@sentry/cli@1.77.3"
        \],
        \[
          "allow-scripts-demo",
          "ember-cli-deploy-sentry-cli@3.1.0",
          "@sentry/cli@1.77.3"
        \]
      \],
      "lifecycleScripts": {
        "install": "node ./scripts/install.js"
      },
      "referencedFiles": \[
        {
          "path": "scripts/install.js",
          "reason": "referenced by lifecycle script: \`install\`",
          "sha256": "f693c46a257952dd4f4c76cc7f7c3ab4536599e2ad0548a27d7a8183536f6c93",
          "sizeBytes": 839,
          "signals": \[
            "reads-process-env",
            "network-access",
            "writes-outside-package",
            "requires-local-file"
          \],
          "references": \[
            "js/install.js"
          \]
        },
        {
          "path": "js/install.js",
          "reason": "required by ./scripts/install.js",
          "sha256": "a15ee1c659fe9f3368eb99cde08f424f4b44cf963fa8b9c6427458a970a95e2c",
          "sizeBytes": 8907,
          "signals": \[
            "reads-process-env",
            "network-access",
            "writes-file",
            "writes-outside-package",
            "external-url",
            "requires-local-file"
          \],
          "references": \[
            "js/helper.js",
            "package.json",
            "js/logger.js"
          \]
        },
        {
          "path": "js/helper.js",
          "reason": "required by ./js/install.js",
          "sha256": "76f511fd75cf4cb2afc251a9ba62ecbbc8aeb571233d13e4958a4d82f2a1359c",
          "sizeBytes": 6128,
          "signals": \[
            "uses-child-process",
            "reads-process-env"
          \],
          "references": \[\]
        },
        {
          "path": "package.json",
          "reason": "required by ./js/install.js",
          "sha256": "8ab62ccee75956b622201e5d16bccec41c6883b0771146310bc6ded8e26f5a9d",
          "sizeBytes": 1903,
          "signals": \[
            "external-url"
          \],
          "references": \[\]
        },
        {
          "path": "js/logger.js",
          "reason": "required by ./js/install.js",
          "sha256": "d7d63601d3347efc93425f4f93049cfb9ed2b9ead1dce662c9c1bed3cba302e0",
          "sizeBytes": 253,
          "signals": \[\],
          "references": \[\]
        }
      \],
      "nativeBuildInfo": null,
      "changeClassification": {
        "status": "new",
        "previousApprovedVersion": null
      },
      "riskSummary": \[
        "makes network requests",
        "may write outside the package directory",
        "uses child\_process (can spawn external commands)"
      \],
      "suggestedReviewFocus": \[
        "confirm what remote endpoints are contacted and whether responses are verified",
        "confirm whether file writes are scoped to the package directory",
        "confirm what external commands are executed and whether they are constrained"
      \]
    },
    {
      "name": "canvas",
      "version": "2.11.2",
      "location": "node\_modules/canvas",
      "approvalStatus": "pending",
      "dependencyType": "direct",
      "introducedBy": \[
        \[
          "allow-scripts-demo",
          "canvas@2.11.2"
        \]
      \],
      "lifecycleScripts": {
        "install": "node-gyp rebuild"
      },
      "referencedFiles": \[
        {
          "path": null,
          "reason": "inline lifecycle script: \`install\`",
          "sha256": null,
          "sizeBytes": null,
          "signals": \[
            "native-build"
          \],
          "references": \[\]
        }
      \],
      "nativeBuildInfo": {
        "sha256": "684e491f30b36151ebc98bef3eef17a1078b1227003ceaea6fec355441813666",
        "targets": \[\],
        "parseError": "Expected ',' or '\]' after array element in JSON at position 680 (line 26 column 5)"
      },
      "changeClassification": {
        "status": "new",
        "previousApprovedVersion": null
      },
      "riskSummary": \[
        "builds native code (node-gyp / binding.gyp)"
      \],
      "suggestedReviewFocus": \[
        "review the binding.gyp targets — inspect native source files for unsafe C/C++ operations, verify external library dependencies are expected, and check platform-specific conditions"
      \]
    },
    {
      "name": "esbuild",
      "version": "0.20.0",
      "location": "node\_modules/esbuild",
      "approvalStatus": "pending",
      "dependencyType": "direct",
      "introducedBy": \[
        \[
          "allow-scripts-demo",
          "esbuild@0.20.0"
        \]
      \],
      "lifecycleScripts": {
        "postinstall": "node install.js"
      },
      "referencedFiles": \[
        {
          "path": "install.js",
          "reason": "referenced by lifecycle script: \`postinstall\`",
          "sha256": "a061231445c23fe8ed9f1f102a639adc796982541b3cc5976beb7544dca24a77",
          "sizeBytes": 10963,
          "signals": \[
            "uses-child-process",
            "reads-process-env",
            "network-access",
            "external-url"
          \],
          "references": \[\]
        }
      \],
      "nativeBuildInfo": null,
      "changeClassification": {
        "status": "new",
        "previousApprovedVersion": null
      },
      "riskSummary": \[
        "uses child\_process (can spawn external commands)",
        "makes network requests"
      \],
      "suggestedReviewFocus": \[
        "confirm what external commands are executed and whether they are constrained",
        "confirm what remote endpoints are contacted and whether responses are verified"
      \]
    }
  \]
}

All reactions

[![@vbjay](https://avatars.githubusercontent.com/u/3629489?s=60&v=4)](/vbjay)

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

#### 

[vbjay](/vbjay) [Jun 14, 2026](#discussioncomment-17301144)

Asked github copilot Claude Sonnet 4.6 to review the lifecycle scripts from this json.

{
  "packages": \[
    {
      "name": "@sentry/cli",
      "version": "1.77.3",
      "location": "node\_modules/@sentry/cli",
      "approvalStatus": "pending",
      "dependencyType": "transitive",
      "introducedBy": \[
        \[
          "allow-scripts-demo",
          "@sentry/webpack-plugin@1.21.0",
          "@sentry/cli@1.77.3"
        \],
        \[
          "allow-scripts-demo",
          "ember-cli-deploy-sentry-cli@3.1.0",
          "@sentry/cli@1.77.3"
        \]
      \],
      "lifecycleScripts": {
        "install": "node ./scripts/install.js"
      },
      "referencedFiles": \[
        {
          "path": "scripts/install.js",
          "reason": "referenced by lifecycle script: \`install\`",
          "sha256": "f693c46a257952dd4f4c76cc7f7c3ab4536599e2ad0548a27d7a8183536f6c93",
          "sizeBytes": 839,
          "signals": \[
            "reads-process-env",
            "network-access",
            "writes-outside-package",
            "requires-local-file"
          \],
          "references": \[
            "js/install.js"
          \]
        },
        {
          "path": "js/install.js",
          "reason": "required by ./scripts/install.js",
          "sha256": "a15ee1c659fe9f3368eb99cde08f424f4b44cf963fa8b9c6427458a970a95e2c",
          "sizeBytes": 8907,
          "signals": \[
            "reads-process-env",
            "network-access",
            "writes-file",
            "writes-outside-package",
            "external-url",
            "requires-local-file"
          \],
          "references": \[
            "js/helper.js",
            "package.json",
            "js/logger.js"
          \]
        },
        {
          "path": "js/helper.js",
          "reason": "required by ./js/install.js",
          "sha256": "76f511fd75cf4cb2afc251a9ba62ecbbc8aeb571233d13e4958a4d82f2a1359c",
          "sizeBytes": 6128,
          "signals": \[
            "uses-child-process",
            "reads-process-env"
          \],
          "references": \[\]
        },
        {
          "path": "package.json",
          "reason": "required by ./js/install.js",
          "sha256": "8ab62ccee75956b622201e5d16bccec41c6883b0771146310bc6ded8e26f5a9d",
          "sizeBytes": 1903,
          "signals": \[
            "external-url"
          \],
          "references": \[\]
        },
        {
          "path": "js/logger.js",
          "reason": "required by ./js/install.js",
          "sha256": "d7d63601d3347efc93425f4f93049cfb9ed2b9ead1dce662c9c1bed3cba302e0",
          "sizeBytes": 253,
          "signals": \[\],
          "references": \[\]
        }
      \],
      "nativeBuildInfo": null,
      "changeClassification": {
        "status": "new",
        "previousApprovedVersion": null,
        "hasPreviousDeny": false
      },
      "riskSummary": \[
        "makes network requests",
        "may write outside the package directory",
        "uses child\_process (can spawn external commands)"
      \],
      "suggestedReviewFocus": \[
        "confirm what remote endpoints are contacted and whether responses are verified",
        "confirm whether file writes are scoped to the package directory",
        "confirm what external commands are executed and whether they are constrained"
      \]
    },
    {
      "name": "canvas",
      "version": "2.11.2",
      "location": "node\_modules/canvas",
      "approvalStatus": "pending",
      "dependencyType": "direct",
      "introducedBy": \[
        \[
          "allow-scripts-demo",
          "canvas@2.11.2"
        \]
      \],
      "lifecycleScripts": {
        "install": "node-gyp rebuild"
      },
      "referencedFiles": \[
        {
          "path": null,
          "reason": "inline lifecycle script: \`install\`",
          "sha256": null,
          "sizeBytes": null,
          "signals": \[
            "native-build"
          \],
          "references": \[\]
        }
      \],
      "nativeBuildInfo": {
        "sha256": "684e491f30b36151ebc98bef3eef17a1078b1227003ceaea6fec355441813666",
        "targets": \[
          {
            "name": "canvas-postbuild",
            "sources": \[\],
            "libraries": \[\],
            "includeDirs": \[\],
            "hasConditions": true
          },
          {
            "name": "canvas",
            "sources": \[
              "src/backend/Backend.cc",
              "src/backend/ImageBackend.cc",
              "src/backend/PdfBackend.cc",
              "src/backend/SvgBackend.cc",
              "src/bmp/BMPParser.cc",
              "src/Backends.cc",
              "src/Canvas.cc",
              "src/CanvasGradient.cc",
              "src/CanvasPattern.cc",
              "src/CanvasRenderingContext2d.cc",
              "src/closure.cc",
              "src/color.cc",
              "src/Image.cc",
              "src/ImageData.cc",
              "src/init.cc",
              "src/register\_font.cc"
            \],
            "libraries": \[
              "\-l<(GTK\_Root)/lib/cairo.lib",
              "\-l<(GTK\_Root)/lib/libpng.lib",
              "\-l<(GTK\_Root)/lib/pangocairo-1.0.lib",
              "\-l<(GTK\_Root)/lib/pango-1.0.lib",
              "\-l<(GTK\_Root)/lib/freetype.lib",
              "\-l<(GTK\_Root)/lib/glib-2.0.lib",
              "\-l<(GTK\_Root)/lib/gobject-2.0.lib",
              "<!@(pkg-config pixman-1 --libs)",
              "<!@(pkg-config cairo --libs)",
              "<!@(pkg-config libpng --libs)",
              "<!@(pkg-config pangocairo --libs)",
              "<!@(pkg-config freetype2 --libs)",
              "\-l<(jpeg\_root)/lib/jpeg.lib",
              "<!@(pkg-config libjpeg --libs)",
              "\-l<(GTK\_Root)/lib/gif.lib",
              "\-L/opt/homebrew/lib",
              "\-lgif",
              "\-l<(GTK\_Root)/lib/librsvg-2-2.lib",
              "<!@(pkg-config librsvg-2.0 --libs)"
            \],
            "includeDirs": \[
              "<!(node -e \\"require('nan')\\")",
              "<(GTK\_Root)/include",
              "<(GTK\_Root)/include/cairo",
              "<(GTK\_Root)/include/pango-1.0",
              "<(GTK\_Root)/include/glib-2.0",
              "<(GTK\_Root)/include/freetype2",
              "<(GTK\_Root)/lib/glib-2.0/include",
              "<!@(pkg-config cairo --cflags-only-I | sed s/-I//g)",
              "<!@(pkg-config libpng --cflags-only-I | sed s/-I//g)",
              "<!@(pkg-config pangocairo --cflags-only-I | sed s/-I//g)",
              "<!@(pkg-config freetype2 --cflags-only-I | sed s/-I//g)",
              "<(jpeg\_root)/include",
              "<!@(pkg-config libjpeg --cflags-only-I | sed s/-I//g)",
              "/opt/homebrew/include",
              "<!@(pkg-config librsvg-2.0 --cflags-only-I | sed s/-I//g)"
            \],
            "hasConditions": true
          }
        \],
        "parseError": null
      },
      "changeClassification": {
        "status": "new",
        "previousApprovedVersion": null,
        "hasPreviousDeny": false
      },
      "riskSummary": \[
        "builds native code (node-gyp / binding.gyp)"
      \],
      "suggestedReviewFocus": \[
        "review the binding.gyp targets — inspect native source files for unsafe C/C++ operations, verify external library dependencies are expected, and check platform-specific conditions"
      \]
    },
    {
      "name": "esbuild",
      "version": "0.20.0",
      "location": "node\_modules/esbuild",
      "approvalStatus": "pending",
      "dependencyType": "direct",
      "introducedBy": \[
        \[
          "allow-scripts-demo",
          "esbuild@0.20.0"
        \]
      \],
      "lifecycleScripts": {
        "postinstall": "node install.js"
      },
      "referencedFiles": \[
        {
          "path": "install.js",
          "reason": "referenced by lifecycle script: \`postinstall\`",
          "sha256": "a061231445c23fe8ed9f1f102a639adc796982541b3cc5976beb7544dca24a77",
          "sizeBytes": 10963,
          "signals": \[
            "uses-child-process",
            "reads-process-env",
            "network-access",
            "external-url"
          \],
          "references": \[\]
        }
      \],
      "nativeBuildInfo": null,
      "changeClassification": {
        "status": "new",
        "previousApprovedVersion": null,
        "hasPreviousDeny": false
      },
      "riskSummary": \[
        "uses child\_process (can spawn external commands)",
        "makes network requests"
      \],
      "suggestedReviewFocus": \[
        "confirm what external commands are executed and whether they are constrained",
        "confirm what remote endpoints are contacted and whether responses are verified"
      \]
    }
  \]
}

* * *

# npm Lifecycle Script Approval Review

> **Note:** This report is best-effort and does not claim to prove a package is safe. A human must review this evidence before approving or denying any package.

* * *

## Package: `@sentry/cli@1.77.3`

Field

Value

**Location**

`node_modules/@sentry/cli`

**Dependency type**

Transitive

**Approval status**

Pending

**Change**

No previous approval found (new)

**Introduced by:**

-   `allow-scripts-demo` → `@sentry/webpack-plugin@1.21.0` → `@sentry/cli@1.77.3`
-   `allow-scripts-demo` → `ember-cli-deploy-sentry-cli@3.1.0` → `@sentry/cli@1.77.3`

**Lifecycle scripts:**

```
install: node ./scripts/install.js
```

### Risk summary

-   ⚠️ Makes network requests
-   ⚠️ May write outside the package directory
-   ⚠️ Uses `child_process` (can spawn external commands)

### Referenced files

#### `scripts/install.js` — 839 bytes

SHA-256: `f693c46a...`  
**Reason:** Referenced by lifecycle script `install`

Signal

Assessment

`reads-process-env`

Platform/arch detection — expected for a binary downloader

`network-access`

Delegates download to `js/install.js`

`writes-outside-package`

Binary likely written outside `node_modules/@sentry/cli/`

`requires-local-file`

Delegates to `js/install.js`

Thin entry-point shim. All significant risk lives in the files it requires.

* * *

#### `js/install.js` — 8,907 bytes

SHA-256: `a15ee1c6...`  
**Reason:** Required by `./scripts/install.js`

Signal

Assessment

`reads-process-env`

Platform/arch/version detection; may read `SENTRY_CLI_*` env vars to override download URL

`network-access`

Downloads the platform-specific `sentry-cli` binary at install time

`external-url`

A versioned CDN URL (e.g. `https://downloads.sentry-cdn.com/sentry-cli/1.77.3/…`) — **verify it is pinned to this version, not a floating `latest`**

`writes-file`

Writes the downloaded binary to disk

`writes-outside-package`

Binary destination is outside `node_modules/@sentry/cli/` — **verify exact write path**

`requires-local-file`

Chains to `js/helper.js`, `package.json`, `js/logger.js`

This is the canonical **binary-downloader** pattern. The package ships no native binary; the install script fetches the correct platform binary from an external CDN.

* * *

#### `js/helper.js` — 6,128 bytes

SHA-256: `76f511fd...`  
**Reason:** Required by `./js/install.js`

Signal

Assessment

`uses-child-process`

Likely used to make the downloaded binary executable (`chmod +x`) or run a post-install check — **confirm what command is spawned and what arguments are passed**

`reads-process-env`

Platform detection, or reads env vars to control behavior

No further `references` — chain terminates here.

* * *

#### `package.json` — 1,903 bytes

SHA-256: `8ab62cce...`  
**Reason:** Required by `./js/install.js`

Signal

Assessment

`external-url`

Contains at least one hardcoded external URL — likely the download base URL for the binary. **Verify the URL domain is `sentry.io` or `sentry-cdn.com` and that it includes the pinned version `1.77.3`**

* * *

#### `js/logger.js` — 253 bytes

SHA-256: `d7d63601...`  
**Reason:** Required by `./js/install.js`

No signals detected. Logging utility only — no independent risk.

* * *

### Suggested review focus

1.  **Confirm remote endpoints** — open `js/install.js` and verify the download URL is pinned to `1.77.3` and points to a Sentry-owned domain. Check `package.json` for the base URL.
2.  **Verify integrity checking** — does `js/install.js` or `js/helper.js` verify a checksum or signature of the downloaded binary before writing it?
3.  **Confirm write path** — trace `writes-outside-package` to the exact destination directory.
4.  **Confirm child process scope** — check `js/helper.js` to see what command is spawned; expected to be `chmod +x <binary>` or similar, not an arbitrary shell command.

* * *

* * *

## Package: `canvas@2.11.2`

Field

Value

**Location**

`node_modules/canvas`

**Dependency type**

Direct

**Approval status**

Pending

**Change**

No previous approval found (new)

**Introduced by:**

-   `allow-scripts-demo` → `canvas@2.11.2`

**Lifecycle scripts:**

```
install: node-gyp rebuild
```

### Risk summary

-   ⚠️ Builds native code (`node-gyp` / `binding.gyp`)

### Referenced files

#### `(inline: node-gyp rebuild)`

**Reason:** Inline lifecycle script `install`

Signal

Assessment

`native-build`

Compiles C++ source files on the install machine via `node-gyp`

No separate install script — the command is inline. All risk is in the native build targets.

* * *

### Native build (`binding.gyp`)

SHA-256: `684e491f...` — **`parseError: null` — parsed successfully**

**Targets (2):**

#### Target: `canvas-postbuild`

-   Sources: none listed
-   Libraries: none listed
-   Include dirs: none listed
-   **Has platform conditions:** yes

Post-build step with platform conditions. Likely runs a post-compile fixup (e.g. stripping debug symbols or copying a prebuilt binary). Verify what the conditions control.

#### Target: `canvas`

-   **16 C++ source files** — all under `src/` (Canvas, Image, PDF/SVG backends, BMP parser, gradients, patterns, fonts, color)
-   **Has platform conditions:** yes

**Libraries linked:**

Library

Assessment

`cairo`, `libpng`, `pangocairo`, `pango`, `freetype`

Standard 2D graphics stack — expected for a canvas implementation

`libjpeg`

JPEG decode/encode — expected

`gif`

GIF support — expected

`librsvg-2.0`

SVG rendering — expected

`glib-2.0`, `gobject-2.0`

GLib runtime (GTK dependency) — expected on Linux/Windows

`pixman-1`

Pixel manipulation (cairo dependency) — expected

`<(GTK_Root)/lib/…`

Windows path via a `GTK_Root` variable — platform-specific Windows build only

`<!@(pkg-config … --libs)`

Shell expansion calls `pkg-config` at build time to resolve system library paths — **standard GYP pattern, but means build-time shell execution**

**Include dirs:** All map to standard system headers for the above libraries plus `nan` (Node addon helper). None are unexpected.

* * *

### Suggested review focus

1.  **Platform conditions** — both targets have `hasConditions: true`. Review the conditions in `binding.gyp` directly to confirm no condition activates a remote download or unexpected code path.
2.  **`<!@(pkg-config …)` shell expansions** — GYP evaluates these at build time. Confirm none of the `pkg-config` invocations have been tampered with (supply-chain check: does the `binding.gyp` SHA-256 match the published tarball?).
3.  **Source file audit** — 16 `.cc` files compile directly on the target machine. For a security-critical environment, spot-check `src/Canvas.cc` and `src/init.cc` for any dynamic code loading, `eval`\-equivalent patterns, or network calls from C++.
4.  **`nan` dependency** — verify the `nan` version is pinned and not itself a lifecycle-script risk.

* * *

* * *

## Package: `esbuild@0.20.0`

Field

Value

**Location**

`node_modules/esbuild`

**Dependency type**

Direct

**Approval status**

Pending

**Change**

No previous approval found (new)

**Introduced by:**

-   `allow-scripts-demo` → `esbuild@0.20.0`

**Lifecycle scripts:**

```
postinstall: node install.js
```

### Risk summary

-   ⚠️ Uses `child_process` (can spawn external commands)
-   ⚠️ Makes network requests

### Referenced files

#### `install.js` — 10,963 bytes

SHA-256: `a061231445...`  
**Reason:** Referenced by lifecycle script `postinstall`

Signal

Assessment

`uses-child-process`

Spawns a child process — likely `npm install` or a platform binary fetch; esbuild's well-known pattern is to use `child_process.execFileSync` to run the platform-specific `esbuild` binary package install

`reads-process-env`

Platform/arch/version detection

`network-access`

May download the platform binary directly (alternative to the optional-dependencies pattern in newer versions)

`external-url`

Hardcoded URL present — **verify it is pinned to `0.20.0` and points to `registry.npmjs.org` or `github.com/evanw/esbuild`**

No further `references` — `install.js` does not chain to other local files.

* * *

### Suggested review focus

1.  **Confirm child process command** — esbuild's `install.js` in `0.20.0` typically calls `child_process.execFileSync` with a platform-specific npm package name. Verify the spawned command is `npm install --prefer-offline <platform-pkg>` or similar — not an arbitrary shell string.
2.  **Confirm external URL** — verify the URL points to the official npm registry or the esbuild GitHub releases page, and that it includes the pinned version `0.20.0`.
3.  **No `writes-outside-package` signal** — unlike `@sentry/cli`, esbuild does not report writes outside its package directory. This is consistent with the `optionalDependencies` pattern where the binary lands inside `node_modules/`. Confirm this is still the case for `0.20.0`.

* * *

* * *

## Overall approval recommendation

Package

Risk level

Recommendation

`@sentry/cli@1.77.3`

**Elevated** — binary downloader, network access, writes outside package, child process

Approve after confirming: download URL is pinned + versioned, integrity is checked, binary write path is as expected

`canvas@2.11.2`

**Medium** — native build from source, standard well-known library stack

Approve after confirming: `binding.gyp` conditions don't trigger unexpected behavior, `pkg-config` expansions are not tampered

`esbuild@0.20.0`

**Low–Medium** — binary installer, well-known package with a transparent install pattern

Approve after confirming: child process command is scoped to a platform package install, external URL is pinned

All three packages are well-known, widely-used, and their install-script patterns are publicly documented. None show signals outside what is expected for their respective patterns. The primary human verification step for each is confirming the exact download URLs and child process invocations match the published package source.

* * *

This is what I was trying to get to. Not just saying go review these packages but having it help you review. Json for cli and ai bot analysis and markdown for the Github comments and human report view.

All reactions

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

### 

[![](https://avatars.githubusercontent.com/u/291881766?s=64&v=4)

yatendraaorg

](/yatendraaorg)[Jun 11, 2026](#discussioncomment-17271393)

GitHu b.commeams

0 You must be logged in to vote

👍 1 👎 1 ❤️ 1

All reactions

-   👍 1
-   👎 1
-   ❤️ 1

0 replies

### 

This comment was marked as low quality.

[Sign in to view](/login?return_to=https%3A%2F%2Fgithub.com%2Forgs%2Fcommunity%2Fdiscussions%2F198547)

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

### 

[![](https://avatars.githubusercontent.com/u/264682515?s=64&v=4)

piiiico

](/piiiico)[Jun 14, 2026](#discussioncomment-17296185)

One gap that npm v12 does not address: even with install scripts blocked, a compromised package can still execute malicious code at import time (`require`/`import`). The real supply chain risk is **who controls the package** — one maintainer with publish access and no co-maintainers can push any payload, install script or not.

We built [Commit](https://getcommit.dev) to score exactly this: publisher concentration, release consistency, maintainer depth — behavioral signals that flag structural risk _before_ a package is compromised. For example, `chalk` gets a healthy score from Snyk (81/100) but scores CRITICAL on Commit signals (1 active publisher, 445M weekly downloads — [blog post](https://getcommit.dev/blog/snyk-scores-chalk-81-we-score-it-critical/)). Similar patterns appeared in `axios` and `LiteLLM` before their 2026 compromises.

For teams migrating CI to npm v12: worth running your critical dependencies through a behavioral signal check alongside the install script review. Free audit at [getcommit.dev/audit](https://getcommit.dev/audit).

2 You must be logged in to vote

👍 1

All reactions

-   👍 1

1 reply

[![@vbjay](https://avatars.githubusercontent.com/u/3629489?s=60&v=4)](/vbjay)

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

#### 

[vbjay](/vbjay) [Jun 17, 2026](#discussioncomment-17332977)

See this [comment](https://github.com/orgs/community/discussions/198547#discussioncomment-17301144) You aren't wrong aren't wrong on the includes. I am working on a more detailed reporting and have a couple more things to go though before making a pr for npm. We need a better full analysis of npm and other package systems. See he [RFC](https://github.com/npm/rfcs/issues/897) I wrote for the gist of what I am going for. Interested in your ideas. based on the commit work you referenced.

All reactions

### 

This comment was marked as off-topic.

[Sign in to view](/login?return_to=https%3A%2F%2Fgithub.com%2Forgs%2Fcommunity%2Fdiscussions%2F198547)

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

### 

[![](https://avatars.githubusercontent.com/u/42135534?s=64&v=4)

Jakeshadow

](/Jakeshadow)[Jun 15, 2026](#discussioncomment-17309472)

Thanks for this detailed migration guide. For anyone looking for a step-by-step walkthrough of all the v12  
breaking changes, I've been maintaining a companion guide at [https://npmv12guide.com](https://npmv12guide.com) that covers:

-   Migration recipes for common native packages (sharp, better-sqlite3, canvas, bcrypt, esbuild)
-   CI/CD integration patterns for the new `approve-scripts` workflow
-   A decision tree: `approve-scripts` vs `--allow-scripts` vs allowlist in `package.json`
-   Monorepo migration (per-workspace approval)
-   npm 11 vs 12 side-by-side comparison

6 breaking changes ranked P0–P2 with copy-paste fixes. Hope it helps folks preparing for the transition.

1 You must be logged in to vote

All reactions

0 replies

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

edited

### Uh oh!

There was an error while loading. Please reload this page.

### 

[![](https://avatars.githubusercontent.com/u/2827783?s=64&v=4)

myovchev

](/myovchev)[Jun 18, 2026](#discussioncomment-17350542)

My really great concern is not related with the breaking change now, but what it brings in the future. I hope that every package maintainer understands that introducing install hooks is a breaking change from the moment v12 is out.

Hope is not a good thing when one "minor dep update introducing postinstall" can break the world. I'd like to see the npm maintainers to shout that part as loud as possible.

Just to clarify - I'm not against what `npm` direction is, it's something that has to be done. I'm just mentally dealing with the consequences.

2 You must be logged in to vote

All reactions

0 replies

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

### 

[![](https://avatars.githubusercontent.com/u/280571201?s=64&v=4)

armorer-labs

](/armorer-labs)[Jun 26, 2026](#discussioncomment-17444730)

This is a good default shift, especially for CI and agent-run environments where `npm install` may be happening inside a workflow that was triggered by issue text, PR text, generated patches, or other untrusted instructions.

The migration detail I would want teams to preserve is not only "which packages are allowed to run scripts," but the decision context around that allowlist. A few practical additions would make this much easier to operate at scale:

-   include the effective script policy in CI run metadata, after project config, user config, and npm defaults have been resolved
-   distinguish "script skipped because not approved" from "script skipped because global ignore-scripts still wins" in a way machines can consume
-   record whether an approved script was version-pinned, package-name-only, or inherited from a broader migration snapshot
-   make new pending script approvals show up as a reviewable artifact in CI, not only as console output that gets lost in long install logs
-   for agent-triggered workflows, treat any newly pending install script, git dependency, or remote tarball as a capability escalation that requires an explicit approval path before the agent can continue

The v12 behavior closes a big accidental execution path, but the audit trail matters too. Six months later, the question is usually not just "did install scripts run?" It is "who or what approved this package/version/source to run code in this workspace, and was that approval still valid for this run?"

Disclosure: I work on Armorer Labs.

1 You must be logged in to vote

All reactions

0 replies

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

### 

[![](https://avatars.githubusercontent.com/u/42135534?s=64&v=4)

Jakeshadow

](/Jakeshadow)[Jul 3, 2026](#discussioncomment-17524918)

This is a great overview. Having already migrated several projects (including a monorepo with 40+ native dependencies), here are the edge cases the official steps don't cover — and how to handle them.

## 1\. The "install then approve" chicken-and-egg problem

If you set `strict-allow-scripts=true` first, you can't install new packages with scripts. If you don't set it, you're unprotected. The workflow that actually works:

# Phase 1: snapshot current state (no strict mode yet)
npm install
npm approve-scripts --all
git commit -m "chore: initial allowScripts snapshot"

# Phase 2: turn on enforcement
npm config set strict-allow-scripts true --location=project

# Phase 3: for every NEW package after this point
npm install <pkg\>                    # installs but skips scripts (warns)
npm approve-scripts <pkg\>            # pin it to the installed version
npm install <pkg\>                    # re-run: now scripts execute

This three-phase pattern gets you from unprotected → opted-in with zero downtime, unlike the "approve first" approach which can't work for packages not yet in your tree.

## 2\. Native modules break even without an install script

`node-gyp rebuild` runs implicitly for any package with a `binding.gyp`. This means packages like `sharp`, `better-sqlite3`, and `bcrypt` fail at runtime with a confusing `MODULE_NOT_FOUND` — not a clear "script blocked" warning. Diagnose with:

npm approve-scripts --allow-scripts-pending | grep -E "node-gyp|binding\\.gyp"

Then explicitly approve `node-gyp` itself plus each native package. In a monorepo, do this at the workspace root — native deps in sub-packages will inherit the root allowlist.

## 3\. CI: `ignore-scripts` will silently conflict

If your CI has `ignore-scripts=true` in `.npmrc` (common in pre-v12 setups), it takes precedence over your `allowScripts` list — scripts still won't run, but npm won't warn you either. Remove `ignore-scripts` or replace it with `strict-allow-scripts=true` before relying on the allowlist. The safe upgrade path for CI:

# Before: .npmrc had ignore-scripts=true
# After: remove it, then
npm install
npm approve-scripts --allow-scripts-pending  # audit what you actually need
npm approve-scripts --all                     # approve everything tested
echo "strict-allow-scripts=true" \>> .npmrc    # lock the door

## 4\. The `--allow-git` change breaks more than you think

Most people focus on install scripts, but `--allow-git` defaulting to `none` is the silent killer. Private registries that proxy git repos, internal tools that depend on `git+ssh://` URLs, and transient deps that pull git refs all fail with opaque resolution errors. Audit before v12 lands:

grep -r "git+" package.json \*/package.json node\_modules/.package-lock.json 2>/dev/null

If you find any, add `--allow-git` to your CI commands and document it — this flag lives outside the `allowScripts` system entirely.

* * *

These patterns (and the full monorepo, native-module, and CI migration workflows with error messages) are documented at **[https://installsafe.dev](https://installsafe.dev)** — the free guide covers installation and troubleshooting; the manual has complete CI/CD templates and monorepo strategies.

2 You must be logged in to vote

All reactions

3 replies

[![@vbjay](https://avatars.githubusercontent.com/u/3629489?s=60&v=4)](/vbjay)

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

#### 

[vbjay](/vbjay) [Jul 3, 2026](#discussioncomment-17525153)

Thought that was the idea of ignore-scripts. You install with ignore-scripts so you get your tree reified. Then you can run approve-scripts-pending. So you don't just blindly approve all but you actually do the first review and not just a blind --all.

All reactions

[![@vbjay](https://avatars.githubusercontent.com/u/3629489?s=60&v=4)](/vbjay)

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

edited

### Uh oh!

There was an error while loading. Please reload this page.

#### 

[vbjay](/vbjay) [Jul 3, 2026](#discussioncomment-17525214)

See work at [vbjay/npm-cli#1](https://github.com/vbjay/npm-cli/pull/1) for the detailed view of approve-scripts-pending I am working on. This is my working branch and getting things together. Not final idea. However, you can see the idea in [https://github.com/vbjay/npm-cli/actions/runs/28213694377/artifacts/7895878295](https://github.com/vbjay/npm-cli/actions/runs/28213694377/artifacts/7895878295) which was generated from the smoke test I added to help me with the CI building of the work.

All reactions

[![@vbjay](https://avatars.githubusercontent.com/u/3629489?s=60&v=4)](/vbjay)

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

edited

### Uh oh!

There was an error while loading. Please reload this page.

#### 

[vbjay](/vbjay) [Jul 3, 2026](#discussioncomment-17525268)

Also see [nodejs/node-gyp#3333](https://github.com/nodejs/node-gyp/issues/3333) for something I spotted around gyp while doing the work

All reactions

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

### 

[![](https://avatars.githubusercontent.com/u/42135534?s=64&v=4)

Jakeshadow

](/Jakeshadow)[Jul 9, 2026](#discussioncomment-17580130)

I've been tracking the v12 changes since pre.1. The silent CI exit 0 trap is the dangerous one — `npm ci` succeeds but postinstall never ran, so native modules silently skip compilation. Wrote up what I found, including the per-package allowScripts approach and monorepo-specific edge cases: [https://installsafe.dev](https://installsafe.dev)

2 You must be logged in to vote

👀 1

All reactions

-   👀 1

0 replies

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

edited

### Uh oh!

There was an error while loading. Please reload this page.

### 

[![](https://avatars.githubusercontent.com/u/77077656?s=64&v=4)

samigt

](/samigt)[Jul 9, 2026](#discussioncomment-17586383)

Would you please consider a default min-release-age of 48 hours (Cooldown) ?

2 You must be logged in to vote

All reactions

1 reply

[![@leobalter](https://avatars.githubusercontent.com/u/301201?s=60&v=4)](/leobalter)

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

#### 

[leobalter](/leobalter) [Jul 9, 2026](#discussioncomment-17587398)

Maintainer Author

the min-release-age must be configured per user/organization levels individually. While it helps avoiding one issue, the immediately availability of packages remains fundamental for packages that have critical vulnerability patches published and if you are already using a proxy/mirror/firewall system.

Saying that, we have work in progress to contain malware before they ever become available. We are focused to resolve the issue where it is. The min-release-age option continues available to everyone.

👍 1

All reactions

-   👍 1

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

### 

[![](https://avatars.githubusercontent.com/u/1064588?s=64&v=4)

Booyaka101

](/Booyaka101)[Jul 21, 2026](#discussioncomment-17717113)

For anyone staring at their first `allowScripts` list wondering which entries are safe to flip to `true`: I built **[npm-script-lens](https://github.com/Booyaka101/npm-script-lens)** to generate the review evidence.

`npx npm-script-lens audit` fetches each locked package, statically analyzes the actual `preinstall`/`install`/`postinstall` code (including the JS files the scripts run — the `"postinstall": "node install.js"` case), and emits a Markdown report plus a ready-to-paste, version-pinned `allowScripts` block: [sample report](https://github.com/Booyaka101/npm-script-lens/blob/main/fixtures/demo-report.md). HIGH = spawns processes or runs constructed code, MEDIUM = network, LOW = fs/env only. Known-malicious packages (OSV `MAL-*`) are hard-flagged ⛔ and always `false`.

For PRs there's a GitHub Action (report as a PR comment, SARIF for code scanning) and a `--diff` mode that audits only what changed — and for version bumps, reports what the upgrade _gained_ over the old version, which is the fingerprint of a hijacked release. `sync --check` fails CI when your allowScripts block drifts from the lockfile, and `sync --write` re-pins it, preserving approvals for upgrades that gained nothing.

Works with package-lock.json, yarn.lock (classic + berry), pnpm-lock.yaml, and bun.lock. It's evidence, not verdicts — static capability detection with the limitations documented in the README. Feedback very welcome.

2 You must be logged in to vote

All reactions

0 replies

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

### 

[![](https://avatars.githubusercontent.com/u/245219880?s=64&v=4)

muhammadYounus183

](/muhammadYounus183)[Jul 21, 2026](#discussioncomment-17717173)

Helpful migration steps.  
Thanks for sharing.

1 You must be logged in to vote

All reactions

0 replies

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

### 

[![](https://avatars.githubusercontent.com/u/1064588?s=64&v=4)

Booyaka101

](/Booyaka101)[Jul 27, 2026](#discussioncomment-17792982)

The `grep -r 'git+' package.json */package.json node_modules/.package-lock.json` suggestion upthread is the right instinct, but it can't answer the question v12 actually asks you, which is not "do I have git deps" but **which value do I need**.

`allow-git` and `allow-remote` are enums — `all` | `none` | `root` — defaulting to `none` in v12. `root` only covers dependencies declared in your **root** package.json, so one _transitive_ git dep anywhere in the tree forces you all the way to `all`. A grep over package.json files can't distinguish those two cases, and a grep over `node_modules/.package-lock.json` needs an install that v12 will refuse to perform.

I extended npm-script-lens (the install-script auditor I posted about earlier in this thread) to cover it:

```
$ npx npm-script-lens sources
git dependencies (2)
  ROOT        left-pad @ github:left-pad/left-pad
  TRANSITIVE  some-pkg @ git+ssh://git@github.com/a/b.git   via my-lib -> some-pkg
remote dependencies (0)

minimal correct .npmrc:
  allow-git=all

allow-git=all is required because 1 git dependency is transitive; allow-git=root would otherwise suffice.
Re-point or drop `some-pkg` (via my-lib) to tighten this to allow-git=root.
```

It reads package-lock v1/v2/v3, yarn (classic + berry), pnpm and bun.lock, makes **zero network calls**, and `--write` merges the minimal values into `.npmrc` preserving your other keys and comments. `--check` is a CI gate that fails three distinct ways: _insufficient_ (v12 refuses the install), _over-permissive_ (`all` committed where `root` suffices), and _invalid_.

That last one is worth calling out to this thread specifically: **`allow-git=true` is not valid.** It's an enum, not a boolean, and npm treats an out-of-enum value as unset — so you get a config that looks fixed, passes review, and still breaks the install. I've seen `=true` recommended in more than one migration write-up.

One caveat for anyone about to standardise on `root`: it was broken in npm 11.x — root-level git deps were rejected with `Fetching non-root packages of type git have been disabled` ([npm/cli#9189](https://github.com/npm/cli/issues/9189), closed via PR #9206). If you're on npm 11 and can't confirm your build carries the fix, use `all`. `npx npm-script-lens doctor` checks your local npm and warns about exactly this.

MIT, no telemetry, no paid tier: [https://github.com/Booyaka101/npm-script-lens](https://github.com/Booyaka101/npm-script-lens)

1 You must be logged in to vote

All reactions

0 replies

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

### 

[![](https://avatars.githubusercontent.com/u/19969570?s=64&v=4)

TechQuery

](/TechQuery)[Sep 14, 2026](#discussioncomment-18437467)

GitHub NPM registry also loses `/:org/:package/latest` API, which makes `pnpm install` command failed:

## Failed

pnpm i @my-org/my-package

```
Error: ERR_PNPM_PACKAGE_MANAGER_ADD_RESOLVE_LATEST

  × adding a new package
  ╰─▶ Failed to resolve the latest version of @my-org/my-package: Failed to request https://npm.pkg.github.com/@my-
      org%2Fmy-package/latest: HTTP status client error (405 Method Not Allowed) for url (https://npm.pkg.github.com/@my-
      org%2Fmy-package/latest)
```

## Success

Installing with Package Name + Version Number works well:

pnpm i @my-org/my-package@0.1.0

1 You must be logged in to vote

😄 1 🚀 1

All reactions

-   😄 1
-   🚀 1

2 replies

[![@moafafaris-spec](https://avatars.githubusercontent.com/u/329334425?s=60&v=4)](/moafafaris-spec)

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

#### 

[moafafaris-spec](/moafafaris-spec) [Oct 12, 2026](#discussioncomment-18885770)

npm config set key=value \[key=value...\]  
npm set key=value \[key=value...\]

All reactions

[![@moafafaris-spec](https://avatars.githubusercontent.com/u/329334425?s=60&v=4)](/moafafaris-spec)

Comment options

### Uh oh!

There was an error while loading. Please reload this page.

Quote reply

#### 

[moafafaris-spec](/moafafaris-spec) [Oct 12, 2026](#discussioncomment-18885771)

npm config set key=value \[key=value...\]  
npm set key=value \[key=value...\]

All reactions

[Sign up for free](/join?source=comment-repo) **to join this conversation on GitHub**. Already have an account? [Sign in to comment](/login?return_to=https%3A%2F%2Fgithub.com%2Forgs%2Fcommunity%2Fdiscussions%2F198547)

Category

[

🗃️

npm](/orgs/community/discussions/categories/npm)

Labels

[Product Feedback](/orgs/community/discussions?discussions_q=label%3A%22Product+Feedback%22) Share your thoughts and suggestions on GitHub features and improvements [npm](/orgs/community/discussions?discussions_q=label%3Anpm) Discussions around programming langages, open source and software development [source:ui](/orgs/community/discussions?discussions_q=label%3Asource%3Aui) Discussions created via Community GitHub templates

25 participants

 [![@leobalter](https://avatars.githubusercontent.com/u/301201?s=48&v=4)](/leobalter)[![@kimballa](https://avatars.githubusercontent.com/u/87376?s=48&v=4) ](/kimballa)[![@tbroyer](https://avatars.githubusercontent.com/u/173813?s=48&v=4) ](/tbroyer)[![@kcrwfrd](https://avatars.githubusercontent.com/u/504158?s=48&v=4) ](/kcrwfrd)[![@mrbusche](https://avatars.githubusercontent.com/u/792378?s=48&v=4) ](/mrbusche)[![@Booyaka101](https://avatars.githubusercontent.com/u/1064588?s=48&v=4) ](/Booyaka101)[![@JamieMagee](https://avatars.githubusercontent.com/u/1358764?s=48&v=4) ](/JamieMagee)[![@myovchev](https://avatars.githubusercontent.com/u/2827783?s=48&v=4) ](/myovchev)[![@vbjay](https://avatars.githubusercontent.com/u/3629489?s=48&v=4) ](/vbjay)[![@rvillane](https://avatars.githubusercontent.com/u/11447528?s=48&v=4) ](/rvillane)[![@chronoB](https://avatars.githubusercontent.com/u/11942682?s=48&v=4) ](/chronoB)[![@VladSez](https://avatars.githubusercontent.com/u/16666234?s=48&v=4) ](/VladSez)[![@TechQuery](https://avatars.githubusercontent.com/u/19969570?s=48&v=4) ](/TechQuery)[![@sebdanielsson](https://avatars.githubusercontent.com/u/20663065?s=48&v=4) ](/sebdanielsson)[![@marypcbuk](https://avatars.githubusercontent.com/u/38077532?s=48&v=4) ](/marypcbuk)[![@Jakeshadow](https://avatars.githubusercontent.com/u/42135534?s=48&v=4) ](/Jakeshadow)[![@7mody6whr](https://avatars.githubusercontent.com/u/58350644?s=48&v=4) ](/7mody6whr)[![@samigt](https://avatars.githubusercontent.com/u/77077656?s=48&v=4) ](/samigt)[![@Snehajit999](https://avatars.githubusercontent.com/u/178064399?s=48&v=4) ](/Snehajit999)[![@muhammadYounus183](https://avatars.githubusercontent.com/u/245219880?s=48&v=4) ](/muhammadYounus183)[![@piiiico](https://avatars.githubusercontent.com/u/264682515?s=48&v=4) ](/piiiico)and others
