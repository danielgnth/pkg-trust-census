## Keyboard shortcuts

Press ← or → to navigate between chapters

Press S or / to search in the book

Press ? to show this help

Press Esc to hide this help

## [Secure quorum-based cryptographic verification and mirroring for crates.io](#secure-quorum-based-cryptographic-verification-and-mirroring-for-cratesio)

Metadata

Short title

Crates.io mirroring

Contact

[walterhpearce](https://github.com/walterhpearce)

Status

Accepted

Zulip channel

N/A

Tracking issue

[rust-lang/goals#271](https://github.com/rust-lang/goals/issues/271)

Teams

[cargo](https://github.com/rust-lang/cargo), [crates-io](https://github.com/rust-lang/crates.io), [infra](https://github.com/rust-lang/infra-team), [leadership-council](https://github.com/rust-lang/leadership-council), [release](https://github.com/rust-lang/release-team)

Task owners

[Josh Triplett](https://github.com/joshtriplett), [walterhpearce](https://github.com/walterhpearce)

## [Summary](#summary)

Within 6 months, we will work towards consensus with Rust teams on an RFC for cryptographic verification and mirroring of releases and crates.io, and provide _experimental_ infrastructure demonstrating the ability to mirror crates.io and verify downloads from a mirror. This will include a proof of concept for a secure chain-of-trust to the Rust Project, via a quorum-based mechanism, and methods to verify singular Rust crates, their singular index entries, as well as the index and the artifacts as a whole.

This consensus will include a clear policy for the threat models we should protect against, and a clear demonstration that the proposed infrastructure secures against those threats.

## [Motivation](#motivation)

Rustaceans need to be able to download crates and know that they’re getting the crate files that were published to crates.io without modification. Rustaceans everywhere should be able to use local mirrors of crates.io, such as geographically distributed mirrors or mirrors within infrastructure (e.g. CI) that they’re using.

### [The status quo](#the-status-quo)

Currently rustup, cargo and crates.io provide no cryptographic security for the index, crates or our releases. The only verification which occurs is via HTTPS validation of the URLs and tamperable hashes within the index. This provides assurance that the server being communicated with is owned by the project & crates.io, but does not allow for the possibility of secure mirroring nor protects against compromise or tampering with the index or files (either at rest or in transit).

There are places where Rust is difficult to use right now. Using Cargo with crates.io works well for Rustaceans with unfirewalled access to high speed Internet, but not all are so lucky. Some are behind restrictive firewalls which they are required to use. Some don’t have reliable access to the Internet. In cases like these, we want to support mirrors of crates.io in a secure way that provides cryptographic guarantees that they are getting the same packages as are provided by the Rust Project, without any risk of tampering.

Another reason for wanting to be able to better support mirrors is to address cost pressures on Rust. Approximately half of Rust release and crate traffic is from CI providers. Being able to securely distribute Rust releases & crates from within CI infrastructure would be mutually beneficial, since it would allow the Rust Foundation to reallocate budget or donated resources to other uses, and would make Rust CI actions faster and more reliable on CI platforms that have mirrors.

Finally, supply chain security is a growing concern, particularly among corporate and government users of Rust. The Log4j vulnerability brought much greater attention to the problems that can occur when a single dependency nested arbitrarily deep in a dependency graph has a critical vulnerability. Many of these users are putting significant resources into better understanding their dependencies, which includes being able to attest that their dependencies verifiably came from specific sources like crates.io.

### [The next 6 months](#the-next-6-months)

We would like to have a experimental out-of-band version of a signing pipeline for the project for releases and crates.io. We expect this 6 month goal to consist of standing up experimental versions of the infrastructure and systems required for utilizing TUF on releases and crates with external commands and forks of the appropriate tools. This experimental version shall be a in-kind implementation of the RFC which is discussed in this goal. As a part of this process, we wish to take appropriate team time for discussion of the RFC for mirroring and signing to come to a consensus. The RFC shall be a transforming description (“living documentation”) of the MVP implementation in order to drive discussion and show proof-of-concept to the appropriate teams.

This goal shall include a series of educational materials (ex: blog posts, broken-down RFC components, or other materials) which discuss the history of artifact signing, current crate and release security, and the driving goals behind requiring cryptographic verification of Rust Project artifacts and why we have come to this solution. We hope to provide this material to interested parties across the project, with project-team-specific materials, to help drive consensus to this solution. These materials will not assume background knowledge of TUF or the TUF specification, and will provide motivation for the selection of TUF over other possibilities. These materials shall be crafted by the project team ([walterhpearce](https://github.com/walterhpearce) & [Josh Triplett](https://github.com/joshtriplett))

We are requesting the following activities from Rust Project teams:

-   Leadership Council:
    -   Review of threat models, policy decision on whether those are the correct threat models to target, general approval about the use of a quorum to address those threat models.
-   Cargo Team:
    -   Review and approval of design for index changes and crate verification
    -   Review and approval of incremental bandwidth usage for updates using novel index update mechanism (to be created by [walterhpearce](https://github.com/walterhpearce))
-   Crates.io Team:
    -   Review and approval of design for index changes
    -   Review and approval of rotation & revocation strategy
-   Infra Team:
    -   Review and approval of design for key management & ceremony process
    -   Review and approval of proposed repository structure
    -   Review and approval of secure storage & usage for automated keys
-   Release Team:
    -   Review of secure storage & usage for automated keys
    -   Review and approval of rotation & revocation strategy
-   Rustup Team: None

The project goal team will also make themselves consistently available to the community and involved teams for additional one-on-one discussions or broader group discussions (async or sync) to discuss any items involving TUF and signing, as desired by any member of the above teams with additional questions or concerns.

We will structure these discussions so that these decisions can largely be made independently. In particular, we will endeavor to provide discussion venues for asynchronous discussion of individual issues with the RFC, such that each team member need only participate in (and get notifications for) the discussions they’re interested in. (For instance, this may consist of a GitHub repository with separate issues for each topic/decision, and/or associated Zulip streams)

We also wish to implement technical items for this goal.

-   There will be a sample process for selecting a trusted root quorum for the project (endorsed by the leadership council), and that quorum will have completed a proof-of-concept signing ceremony. This may not be the final iteration of the quorum process, quorum, or root of trust; it will be a demonstration of feasibility for the purposes of this experiment, and a test that the process and systems in place all function.
    
-   We will have deployed a TUF repository for Rust releases for utilizing as validation against Rust releases downloaded by Rustup.
    
-   We will have implemented TUF validation in a fork of Rustup in a condition which can be a PR to Rustup project as an optional feature
    
-   We will have integrated signing into a TUF repository for crates published to crates.io; this may be accomplished in collaboration with crates.io or out-of-band via the new updates RSS feed.
    
-   Finally, we’ll provide some method for end users to verify these signatures as an external cargo subcommand & rustup fork for proof-of-concept
    

### [The “shiny future” we are working towards](#the-shiny-future-we-are-working-towards)

After this next six months, we will continue working to bring the experimental infrastructure into production.

We intend to provide production mirroring capabilities, and some mechanism for automatic mirror discovery. Cargo should be able to automatically discover and use mirrors provided within CI infrastructure, within companies, or within geographic regions, and cryptographically verify those that mirrors are providing unmodified crates and indexes from crates.io.

We’ll provide cryptographic verification of our GitHub source repositories, and some demonstration of how to verify mirrors of those repositories.

We hope to have follow-up RFCs which will enable authors to generate their own quorums for author and organization level signing and validation of the crates they own.

We’ll add support for similar cryptographic security for third-party crate repositories.

The project choosing to adopt this strategy and infrastructure will require ongoing commitment of people and effort to maintain sufficient working knowledge of operating the infrastructure and addressing the threat models. We will need to affirm that this is sustainable long-term, that there will be a critical mass of people who will continue to care about this going forward. In part, this will include paid staff and ongoing financial commitment from the Foundation whose job is to maintain it, which the Foundation has already stated that they’re willing to commit.

## [Ownership and team asks](#ownership-and-team-asks)

Task

Owner(s) or team(s)

Notes

Inside Rust blog post about proof-of-concept

[walterhpearce](https://github.com/walterhpearce)

Series of documents (RFC components or Inside Rust blog posts)

[walterhpearce](https://github.com/walterhpearce), [Josh Triplett](https://github.com/joshtriplett)

Policy decision

![Team](https://img.shields.io/badge/Team%20ask-red) [leadership-council](https://github.com/rust-lang/leadership-council)

1 hour synchronously discussing the threat models, policy, and quorum mechanism. Note: The ask from the Leadership Council is not a detailed exploration of _how_ we address these threat models; rather, this will be a presentation of the threat models and a policy decision that the project cares about those threat models, along with the specific explanation of why a quorum is desirable to address those threat models.

Design meeting

![Team](https://img.shields.io/badge/Team%20ask-red) [cargo](https://github.com/rust-lang/cargo)

1 hour Overall Design and threat model

Design meeting

![Team](https://img.shields.io/badge/Team%20ask-red) [cargo](https://github.com/rust-lang/cargo)

1 hour General design/implementation for index verification

Dedicated reviewer

![Team](https://img.shields.io/badge/Team%20ask-red) [cargo](https://github.com/rust-lang/cargo)

1 hour Design for novel incremental download mechanism for bandwidth conservation

Design meeting

![Team](https://img.shields.io/badge/Team%20ask-red) [crates-io](https://github.com/rust-lang/crates.io)

1 hour Overall Design, threat model, and discussion of key management and quorums

Design meeting

![Team](https://img.shields.io/badge/Team%20ask-red) [crates-io](https://github.com/rust-lang/crates.io)

1 hour General design/implementation for automated index signing

Design meeting

![Team](https://img.shields.io/badge/Team%20ask-red) [infra](https://github.com/rust-lang/infra-team)

3 hours of design and threat model discussion. Specific production infrastructure setup will come at a later time after the initial proof of concept.

Discussion and moral support

![Team](https://img.shields.io/badge/Team%20ask-red) [release](https://github.com/rust-lang/release-team)

Asynchronous discussion of the release team’s role in the chain of trust, and preliminary approval of an experimental proof of concept. Approximately ~1 hour of total time across the 6-month period.

### [Quorum-based cryptographic infrastructure (RFC 3724)](#quorum-based-cryptographic-infrastructure-rfc-3724)

Task

Owner(s) or team(s)

Notes

Further revisions to RFC

[walterhpearce](https://github.com/walterhpearce), [Josh Triplett](https://github.com/joshtriplett)

Implementation and proof-of-concept deployment

[walterhpearce](https://github.com/walterhpearce)

### [Definitions](#definitions)

Definitions for terms used above:

-   _Discussion and moral support_ is the lowest level offering, basically committing the team to nothing but good vibes and general support for this endeavor.
-   _Author RFC_ and _Implementation_ means actually writing the code, document, whatever.
-   _Design meeting_ means holding a synchronous meeting to review a proposal and provide feedback (no decision expected).
-   _RFC decisions_ means reviewing an RFC and deciding whether to accept.
-   _Org decisions_ means reaching a decision on an organizational or policy matter.
-   _Secondary review_ of an RFC means that the team is “tangentially” involved in the RFC and should be expected to briefly review.
-   _Stabilizations_ means reviewing a stabilization and report and deciding whether to stabilize.
-   _Standard reviews_ refers to reviews for PRs against the repository; these PRs are not expected to be unduly large or complicated.
-   _Prioritized nominations_ refers to prioritized lang-team response to nominated issues, with the expectation that there will be _some_ response from the next weekly triage meeting.
-   _Dedicated review_ means identifying an individual (or group of individuals) who will review the changes, as they’re expected to require significant context.

[](../2025h1/Polonius.html "Previous chapter")[](../2025h1/cargo-script.html "Next chapter")

[](../2025h1/Polonius.html "Previous chapter")[](../2025h1/cargo-script.html "Next chapter")
