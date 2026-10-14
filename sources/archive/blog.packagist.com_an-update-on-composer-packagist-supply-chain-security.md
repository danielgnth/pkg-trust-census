[composer](https://blog.packagist.com/tag/composer/)

![An update on Composer & Packagist supply chain security](https://storage.ghost.io/c/c4/73/c4739028-7475-4e92-ab07-856192bf3472/content/images/size/w2000/2026/07/2026-05-27-update-on-composer-and-packagist-supply-chain-security-2.png)

The last months, and even more so the last weeks, saw an increasing amount of software supply chain attacks targeting open-source ecosystems. A handful of these have hit the PHP ecosystem too, via taken-over GitHub accounts and stolen access tokens that let attackers publish new tags on packages they had no legitimate access to. Most notably [laravel-lang on May 22](https://www.aikido.dev/blog/supply-chain-attack-targets-laravel-lang-packages-with-credential-stealer) and [intercom/intercom-php on April 30th](https://socket.dev/blog/mini-shai-hulud-packagist-malicious-intercom-php-package-compromise).

This post is an update on where Composer and Packagist.org's supply chain security work stands right now: what's already in place, what ships in the next few weeks, and the longer-running projects we're working through. We've been focused on this area for close to a year, and there's enough to cover that it's worth pulling it together in one place.

**If you maintain any package on Packagist.org and don't have MFA enabled, please enable it now.** We will begin to publish package maintainer MFA status to package transparency logs and it will be visible on profiles. See the MFA section below for details.

## TL;DR

**In place today:**

-   [Aikido](https://www.aikido.dev/) malware detection integrated into Packagist.org and the package metadata Composer consumes (open to further data providers with appropriate free licenses).
-   Rapid manual incident response by the Packagist team.
-   Public transparency log, which accurately recorded the git tag modifications used in the recent attacks.

**Shipping this week:**

-   Composer 2.10, introducing a unified dependency policy framework that covers malware-flagged versions, vulnerability advisories, and abandoned packages.
-   Stable version immutability on Packagist.org: Tagged versions can no longer be silently rewritten by re-tagging in git repositories.
-   New supply chain security features in Private Packagist for organization-wide control, to be detailed in follow-up posts over the next few days.
-   More predictable composer install download behavior (deprecation of source fallbacks).

**Coming in the next weeks and months:**

-   Minimum-release-age / cooldown dependency policy in Composer.
-   Improved admin tooling on Packagist.org: manual malware feed overrides, delisting for older Composer clients, package freezing during active account compromises.
-   MFA events surfaced in the transparency log; MFA status visible on maintainer profiles.
-   Organizational Package Ownership, replacing shared company accounts with proper multi-user management and package vendor scoped configuration options.

**Longer-term direction:**

-   Mandatory MFA across Packagist.org, with stricter requirements at the organization level
-   FIDO2-backed staged release flow, required for packages with large userbases
-   Packagist.org hosting immutable build artifacts directly, with SLSA build provenance and Sigstore attestations verified on the Composer client side.
-   Bringing the Composer + Packagist stack to OpenSSF Securing Software Repositories Working Group [Principles for Package Repository Security Authorization L3](https://repos.openssf.org/principles-for-package-repository-security#authorization) and [SLSA Working Draft Dependency Track L3 and L4](https://slsa.dev/spec/draft/dependency-track#level-3-dependencies-consumed-from-locations-under-producers-control).

The rest of the post goes through each of these in detail.

## Detection and incident response

In March 2026, Packagist.org started importing malware detection results from Aikido (see [composer/packagist#1681](https://github.com/composer/packagist/pull/1681)). When a version is flagged, the warning shows up prominently in the Packagist.org UI and is included in package metadata served to Composer. Aikido flagged the malicious versions in each of the recent incidents.

The team operating Packagist.org has been responding to each incident within minutes of detection, pulling affected packages or versions before they can be installed at scale. Manual intervention is not the type of rapid response we want this process to depend on long-term, though, and most of what follows is about replacing reaction with prevention.

## The transparency log

Packagist.org has a public [transparency log](https://packagist.org/transparency-log) (login required) that records security-relevant events across the repository. It covers things like package ownership changes, maintainer additions and removals, user changes, and changes to version references.

The log is a tool for investigative use cases and continuous monitoring for risks. If you're interested in building tools or integrations on top of it, get in touch at [contact@packagist.org](mailto:contact@packagist.org) or GitHub issues and help shape the API for this log.

Work on the transparency log was funded by the [German Sovereign Tech Agency](https://blog.packagist.com/strengthening-php-supply-chain-security-with-a-transparency-log-for-packagist-org/) and it has been directly useful in handling the recent attacks. One of the key elements of nearly every recent supply chain attack on Packagist involved attackers modifying existing git tags after the fact. The transparency log accurately recorded each of these modifications, which let us identify exactly what had been manipulated and reconstruct precise timelines of each attack.

Why does this kind of record matter in general?

-   **Ownership changes and takeovers.** When a package changes hands, every downstream user has a legitimate interest in knowing. A public log means a sudden new maintainer on a widely used library is visible to anyone who is interested, not just to the Packagist.org admins.
-   **Account security review.** If you need to review your own account, a maintainer's account, or a package you maintain or use, the log gives you a place to check what happened and when.
-   **Incident timelines.** When a compromise is investigated, sometimes days or weeks after the fact, a record of what changed and when is often the difference between a confident postmortem and a guess.
-   **Observability for consumers.** Anyone depending on a package can inspect the history of changes that affect it: who maintains it, when ownership moved, when references changed. If something bad happens, it leaves traces that anyone can audit.

We plan to keep expanding what the log captures. The next additions are on the account security side.

## MFA events, profile visibility, and a path to mandatory MFA

We already collect MFA-related events internally (enabling, disabling, recovery code usage, and similar). **In about six months, these events will start appearing publicly in the transparency log alongside the existing entries.** This ties directly into the "account security review" point above: it lets anyone see whether the maintainers of a package are actively keeping their accounts secure.

Once that is in place, we will go a step further and **surface MFA status on maintainer profiles**, so it is visible whether the people behind a package have MFA enabled. We expect this to nudge the ecosystem toward stronger account security, and it is one more reason to enable MFA on your account now if you haven't already.

Attackers already prioritize targets by download counts and dependency graphs, both of which are public information, MFA status doesn't change which packages are worth attacking, only how feasible an attack is once a target is chosen. Meanwhile the consumers of those packages have a legitimate interest in knowing the security posture of what they depend on, and today they have no way to see it. Making MFA status visible turns it from a private hygiene question into a property of the package that downstream users can see, ask about, and factor into their decisions. We expect this shift will get MFA adopted across the ecosystem faster than any amount of individual nudging.

Beyond that, we intend to implement FIDO2 support and eventually require MFA for all Packagist.org accounts. There is no fixed date yet, but the direction is set, and we want to give maintainers enough lead time to enable it without disruption.

A practical note for organizations using shared company user accounts and struggling with MFA: Please move to individual accounts per maintainer ahead of these changes. Organizational Package Ownership, which we are actively building, is designed to make that transition straightforward. You will be able to have an organization own packages and vendor prefixes, while individual users act on behalf of the organization, without the security and accountability problems of a shared login.

## Dependency policies in Composer 2.10

Composer 2.10 is shipping later this week, with a dedicated release announcement to follow on this blog. This section is a short summary of the parts most relevant to supply chain security.

The headline change is the introduction of dependency policies, a single framework for configuring how Composer treats vulnerability advisories, abandoned packages, and now packages flagged as malware. The framework matters because it gives us a clean place to add more policies later, rather than bolting each new check on as a one-off feature.

The first follow-up that we have already designed is a **minimum release age** policy (also known as cooldown period): refuse to install a version that was published less than N hours or days ago. This is one of the more effective defenses against the recent class of attacks, because malicious versions are typically pulled or detected within hours of publication. The policy is currently blocked by prerequisite work on the Packagist.org side. We need release metadata to be reliably immutable before we can safely treat "publication time" as a security input. More on that below.

Composer 2.10 will disable and deprecate source fallbacks for package downloads, to be removed entirely in 2.11. Previously, failing stable dist artifact downloads would automatically fall back to the underlying source repository. This behavior could lead to unexpected behaviors when the repository intentionally removes or blocks specific versions available on the underlying source repository.

## Administrative tooling for active response

Operating Packagist.org under active attack has surfaced some sharp edges in our internal tools. The work currently in progress includes:

-   **Manual malware feed overrides**, so an admin can flag (or unflag) a version without waiting for the automated feed to catch up.
-   **Delisting confirmed malware versions for older Composer clients** that don't yet support the dependency policy framework, so they don't silently install something we already know is malicious.
-   **Freezing packages** while the corresponding VCS or GitHub repository is under attacker control, so no new tags can show up on Packagist.org until the underlying account compromise is resolved.

None of this is glamorous, but a lot of incident response time today is spent working around tooling gaps.

## Version immutability

This is the larger change, and the one we have been working through the details on for a while. The first piece is imminent: stable versions on Packagist.org will become immutable as part of a deploy scheduled for this week, see [https://github.com/composer/packagist/pull/1742](https://github.com/composer/packagist/pull/1742).

Today, the transparency log already records when a version's source reference changes (you can filter the log by [version\_reference\_changed](https://packagist.org/transparency-log?type%5B%5D=version_reference_changed) to see this). That's useful for detection. But detection after the fact is a weak help compared to not allowing the change in the first place.

Once the deploy goes out, and a package publishes a non-dev version, Packagist.org will no longer silently rewrite it in response to upstream re-tagging or force-pushed annotated tags in Git/VCS repositories. Tag changes upstream are detected and rejected, and the maintainers of the affected package get an email notification. Branch-based dev versions continue to behave as they do today, since their whole purpose is to track a moving reference.

As a side note, we have been recommending to never retag a version for years. Even when an existing version turns out to have a problem, the right fix is to release a new version, not to overwrite an existing one. Immutability on our side enforces that recommendation.

It is worth spelling out why this matters, because the consequences of re-tagging are easy to underestimate:

-   **Third-party systems hold version data we don't control.** Mirrors, security scanners, SBOM tooling, and other consumers of Packagist.org pull version metadata almost immediately after publication. Once a version is out, copies of it exist in places Packagist.org has no control over. If you made a mistake in a release and decide to “quickly re-tag”, even just seconds after the initial release, there are now two variants of the same release in circulation. It is very difficult for users to understand which variant they have and which one they should be using, or what the consequences of using the original replaced version are.
-   **Lock files give limited protection.** A composer install from an existing lock reproduces what was previously locked. The lock file contains commit hashes. But the moment anyone runs `composer update`, `composer require`, or `composer update foo -W`, Composer refreshes registry metadata and rewrites the affected lock entries, even if a version is not updated, but was re-tagged in the meantime.
-   **Account compromise becomes much more dangerous without it.** If a maintainer's account is taken over tomorrow, mutable versions let an attacker republish an existing, widely-installed version with a backdoor. Users who already trust that version get the compromised code the next time they update. The window for noticing is small.
-   **Audits need a stable past.** Investigating an incident days or even months later is hard enough. It's much harder if the code that was running at the time no longer exists at the reference it used to. Immutability gives auditors and security teams something solid to point at.

Alongside the server-side change, we are also auditing Composer's behavior in installation scenarios where an attacker has modified git tags before repository-side immutability is in place. The goal is to make Composer's behavior in those edge cases more predictable. You’ll either get the originally published version, or a clear error, but never a silently-different version.

## Organizational controls and staged releases

A lot of recent attacks come down to a single maintainer's account being compromised. Separately from repository-wide MFA enforcement, we want to give organizations and the maintainers of widely-used packages tools to harden that boundary:

-   **Mandatory MFA at the organization level**, so every member of an organization meets a baseline. We also plan to require MFA soon for maintainers of all larger packages, regardless of whether they're in an organization.
-   **Staged release flow with FIDO2 MFA confirmation**, so publishing a new version requires a hardware-backed second step after tagging a git repository. An attacker with stolen GitHub access alone would not be able to push a release without alerting the maintainer. This will be a requirement for packages with large userbases. A similar staged release process is [available for npm since May 22nd, 2026](https://github.blog/changelog/2026-05-22-staged-publishing-and-new-install-time-controls-for-npm/).
-   **Bulk management of packages,** so organizations can better keep track of who the maintainers on packages in their vendor prefixes are, and make changes across all of their packages simultaneously, as well as manage bulk releases in new staged flows.

These controls won't help every package, but they meaningfully raise the cost of compromising the ones that matter most to the ecosystem.

## Artifact integrity through provenance and verification

Further out, we want Packagist.org to begin hosting immutable build artifacts directly, alongside [SLSA](https://slsa.dev/) build provenance and [Sigstore](https://www.sigstore.dev/) attestations, published through [Trusted Publishing / OIDC](https://repos.openssf.org/trusted-publishers-for-all-package-repositories), with verification on the Composer client side. The dependency policy framework we are shipping in Composer 2.10 is already set up to eventually let organizations configure, at fine granularity, which kinds of artifacts they trust based on their build provenance.

There are two pieces of external work we are aiming this at:

-   **OpenSSF Security Software Repositories Working Group’s** [**Principles for Package Repository Security**](https://repos.openssf.org/principles-for-package-repository-security#authorization)**, Authorization track, Level 3.** This level requires the package repository to support providing build provenance for packages. It currently does not apply to Packagist.org at all, because we depend on external systems (GitHub and other VCS hosts) for the artifacts themselves. Hosting artifacts directly on Packagist.org puts us in scope for this track.
-   **SLSA’s** [**Dependency Track**](https://slsa.dev/spec/draft/dependency-track) **(working draft), Levels 3 and 4.** L3 requires that build dependencies are consumed from locations under the producer's control; hosting immutable artifacts on Packagist.org is what enables organizations using Composer to consistently meet that. L4 requires a secure ingestion policy that proactively defends against upstream attacks — things like quarantine periods on new releases and malware screening. The malware feed, the dependency policy framework, the planned minimum-release-age policy, and the rest of the building blocks described above are what gets the Composer + Packagist stack to L4 in practice.

This project is a long-term direction and a significant amount of engineering on both the repository and the client side. We want to get the ergonomics right before pushing it on the ecosystem. But we’re convinced, it is where things need to end up.

## What's coming next

This post is the opening of a short series. Over the next days we will follow up with:

The **Composer 2.10 release announcement**, with a detailed walkthrough of how malware handling, the dependency policy framework, and the dist/source fallback changes actually behave in practice.

A set of posts detailing Composer behaviors in the context of supply chain security and presenting **new supply chain security features in Private Packagist.** These features are aimed at organizations that want to enforce supply chain decisions consistently across all their projects and developers, rather than leaving each project to set its own policy. Some of what we are rolling out:

-   Organization-wide blocking of flagged malware versions even for pre-2.10 Composer clients
-   Server-side enforcement of dependency policies that individual composer.json configurations cannot override to protect both developers and AI agents
-   Restricting which Composer client versions are allowed to authenticate against the repository, to enforce the use of safe Composer clients supporting current supply chain security functionality
-   An allow-list mechanism for Composer plugins allowing organizations to centralize the decision over which Composer plugins, which execute code at install time, are an acceptable risk. Explicit allow-listing of plugins has been a per-project Composer feature since version 2.1.

These only really make sense in a private repository where one organization controls the policy, which is why they are landing in Private Packagist rather than on Packagist.org.

This extensive amount of work requires financing. In addition to [Private Packagist](https://packagist.com/) which funds the majority of our work, we would like to thank the [Sovereign Tech Agency](https://www.sovereign.tech/) and [Aikido](https://www.aikido.dev/) for financing many work hours that went into these projects so far.

Financial contributions help us pay our staff for operating Packagist.org and supporting its users, e.g. reacting to supply chain attacks in the middle of the night, and maintaining and building these new supply chain security features for Composer. If your business is interested in joining this new sponsorship program (3 tiers from €2,500/month), please reach out to sponsoring@packagist.org for details and to be included in our launch announcement and new sponsorship website in June!

## Where we stand

The underlying ideas in this post: public audit logs, mandatory MFA, immutable releases, build provenance, attestations aren't new, and we are not the first ecosystem to work through them. [PyPI made 2FA mandatory](https://blog.pypi.org/posts/2023-12-13-2fa-enforcement/) for all publishers in January 2024 and now supports Sigstore-signed attestations via [PEP 740](https://blog.pypi.org/posts/2024-11-14-pypi-now-supports-digital-attestations/). npm [shipped SLSA-compliant Sigstore-signed provenance](https://github.blog/security/supply-chain-security/introducing-npm-package-provenance/) in 2023 and added [staged publishing in May 2026](https://github.blog/changelog/2026-05-22-staged-publishing-and-new-install-time-controls-for-npm/). Composer and Packagist have caught up at different speeds in different places: Ahead on some, e.g. the Packagist.org transparency log already captured the kinds of attacks the rest of this post is about, and Composer's model of distributing packages straight from git tags keeps the artifact directly tied to its source rather than to a separately-uploaded build. But behind on others, mandatory MFA most visibly. The work highlighted in this post closes the remaining gaps in a foundation that ties what you install directly to the source it came from, unlike most package registries.
