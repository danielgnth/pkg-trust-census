This is the next post in our supply chain security series, following the [supply chain security update](https://blog.packagist.com/an-update-on-composer-packagist-supply-chain-security/) and the [Composer 2.10 release](https://blog.packagist.com/composer-2-10-release/). Each post in this series covers a specific behavior worth understanding, and a change we are making on top of it.

Today: Stable version metadata on Packagist.org is now immutable. Once a version has been published, the git reference it points to can no longer change. Deleted versions are no longer erased without a trace: they are marked with a reason and remain visible on the package page.

## **How Packagist packages and versions are published**

To publish a package on Packagist.org, you submit the URL of a VCS repository, nearly always a GitHub repository. Packagist.org then follows that repository through webhooks: whenever a tag is created, it reads the `composer.json` at that tag and creates a version record for it. Branches are tracked too, as so-called dev versions, using the format `dev-name` for branches called `name`.

A tag such as `v3.9.0` becomes the stable version `3.9.0`, pointing at the exact git commit the tag referenced at the time (see [detailed tag/branch/version docs](https://getcomposer.org/doc/articles/versions.md#vcs-tags-and-branches)). When you require `monolog/monolog: ^3.9` in your `composer.json` and run `composer update`, Composer resolves that version through the Packagist.org metadata and pins the commit in your lock file:

```
{
    "name": "monolog/monolog",
    "version": "3.9.0",
    "source": {
        "type": "git",
        "url": "https://github.com/Seldaek/monolog.git",
        "reference": "8b5a6f3c1d2e4f5a6b7c8d9e0f1a2b3c4d5e6f7a"
    },
    "dist": {
        "type": "zip",
        "url": "https://api.github.com/repos/Seldaek/monolog/zipball/8b5a6f3c1d2e4f5a6b7c8d9e0f1a2b3c4d5e6f7a",
        "reference": "8b5a6f3c1d2e4f5a6b7c8d9e0f1a2b3c4d5e6f7a"
    }
}
```

Everyone building on top of the lock file or the Packagist.org version metadata treats the pairing of a version number and a git reference as permanent. Lock files reproduce it on every install. Mirrors, including Private Packagist, cache the package archive under that reference. Security scanners and advisory databases record findings against a specific version and assume the code behind it never changes.

## **The problem: silent rewrites of published versions**

Until now, Packagist.org would silently rewrite the metadata stored for a stable version whenever the reference in the source repository changed, for example when the corresponding git tag was deleted and re-created pointing at a different commit. The mechanism did not care about intent. If `v3.9.0` pointed at commit A yesterday and points at commit B today, Packagist.org updated its metadata to B, and anyone running `composer update` from then on resolved `3.9.0` to different code than users who had run it before.

## **"Nobody will have installed it yet"**

Rather than an attack, the most common way versions are modified are maintainers fixing their own mistakes.

You tag a release and minutes later realize something is wrong. A bug was not fully fixed, a commit did not make it into the release, or a last-minute issue makes the package uninstallable. The instinctive fix: delete the tag, push a corrected one under the same version number. It has only been a few minutes, so surely nobody has installed it yet.

The assumption that nobody installs a release in its first minutes has never been true. Automated systems react to the Packagist.org changes feed within seconds of a release. Mirrors fetch and cache the package archive under the original reference. Security scanners download and analyze the code. Users with automated dependency updates in CI may already have run `composer update`, installed the version, and committed the original reference to their lock file.

Once the tag has been replaced, two different variants of the same version number are in circulation, and telling them apart is extremely hard. A user debugging an issue cannot tell from the version number which variant they have installed. A mirror serves the first variant while Packagist.org metadata describes the second, so two colleagues installing "the same version" an hour apart can end up with different code. A scanner's analysis result refers to code that the version no longer points to. Every one of these is a confusing problem that lands on a package user's desk, hours or days after the retag that seemed harmless.

There is an infinite supply of version numbers. If a release goes out wrong, tag the fix as the next patch version. That is the entire solution, it takes a minute, costs nothing, and every tool and every user handles the result correctly.

The same mechanism that trips up well-meaning maintainers is exactly what attacker’s need. Someone who gains push access to a repository, through a compromised maintainer account or a stolen token (the same vector behind several recent PHP ecosystem incidents), can move an existing, trusted, widely installed tag onto malicious code. Packagist.org would follow the change without comment, and everyone resolving that version afterwards would receive the attacker's code under a version number they already trusted.

## **Stable versions are now immutable**

The new rule is straightforward: once a stable version has been published on Packagist.org, the git reference it points to never changes. If the tag in the source repository is deleted, re-created, or moved to a different commit, the published version keeps its original reference.

Dev versions, which track branches, are unaffected. A branch is a moving pointer by definition, and Composer treats `dev-` versions accordingly, so those continue to update whenever the branch changes.

There is one deliberately narrow exception: Packagist.org may update the URL from which the archive of a version is downloaded, but only when the reference itself is provably unchanged: the old and new reference must be the identical full commit hash, and Packagist.org verifies by fetching from the new URL that it serves that same commit. This exception covers cases like a code hosting platform changing its archive URL format. The code behind the version cannot change through this path, only the address used to retrieve it.

Anything else, a reference that actually differs, is treated as a blocked retag and the change is rejected.

![](https://storage.ghost.io/c/c4/73/c4739028-7475-4e92-ab07-856192bf3472/content/images/2026/07/data-src-image-e823741e-f563-4ed0-904f-4e0db799adee.png)

One important clarification on scope: the new rule makes the version metadata immutable, meaning the mapping from a version number to a git commit. It does not make the downloaded archives themselves immutable. For most packages these zip files are still generated on demand by the GitHub API, which does not guarantee byte-identical archives for the same commit over time. Verifying archive contents is a separate problem, and one we are also working on.

## **What maintainers see**

When Packagist.org detects and blocks a reference change on a stable version:

-   The version keeps its original, trusted reference. Existing lock files and installs are unaffected.
-   A "retag blocked" warning badge appears on the version on the package page, linking to a documentation page that explains the rule. To remove the warning badge you must recreate the tag again to point to the original commit reference.
-   All package maintainers receive an update failure notification by email, so a blocked retag is never silent on the maintainer side either.

If you genuinely need to change what a release contains, the supported path is the one described above: version numbers are cheap, publish the fix as the next version. Note, that Composer supports 4 version number components, so 3.2.0 can even be fixed as 3.2.0.1. Retagging an already-published stable release is not a supported operation, and Packagist.org now blocks retags instead of quietly accepting them.

The new [version imuttability documentation page](https://packagist.org/about/version-immutability) explains the behavior, what maintainers see, and the recommended remediation.

## **A real deletion model, with reasons**

Immutability raises an obvious question. If a published version can never be rewritten, how do you deal with one that genuinely needs to come down, for example because a release accidentally contained secret information? Until now Packagist.org had exactly one blunt tool: a version could be removed entirely, with no recovery, no record of why, and no way to differentiate between a maintainer tidying up their own package and an administrative takedown.

Alongside immutability we are introducing soft-deletion with explicit reasons. Instead of erasing a version entirely, only a record of the version remains, not the release artifact or code, and the record is marked with the reason the version was taken down:

-   **No longer found in the source repository.** When a version disappears from the repository, for example because its tag was deleted, Packagist.org marks it accordingly. Dev versions are permanently removed after a day, as before, since branches come and go. Stable version metadata is stored indefinitely, so a tag that briefly vanishes can be recovered as long as it is unchanged, rather than being permanently lost to immutability.
-   **Deleted by maintainer.** A maintainer removed the version through the per-version delete on the package page.
-   **Removed by admin.** An administrator took the version down, with an optional public reason shown on the package page, e.g. after manual review of automatically flagged malware releases.
-   **Hidden by admin.** An administrative takedown with no public trace, used for spam waves and selective takedowns. The version stays visible to maintainers and admins, and is hidden from everyone else.

Soft-deleted versions are removed from the metadata Composer reads, so Composer can no longer resolve a version that has been pulled, regardless of the reason. On the package page, soft-deleted versions appear grayed out with a per-reason explanation.

![](https://storage.ghost.io/c/c4/73/c4739028-7475-4e92-ab07-856192bf3472/content/images/2026/07/data-src-image-3ab80a88-f6e1-4010-9147-763ce02d9d0e.png)

Where recovery makes sense, the version shows a Recover button. Maintainers can recover their own deletions and versions that went missing from the repository. Versions removed or hidden by an administrator are recoverable by administrators only.

![](https://storage.ghost.io/c/c4/73/c4739028-7475-4e92-ab07-856192bf3472/content/images/2026/07/data-src-image-4d0d8773-c33d-4cb9-919a-94e6b75bd215.png)

## **Transparency log**

Every one of these actions is recorded on the public transparency log for the package: soft-deletions, recoveries, and blocked reference changes all leave a permanent public entry.. The result is a system where anyone can understand, after the fact, what happened to a version and why, instead of discovering that a version was silently rewritten or deleted.

![](https://storage.ghost.io/c/c4/73/c4739028-7475-4e92-ab07-856192bf3472/content/images/2026/07/data-src-image-5d676891-1bbd-44d2-89fd-0eb313b74192-1.png)

## **Why this matters for Composer & Packagist supply chain security**

Immutability is foundational. Analysis and reasoning about versions is hard to impossible if the code behind the versions you track, review, and analyze can change at any time. A security review, an advisory, a malware scan result, or an approval decision in an organization's allow-list all refer to a specific version, and each of these only means something if the version still refers to the same code tomorrow. Making stable versions immutable on Packagist.org gives every one of these processes a fixed point to reason about.

Our next goal for immutability is now to provide immutable artifacts for each version. We intend to accomplish this step in the next months with a combination of hosting artifacts ourselves and publishing info for verification on our transparency log. We still urgently need additional corporate sponsors to push forward with this work: contact us at redacted@example.invalid.

We strongly recommend other Composer repository maintainers introduce immutability on their package versions too, to help bring these improvements to the entire PHP ecosystem.

More posts in this series are coming, covering further Composer behavior changes and Packagist and Private Packagist features that build on them.
