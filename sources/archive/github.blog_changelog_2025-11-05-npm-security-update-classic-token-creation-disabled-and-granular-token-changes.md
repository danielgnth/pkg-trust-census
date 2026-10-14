## Table of Contents

-   [What's changing today (November 5, 2025)](#whats-changing-today-november-5-2025)
-   [What you need to do](#what-you-need-to-do)
-   [Not affected by these changes](#not-affected-by-these-changes)
-   [Looking ahead: November 19, 2025](#looking-ahead-november-19-2025)
-   [Need help?](#need-help)

Menu. Currently selected: What's changing today (November 5, 2025)

-   [What's changing today (November 5, 2025)](#whats-changing-today-november-5-2025)
-   [What you need to do](#what-you-need-to-do)
-   [Not affected by these changes](#not-affected-by-these-changes)
-   [Looking ahead: November 19, 2025](#looking-ahead-november-19-2025)
-   [Need help?](#need-help)

_Editor’s note (November 5, 2025): We’ve updated this post to explicitly clarify that the affected tokens are npm tokens._

Today marks another milestone in our ongoing effort to strengthen npm’s security. As [previously announced](https://github.com/orgs/community/discussions/178140), we’re implementing the first set of changes to npm’s token management system.

**Important:** These changes only affect npm tokens used for the npm registry. GitHub tokens (e.g, personal access tokens, fine-grained tokens, etc.) are not affected by these changes.

## [What’s changing today (November 5, 2025)](#whats-changing-today-november-5-2025)

### [npm classic tokens](#npm-classic-tokens)

-   **New npm classic tokens can no longer be created** through the npmjs.com website, CLI, or API.
-   Existing npm classic tokens continue to work until November 19, 2025.
-   The `npm token create` CLI command no longer generates npm classic tokens.

### [npm granular access tokens](#npm-granular-access-tokens)

-   **New npm tokens with write permissions now enforce 2FA by default**.
-   A new **Bypass 2FA** option is available for CI/CD workflows (unchecked by default).
-   **All npm existing granular tokens with write permissions are now capped at 90-day maximum lifetime**.
    -   Existing tokens set to expire after February 3, 2026 have been adjusted to expire on that date.

## [What you need to do](#what-you-need-to-do)

### [If you use npm classic tokens](#if-you-use-npm-classic-tokens)

You have until **November 19, 2025** to migrate to npm granular access tokens. After this date, all npm classic tokens will be permanently revoked.

#### [Migration steps:](#migration-steps)

1.  Visit [npmjs.com/settings/~/tokens](https://www.npmjs.com/settings/~/tokens).
2.  Click **Generate New Token** → **Granular Access Token**.
3.  Configure appropriate permissions for your use case.
4.  For CI/CD workflows requiring write access, consider enabling **Bypass 2FA** or use established trust publishing with OIDC.
5.  Replace npm classic tokens in your workflows with the new npm granular tokens.

**Note:** npm granular tokens must currently be created through the npmjs.com website. We’re actively working on adding full CLI support for granular token management via `npm token` commands in the coming weeks.

### [If you use npm granular tokens](#if-you-use-npm-granular-tokens)

-   Check your npm tokens’ expiration dates at [npmjs.com/settings/~/tokens](https://www.npmjs.com/settings/~/tokens).
-   Plan for token rotation if any of them expire on February 3, 2026.
-   New tokens created for CI/CD may need **Bypass 2FA** enabled if noninteractive publishing is required.

## [Not affected by these changes](#not-affected-by-these-changes)

-   **GitHub personal access tokens (classic)**
-   **GitHub fine-grained personal access tokens**
-   **GitHub Actions secrets** – No impact, though npm tokens stored as secrets should be updated
-   **GITHUB\_TOKEN in actions**

## [Looking ahead: November 19, 2025](#looking-ahead-november-19-2025)

On November 19, we will **permanently revoke all npm classic tokens** and replace long-lived local publishing tokens with 2-hour session tokens.

## [Need help?](#need-help)

-   📚 [npm token migration guide](https://docs.npmjs.com/creating-and-viewing-access-tokens)
-   💬 [Community discussion](https://github.com/orgs/community/discussions/178140)
-   🎫 [npm support](https://www.npmjs.com/support)

We understand these changes require effort from you. Thank you for partnering with us to make npm more secure for the entire JavaScript ecosystem.

## Subscribe to our developer newsletter

Discover tips, technical guides, and best practices in our biweekly newsletter just for devs.

[

Back to top

](#start-of-content)
