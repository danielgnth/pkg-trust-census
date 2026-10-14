## Table of Contents

-   [What now requires an interactive 2FA challenge](#what-now-requires-an-interactive-2fa-challenge)
-   [How to prepare](#how-to-prepare)
-   [Coming next](#coming-next)

Menu. Currently selected: What now requires an interactive 2FA challenge

-   [What now requires an interactive 2FA challenge](#what-now-requires-an-interactive-2fa-challenge)
-   [How to prepare](#how-to-prepare)
-   [Coming next](#coming-next)

npm granular access tokens (GATs) configured to bypass 2FA can no longer perform sensitive account, org, and package management actions. These now require an interactive 2FA challenge, closing one of the largest credential-based attack surfaces on the registry.

> This only impacts npm granular access tokens. This does not affect GitHub personal access tokens, GitHub App tokens, or `GITHUB_TOKEN` in Actions.

### [What now requires an interactive 2FA challenge](#what-now-requires-an-interactive-2fa-challenge)

-   Creating or deleting tokens
-   Changing package access, maintainers, or trusted publishing configuration
-   Managing organization/team membership and package grants

An attacker could previously use a leaked 2FA-bypass token to take over an account and mint new tokens, add a maintainer, and more. A token that skips 2FA shouldn’t also be a way to manage your account.

### [How to prepare](#how-to-prepare)

Stop using 2FA-bypass tokens for these operations and perform them interactively (web or CLI) with a 2FA challenge.

### [Coming next](#coming-next)

2FA-bypass tokens will also lose direct publish. Their publishing surface will reduce to reading private packages and staging a publish, which a maintainer approves with 2FA. We are targeting January 2027 for this update. You should move automated publishing to [trusted publishing (OIDC)](https://docs.npmjs.com/trusted-publishers) or [staged publishing](https://docs.npmjs.com/staged-publishing).

This continues [the deprecation we announced on July 8](https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/#npm-2fa-bypass-gat-will-stop-skipping-2fa-for-account-changes). Have questions or a workflow that would be blocked? Tell us in the [community discussion](https://github.com/orgs/community/discussions/201329).

## Table of Contents

-   [What now requires an interactive 2FA challenge](#what-now-requires-an-interactive-2fa-challenge)
-   [How to prepare](#how-to-prepare)
-   [Coming next](#coming-next)

Menu. Currently selected: What now requires an interactive 2FA challenge

-   [What now requires an interactive 2FA challenge](#what-now-requires-an-interactive-2fa-challenge)
-   [How to prepare](#how-to-prepare)
-   [Coming next](#coming-next)

## Subscribe to our developer newsletter

Discover tips, technical guides, and best practices in our biweekly newsletter just for devs.

[

Back to top

](#start-of-content)
