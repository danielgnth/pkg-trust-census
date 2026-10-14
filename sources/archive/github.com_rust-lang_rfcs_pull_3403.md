[](/rust-lang/rfcs)

## Conversation

 [![@lulf](https://avatars.githubusercontent.com/u/19670?s=80&v=4)](/lulf)

### 

 ![@lulf](https://avatars.githubusercontent.com/u/19670?s=48&v=4)**[lulf](/lulf)** commented [Mar 27, 2023](#issue-1641913778)

Copy link

Copy Markdown

Summary:

This proposal will enhance cargo and crates.io through adoption of the Sigstore capabilities and workflows as described in the document.

[Rendered](https://github.com/trustification/rust-rfcs/blob/sigstore-rfc/text/0000-sigstore-integration.md)

For reference: [pre-RFC discussions](https://internals.rust-lang.org/t/pre-rfc-using-sigstore-for-signing-and-verifying-crates/18115)

Made in collaboration with Tim Pletcher (HPE) and feedback from the community and RFCs from other package ecosystems.

![Ulf Lilleengen](https://github.githubassets.com/images/gravatars/gravatar-user-420.png)

`[initial draft of sigstore rfc](/rust-lang/rfcs/pull/3403/commits/188160a01aff8184ffdf692de59f8481e78cd102 "initial draft of sigstore rfc")`

    

  

`[188160a](/rust-lang/rfcs/pull/3403/commits/188160a01aff8184ffdf692de59f8481e78cd102)`

[![@lulf](https://avatars.githubusercontent.com/u/19670?s=40&u=7392d7bef61e982b56574a360dc652ea70f65765&v=4)](/lulf)

[lulf](/lulf) [force-pushed](/rust-lang/rfcs/compare/95bb4ca059fb1008c40f7c1094a8a4ec114f9619..188160a01aff8184ffdf692de59f8481e78cd102) the sigstore-rfc branch from [`95bb4ca`](/rust-lang/rfcs/commit/95bb4ca059fb1008c40f7c1094a8a4ec114f9619) to [`188160a`](/rust-lang/rfcs/commit/188160a01aff8184ffdf692de59f8481e78cd102) [Compare](/rust-lang/rfcs/compare/95bb4ca059fb1008c40f7c1094a8a4ec114f9619..188160a01aff8184ffdf692de59f8481e78cd102) [March 27, 2023 12:08](#event-8853448588)

[![@ehuss](https://avatars.githubusercontent.com/u/43198?s=40&u=4e88d47bc79d87f09f463582681d29f1ed6f478e&v=4)](/ehuss) [ehuss](/ehuss) added [T-cargo](/rust-lang/rfcs/issues?q=state%3Aopen%20label%3AT-cargo) Relevant to the Cargo team, which will review and decide on the RFC. [T-crates-io](/rust-lang/rfcs/issues?q=state%3Aopen%20label%3AT-crates-io) Relevant to the crates.io team, which will review and decide on the RFC. labels [Mar 27, 2023](#event-8853755266)

[![@jonas-schievink](https://avatars.githubusercontent.com/u/1786438?s=80&v=4)](/jonas-schievink)

### 

**[jonas-schievink](/jonas-schievink)** commented [Mar 27, 2023](#issuecomment-1485793764)

Copy link

Copy Markdown

Contributor

The RFC does not clarify what the plan for getting this feature implemented is. By default, it would be the Cargo and crates.io teams, and the RFC mentions that the Cargo team has in the past been too overloaded to work on something like this. Has this situation changed? If not, is the intent of HPE or IBM to sponsor the development of this feature?

Additionally, it would be good to include a maintainer-focused overview of what would change for them. Since the vast majority of maintainers are volunteers, IMO the acceptable burden this RFC can place on them is precisely zero (some maintainers may be willing to provide commercial support for their libraries, and providing signatures that ensure supply chain integrity may reasonably be part of such a support package, but the RFC doesn't seem to make that an option, nor do the underlying services seem to support making this information available to select parties).  
Given that HPE and IBM both strongly rely on being in good standing with OSS maintainers (wouldn't want anyone to put _funny code_ in their libraries out of spite), I am sure you have taken this into account, but it would be good to write down how exactly the user-facing changes would look.

[![@programmerjake](https://avatars.githubusercontent.com/u/4584340?s=80&v=4)](/programmerjake)

### 

**[programmerjake](/programmerjake)** commented [Mar 27, 2023](#issuecomment-1485944611) •

edited

Loading

### Uh oh!

There was an error while loading. Please reload this page.

Copy link

Copy Markdown

Member

please add a section explaining why pgp keys aren't used as an acceptable method of proving identity, and signing software, they are commonly used in open-source distribution systems such as debian.

(edit: turns out gpg was already mentioned in the rfc, i just missed it)

[![@tpletcher](https://avatars.githubusercontent.com/u/28309?s=80&u=3c21ac5afb484dd57fecdf068ffd078d9a0f8b24&v=4)](/tpletcher)

### 

**[tpletcher](/tpletcher)** commented [Mar 28, 2023](#issuecomment-1486087620) •

edited

Loading

### Uh oh!

There was an error while loading. Please reload this page.

Copy link

Copy Markdown

> The RFC does not clarify what the plan for getting this feature implemented is. By default, it would be the Cargo and crates.io teams, and the RFC mentions that the Cargo team has in the past been too overloaded to work on something like this. Has this situation changed? If not, is the intent of HPE or IBM to sponsor the development of this feature?
> 
> Additionally, it would be good to include a maintainer-focused overview of what would change for them. Since the vast majority of maintainers are volunteers, IMO the acceptable burden this RFC can place on them is precisely zero (some maintainers may be willing to provide commercial support for their libraries, and providing signatures that ensure supply chain integrity may reasonably be part of such a support package, but the RFC doesn't seem to make that an option, nor do the underlying services seem to support making this information available to select parties). Given that HPE and IBM both strongly rely on being in good standing with OSS maintainers (wouldn't want anyone to put _funny code_ in their libraries out of spite), I am sure you have taken this into account, but it would be good to write down how exactly the user-facing changes would look.

We are sensitive to the resource constraints relative to what is available to execute on initiative. We took the approach of deferring the implementation effort discussion until the proposal was (hopefully) selected. I'd like to continue with that theme if at all possible, as community acceptance will provide some leverage on internal discussions at least on the HPE side of things..

We can certainly expand on the topic of the maintainer workflow overhead, and will get that added.

[![thomcc](https://avatars.githubusercontent.com/u/860665?s=60&v=4)](/thomcc)

**[thomcc](/thomcc)** reviewed [Mar 28, 2023](#pullrequestreview-1360135597)

[View reviewed changes](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102)

Comment thread [text/0000-sigstore-integration.md](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102#diff-5dc244b2ebc842f3f86e387f3db08bb4ac9c6a78e1439f3cca0f4e410d29a17e)

  

\* TUF (The Update Framework) - Phase 2 TUF AuthZ Architecture

\* The TUF protocol addresses a set of defined attacks and threat models specific to software distribution systems. It has the capability of providing a strong AuthZ implementation for any OSS project with respect to control of the ability to generate an artifact. For example, it is used by the Sigstore project itself to instantiate and manage the Sigstore Public Root. See: \[public Sigstore instance\](https://blog.sigstore.dev/a-new-kind-of-trust-root-f11eeeed92ef). This article does a good job of showing the options.

\* Make Sigstore signed crates mandatory.

### 

 ![@thomcc](https://avatars.githubusercontent.com/u/860665?s=48&v=4)**[thomcc](/thomcc)** [Mar 28, 2023](#discussion_r1149977659)

Copy link

Copy Markdown

Member

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

This suggestion sounds like a complete non-starter. I can only speak personally (although I do not think I am alone), but I can pretty confidently say that I would have published far fewer crates if doing so requires me set up / mess with signing keys.

### 

 ![@comex](https://avatars.githubusercontent.com/u/47517?s=48&v=4)**[comex](/comex)** [Mar 28, 2023](#discussion_r1150014663)

Copy link

Copy Markdown

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

As far as I can tell, in this proposal there are no long-lived signing keys. Instead you have to authenticate to GitHub every time you publish a crate, and that's where the signature comes from. Apparently there is some ephemeral signing key that gets created in the process, and I have no idea why it's designed this way, but it wouldn't be visible to the user.

In fact, if you have to authenticate to GitHub every time you publish a crate, it would probably make sense to deprecate the existing crates.io API token mechanism entirely in favor of this. In this case, users would end up with _fewer_ secrets to manage than currently. Most users right now are probably logged into GitHub in their browser, while also having a crates.io API token in ~/.cargo, and this could eliminate the second of those.

That leaves some questions…

-   How would this work for publishes from CI systems, especially ones not named GitHub Actions? It sounds like GitHub Actions builders are automagically given tokens that attest that they belong to such-and-such repo owned by such-and-such GitHub user, but that approach won't work for any external CI system. The Authentication section mentions this but it's extremely vague. I think you would need to store long-lived GitHub access tokens in this case, instead of doing an OpenID Connect auth process for every publish (as currently suggested under "Cargo publish flow"). Or is there some way to use one token to retrieve another token?
    
-   Would users not using CI systems be annoyed by having to authenticate with GitHub every time they publish a crate? (At a bare minimum, since many projects consist of a whole set of crates that are published together, there would need to be some way to publish them all with a single authentication step.)
    

### 

 ![@lulf](https://avatars.githubusercontent.com/u/19670?s=48&v=4)**[lulf](/lulf)** [Mar 28, 2023](#discussion_r1150134867)

Copy link

Copy Markdown

Author

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

> This suggestion sounds like a complete non-starter. I can only speak personally (although I do not think I am alone), but I can pretty confidently say that I would have published far fewer crates if doing so requires me set up / mess with signing keys.

This is one of the reasons for using Sigstore: you don't have to manage keys for signing crates. Keys are generated based on the OIDC flow with GitHub (or any OIDC provider) and have a temporary validity. The keys are published on a public log. This simplifies the problems managing keys (none), the problem of revoking (keys have a validity of 10 minutes) and the problem of knowing the impact of a breach (the auditable log simplifies this).

The downside is that you need to trust a third party service like GitHub (already done today) and Sigstore. However, if trust is a concern, there is an option crates.io hosting its own instance of Sigstore (in the same way crates.io could use something else than GitHub).

### 

 ![@clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=48&v=4)**[clarfonthey](/clarfonthey)** [Mar 28, 2023](#discussion_r1150142834)

Copy link

Copy Markdown

Contributor

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

This also leaves open the question of whether this only applies to new uploads or all downloads of all crates retroactively? On a new edition? etc

### 

 ![@joshtriplett](https://avatars.githubusercontent.com/u/162737?s=48&v=4)**[joshtriplett](/joshtriplett)** [Mar 30, 2023](#discussion_r1152751661)

Copy link

Copy Markdown

Member

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

> Keys are generated based on the OIDC flow with GitHub (or any OIDC provider)

How well-supported will the "or any OIDC provider" workflow be, here? Can we make crates.io itself be an OIDC provider for that purpose? I don't want us to become any more dependent on GitHub than we already are.

### 

 ![@woodruffw](https://avatars.githubusercontent.com/u/3059210?s=48&v=4)**[woodruffw](/woodruffw)** [Mar 30, 2023](#discussion_r1153439146)

Copy link

Copy Markdown

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

> How well-supported will the "or any OIDC provider" workflow be, here?

I believe this falls under [sigstore/fulcio#444](https://github.com/sigstore/fulcio/issues/444) -- other package indices/hosts (like PyPI) have indicated similar interests in a neutral or self-hosted IdP for the same reason.

(I haven't combed through the RFC fully to confirm that it mentions this, but it's worth noting that Sigstore as-is doesn't require GitHub as an OIDC IdP -- the public Sigstore instance also supports Google and Microsoft's account-level IdPs, as well as GCP and BuildKite as machine-identity IdPs. So, at least as far as Sigstore is concerned, GitHub is note a sole identity dependency.)

### 

 ![@Hayden-IO](https://avatars.githubusercontent.com/u/8418760?s=48&v=4)**[Hayden-IO](/Hayden-IO)** [Mar 30, 2023](#discussion_r1153486397)

Copy link

Copy Markdown

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

We can definitely onboard a package repository’s OIDC provider.

One consideration is by hosting both the packages and the identity provider, you open yourself up to risk if an attacker can compromise your infrastructure. An attacker could then forge identity tokens, generate valid signed malicious packages, and replace existing ones. The identity provider being operated by a third party provides a good separation - compromise of just the provider leads to valid signatures, but no way to upload them, and the ability to upload unsigned packages if crates is compromised.

### 

 ![@tarcieri](https://avatars.githubusercontent.com/u/797?s=48&v=4)**[tarcieri](/tarcieri)** [Mar 31, 2023](#discussion_r1154733133) •

edited

Loading

### Uh oh!

There was an error while loading. Please reload this page.

Copy link

Copy Markdown

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

> How well-supported will the "or any OIDC provider" workflow be, here? Can we make crates.io itself be an OIDC provider for that purpose?

[@joshtriplett](https://github.com/joshtriplett) since GitHub is functions as crates.io IDP, I think it makes sense to also use it as the OIDC provider for the purposes of Sigstore, rather than having crates.io also be an IDP-by-proxy. As @haydentherapper noted, this would mean that a compromise of crates.io would _not_ allow for obtaining code signing certificates from Fulcio.

If new IDPs are added in the future, so long as they support OIDC they should also work with e.g. Fulcio.

Comment thread [text/0000-sigstore-integration.md](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102#diff-5dc244b2ebc842f3f86e387f3db08bb4ac9c6a78e1439f3cca0f4e410d29a17e)

\* TUF (The Update Framework) - Phase 2 TUF AuthZ Architecture

\* The TUF protocol addresses a set of defined attacks and threat models specific to software distribution systems. It has the capability of providing a strong AuthZ implementation for any OSS project with respect to control of the ability to generate an artifact. For example, it is used by the Sigstore project itself to instantiate and manage the Sigstore Public Root. See: \[public Sigstore instance\](https://blog.sigstore.dev/a-new-kind-of-trust-root-f11eeeed92ef). This article does a good job of showing the options.

\* Make Sigstore signed crates mandatory.

\* Start marking legacy / unmaintained unsigned crates as unsafe

### 

 ![@thomcc](https://avatars.githubusercontent.com/u/860665?s=48&v=4)**[thomcc](/thomcc)** [Mar 28, 2023](#discussion_r1149979356)

Copy link

Copy Markdown

Member

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

I don't know that it is a correct use of `unsafe`. What's the proof obligation for safety in this case? Is there any? It feels like it's being abuse for things that are dispreferred.

Not to mention, it sounds like it would be a breaking change, so I don't think this is viable.

### 

 ![@clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=48&v=4)**[clarfonthey](/clarfonthey)** [Mar 28, 2023](#discussion_r1150142106)

Copy link

Copy Markdown

Contributor

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

I also dislike the term unsafe here. To me, unsigned would be a better choice.

Comment thread [text/0000-sigstore-integration.md](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102#diff-5dc244b2ebc842f3f86e387f3db08bb4ac9c6a78e1439f3cca0f4e410d29a17e)

\* Tim Pletcher, Hewlett Packard Enterprise

\* Ulf Lilleengen, Red Hat / IBM

  

\# Summary

### 

 ![@thomcc](https://avatars.githubusercontent.com/u/860665?s=48&v=4)**[thomcc](/thomcc)** [Mar 28, 2023](#discussion_r1149980455)

Copy link

Copy Markdown

Member

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

I think this summary is far too long, and entirely too full of jargon[1](#user-content-fn-1-53f029ed28a05665699a9fd3c128fbf5).

It may be worth looking at the summaries of some of the accepted RFCs, which are all much shorter and get to the point much more directly. (The guidance in the [template](https://github.com/rust-lang/rfcs/blob/master/0000-template.md) that it should be "one paragraph" is not a hard rule, but this is far too much)

## Footnotes

1.  Look, I've worked in security-adjacent software for much of my career and had to look things up, so I'm unsure who the intended audience is. [↩](#user-content-fnref-1-53f029ed28a05665699a9fd3c128fbf5)
    

### 

 ![@clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=48&v=4)**[clarfonthey](/clarfonthey)** [Mar 28, 2023](#discussion_r1150075309)

Copy link

Copy Markdown

Contributor

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

Seconding this: even the most jargon-filled academic abstracts remain a single paragraph.

The sole purpose of the summary is to explain what the RFC is. What is SigStore, what will the effect be for end users, etc.?

Anything else is just fluff. There's plenty of time to elaborate on motivation in the motivation section.

### 

 ![@lulf](https://avatars.githubusercontent.com/u/19670?s=48&v=4)**[lulf](/lulf)** [Mar 28, 2023](#discussion_r1150255774) •

edited

Loading

### Uh oh!

There was an error while loading. Please reload this page.

Copy link

Copy Markdown

Author

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

Those are both good point, and I've given a first stab at simplifying it. We were concerned based on the pre-RFC discussions that we had to provide more background for this change, clearly it was too much for the summary 😅

[![comex](https://avatars.githubusercontent.com/u/47517?s=60&v=4)](/comex)

**[comex](/comex)** reviewed [Mar 28, 2023](#pullrequestreview-1360189108)

[View reviewed changes](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102)

Comment thread [text/0000-sigstore-integration.md](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102#diff-5dc244b2ebc842f3f86e387f3db08bb4ac9c6a78e1439f3cca0f4e410d29a17e)

  

\## Authentication

  

Sigstore uses the OIDC pattern and ecosystem as the basis for authentication against the signing issuer (Fulcio). We assume that most are familiar with the OIDC pattern and tooling and so will not address those topics here, with the exception of the OIDC identity payload attributes. The certificates used for signing of course need to have an associated identity:

### 

 ![@comex](https://avatars.githubusercontent.com/u/47517?s=48&v=4)**[comex](/comex)** [Mar 28, 2023](#discussion_r1150015511)

Copy link

Copy Markdown

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

> We assume that most are familiar with the OIDC pattern and tooling and so will not address those topics here

I think this section needs to be expanded greatly; see my other comment for more detailed questions.

### 

 ![@clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=48&v=4)**[clarfonthey](/clarfonthey)** [Mar 28, 2023](#discussion_r1150096608)

Copy link

Copy Markdown

Contributor

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

This is also a very loaded phrase: the term "familiar" has so many definitions it's basically useless. If I know what I need to know, I don't necessarily know what you omitted, and if I don't, I don't know what information I should look for.

[![comex](https://avatars.githubusercontent.com/u/47517?s=60&v=4)](/comex)

**[comex](/comex)** reviewed [Mar 28, 2023](#pullrequestreview-1360200188)

[View reviewed changes](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102)

Comment thread [text/0000-sigstore-integration.md](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102#diff-5dc244b2ebc842f3f86e387f3db08bb4ac9c6a78e1439f3cca0f4e410d29a17e) Outdated

\# Summary

\[summary\]: #summary

  

The Solar Winds breach event was an inflection point for the topic of software supply chain security. The Solar Winds event exposed weaknesses in two specific areas, artifact provenance and build system integrity. That event resulted in a broad variety of reactions ranging from an aggressive push by the USG to a rapid acceleration of security/provenance related OSS and commercial projects oriented on addressing the significant shortcomings in the OSS software ecosystem.

### 

 ![@comex](https://avatars.githubusercontent.com/u/47517?s=48&v=4)**[comex](/comex)** [Mar 28, 2023](#discussion_r1150023505) •

edited

Loading

### Uh oh!

There was an error while loading. Please reload this page.

Copy link

Copy Markdown

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

I feel like this document is more... corporate-oriented than is usually seen in Rust. To be sure, lots of people working on Rust and Rust crates do so in the scope of employment by a large corporation, but I suspect some readers will have a reaction like, "why should I give a hoot what the US government wants?". And they may recall reading blog posts like [this one](https://iliana.fyi/blog/software-supply-chain/) and [this one](https://lucumr.pocoo.org/2022/7/9/congratulations/) that take issue with the entire _concept_ of supply chain security.

Admittedly, the specific policies being complained about in this posts are largely orthogonal to this RFC ,which is just about signing crates. And in fact I think the proposed approach makes a lot of sense. But I think the wording could do a better job of _selling it_.

Why do I want this? Not because the White House is pushing for it. But because I don't want malware on my computer or in the software I publish. And because the proposed approach (theoretically) makes signing so easy that there's no reason not to do it.

### 

 ![@lulf](https://avatars.githubusercontent.com/u/19670?s=48&v=4)**[lulf](/lulf)** [Mar 28, 2023](#discussion_r1150119285)

Copy link

Copy Markdown

Author

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

Thanks for the feedback! We will reduce the corp-speak and size of the summary, my apologies for that. I think the reason it ended up this way is that we were not sure how much background context we had to provide for this kind of RFC.

I agree, probably lots of crate maintainers don't care about what the US gov wants, I consider it more a reference of how important this issue is to resolve for open source Rust software to be trustable longer term.

[![comex](https://avatars.githubusercontent.com/u/47517?s=60&v=4)](/comex)

**[comex](/comex)** reviewed [Mar 28, 2023](#pullrequestreview-1360211612)

[View reviewed changes](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102)

Comment thread [text/0000-sigstore-integration.md](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102#diff-5dc244b2ebc842f3f86e387f3db08bb4ac9c6a78e1439f3cca0f4e410d29a17e) Outdated

  

These use cases will allow us to start to draw trust boundaries around artifact production processes and identify the metadata attributes that will need to be generated at artifact build-time which are subsequently consumed at run-time for effective policy and consumption controls to be possible for the ultimate consumers.

  

It’s worth noting that the team at GitHub working on the NPM implementation have essentially landed at the same to use case patterns. In our discussions with them as this document was prepared they articulated a focus on the build plant pattern as that pattern allows for the establishment of an attestation story around the systems where the artifact was produced. Conversely, artifacts produced on a developer desktop or system that is not formally controlled from a security perspective must necessarily be classified as technically “unsafe”.

### 

 ![@comex](https://avatars.githubusercontent.com/u/47517?s=48&v=4)**[comex](/comex)** [Mar 28, 2023](#discussion_r1150031734)

Copy link

Copy Markdown

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

Is this actually relevant to crates.io? After all, it usually distributes only source code, not compiled artifacts. I suppose people sometimes stick compiled packages into crates.io "source" packages, e.g. I think `watt` is based on this approach. But that doesn't seem important enough to mention in the summary.

[![comex](https://avatars.githubusercontent.com/u/47517?s=60&v=4)](/comex)

**[comex](/comex)** reviewed [Mar 28, 2023](#pullrequestreview-1360213000)

[View reviewed changes](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102)

Comment thread [text/0000-sigstore-integration.md](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102#diff-5dc244b2ebc842f3f86e387f3db08bb4ac9c6a78e1439f3cca0f4e410d29a17e)

  

Cargo may be slower if signing and verification is enabled by default. To start, it should be made opt-in for a period so that maintainers and users can get to know the tool and we can learn more about the reliability.

  

Reliance on the public \[Sigstore uptime\](https://www.chainguard.dev/unchained/sigstore-is-generally-available) of 99.5% availability goal may affect users signing and verifying crates, as well as crates.io verifying signature identities upon publish.

### 

 ![@comex](https://avatars.githubusercontent.com/u/47517?s=48&v=4)**[comex](/comex)** [Mar 28, 2023](#discussion_r1150032580) •

edited

Loading

### Uh oh!

There was an error while loading. Please reload this page.

Copy link

Copy Markdown

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

If I don't misunderstand, the proposal also effectively relies on GitHub's uptime as an OpenID Connect provider in order to sign (though not verify) crates.

### 

 ![@clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=48&v=4)**[clarfonthey](/clarfonthey)** [Mar 28, 2023](#discussion_r1150098436)

Copy link

Copy Markdown

Contributor

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

crates.io already requires GitHub for auth, so, in a sense it's already burdened by that requirement. Plus, the entire project is strongly tethered to GH infrastructure, so I don't think too many people will object, even though I personally dislike it.

### 

 ![@lulf](https://avatars.githubusercontent.com/u/19670?s=48&v=4)**[lulf](/lulf)** [Mar 28, 2023](#discussion_r1150122977)

Copy link

Copy Markdown

Author

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

We considered GitHub an existing piece of the infrastructure for crates.io due to the authentication process, which is the same OAuth flow used by Sigstore for generating the signing keys.

### 

 ![@emilyalbini](https://avatars.githubusercontent.com/u/2299951?s=48&v=4)**[emilyalbini](/emilyalbini)** [Mar 28, 2023](#discussion_r1150424558)

Copy link

Copy Markdown

Member

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

Note that nothing right now prevents adding more authentication providers to crates.io, it's just that nobody implemented them yet. There is no intention of only ever supporting GitHub.

### 

 ![@lulf](https://avatars.githubusercontent.com/u/19670?s=48&v=4)**[lulf](/lulf)** [Mar 28, 2023](#discussion_r1150430213)

Copy link

Copy Markdown

Author

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

Thanks, for bringing that up. I want to clarify that there is nothing about Sigstore that _requires_ GitHub - it can be used with other identity providers, and in fact the public instance supports multiple providers [https://docs.sigstore.dev/fulcio/oidc-in-fulcio/#supported-oidc-token-issuers](https://docs.sigstore.dev/fulcio/oidc-in-fulcio/#supported-oidc-token-issuers) , and allows crates.io to 'run their own' in the future.

### 

 ![@Hayden-IO](https://avatars.githubusercontent.com/u/8418760?s=48&v=4)**[Hayden-IO](/Hayden-IO)** [Mar 29, 2023](#discussion_r1152557491)

Copy link

Copy Markdown

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

(I'm a maintainer on Sigstore) Also worth noting we've been working on support for additional CI platforms like GitLab or Buildkite.

You can authenticate as a user interactively through various providers (Google, GitHub, Microsoft, and we can support more too), authenticate as a service account from Kubernetes, or authenticate via your preferred CI platform. GitHub Actions is the most fleshed out currently.

[![@comex](https://avatars.githubusercontent.com/u/47517?s=80&u=781a6494ac1bfc6a523a389ac114b91ac3eb1e5e&v=4)](/comex)

### 

**[comex](/comex)** commented [Mar 28, 2023](#issuecomment-1486224558)

Copy link

Copy Markdown

> please add a section explaining why pgp keys aren't used as an acceptable method of proving identity, and signing software, they are commonly used in open-source distribution systems such as debian.

There is already a mention of GPG.

[![comex](https://avatars.githubusercontent.com/u/47517?s=60&v=4)](/comex)

**[comex](/comex)** reviewed [Mar 28, 2023](#pullrequestreview-1360223966)

[View reviewed changes](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102)

Comment thread [text/0000-sigstore-integration.md](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102#diff-5dc244b2ebc842f3f86e387f3db08bb4ac9c6a78e1439f3cca0f4e410d29a17e)

  

Our threat model focuses on a package hijacking attack where an attacker gains access to a crate maintainer's crates.io credentials and uploads a modified version of the crate under a version number that is likely to get pulled in by cargo. Developers that use this crate cannot know whether the crate is built from the original source repository or on the attacker's laptop.

  

This proposal does not mitigate against compromised crates.io accounts. The aim is to make it harder to execute these types of attacks by creating a public audit trail for where, how and who published a package. Over time the presence of this information can be enforced.

### 

 ![@comex](https://avatars.githubusercontent.com/u/47517?s=48&v=4)**[comex](/comex)** [Mar 28, 2023](#discussion_r1150039811) •

edited

Loading

### Uh oh!

There was an error while loading. Please reload this page.

Copy link

Copy Markdown

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

It might be better to say that this doesn't mitigate against compromised _GitHub_ accounts. At least today, a crates.io account could be compromised without compromising the underlying GitHub account by stealing a crates.io API token, and authenticating with GitHub on every crate publish would mitigate against that.

[![clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=60&v=4)](/clarfonthey)

**[clarfonthey](/clarfonthey)** reviewed [Mar 28, 2023](#pullrequestreview-1360281463)

[View reviewed changes](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102)

Comment thread [text/0000-sigstore-integration.md](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102#diff-5dc244b2ebc842f3f86e387f3db08bb4ac9c6a78e1439f3cca0f4e410d29a17e) Outdated

  

This proposal has been influenced by \[this document\](https://docs.google.com/document/d/1mXrVAkUA9dd4M7fa\_AJC8mQ55YnYJ-DKsGq30lh0FvA/edit#heading=h.jyrb6etgzah), as well as the work at GH regarding the NPM ecosystem, the RFC for which can be \[found here\](https://github.com/npm/rfcs/blob/main/accepted/0049-link-packages-to-source-and-build.md). Further we have engaged both parties in discussions to further glean relevant information related to this effort and to achieve a certain level of commonality in the overall pattern of implementation in the language ecosystem.

  

\# Motivation

### 

 ![@clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=48&v=4)**[clarfonthey](/clarfonthey)** [Mar 28, 2023](#discussion_r1150078644)

Copy link

Copy Markdown

Contributor

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

This also follows from my comment on the summary: I think that the motivation for supply chain security is less interesting than the specific explanation of what SigStore is, and why it's chosen over the alternatives.

RFCs aren't tasks to be handed off by managers to developers. I further question the notion that tasks should settle on a specific implementation (e.g. SigStore) rather than being open to multiple (e.g. "implement supply-chain protections") and an RFC makes this especially relevant. In this RFC, you're fighting two fights: first, should we have supply-chain protections at all, and second, should we integrate SigStore. The first is likely to already be an uphill battle, and the second turns that hill into a wall.

### 

 ![@joshtriplett](https://avatars.githubusercontent.com/u/162737?s=48&v=4)**[joshtriplett](/joshtriplett)** [Mar 30, 2023](#discussion_r1152754349)

Copy link

Copy Markdown

Member

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

> I further question the notion that tasks should settle on a specific implementation (e.g. SigStore) rather than being open to multiple (e.g. "implement supply-chain protections") and an RFC makes this especially relevant.

I don't think "pick one" is an unreasonable position to take. Whether sigstore is the _right_ one is a reasonable question, but I think Open Source far too often defaults to "pick anything you like as long as you're willing to glue it all together" rather than "here's one thing that's fully integrated and works well". We've already seen in this issue alone people mention that they don't want to deal with the details of signature requirements. We don't want people having to _select_ those details.

I personally would advocate that we _do_ pick _one_ signing solution and make it work very well, rather than supporting several.

[![@clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=80&u=064c10efd2d57ae0bb9d53c6d97ea0a8e550c2a6&v=4)](/clarfonthey)

### 

**[clarfonthey](/clarfonthey)** commented [Mar 28, 2023](#issuecomment-1486295380)

Copy link

Copy Markdown

Contributor

I'm going to be honest, I don't think I've ever had such a negative knee-jerk reaction to an RFC. I don't think any one reason stuck out but multiple stacked together:

1.  The fact that the authors and their employers are clearly listed. I've not seen a single other RFC do this, and while I haven't read every RFC, I've been following Rust for a long time. This gives me the impression that the companies involved greatly want to get "credit" for this feature, if it's implemented. The goal of RFCs is the commentary and investment of the community, hence the fact that they are literally Requests For Comments. I say this as someone who openly uses the fact that they have written a merged RFC as résumé filler; putting your name on something in this way strikes me as different.
2.  There is a critical disrespect for reader's time with the lack of a summary here. The title and description for the RFC do nothing besides mention the term SigStore with an excess of words, and the actual summary section which [explicitly asks to be a single paragraph](https://github.com/rust-lang/rfcs/blob/master/0000-template.md#summary) rivals the length of a high school essay. Again, since most of the people reading these are community members, we rely on the summaries to decide what RFCs we should weigh on, what features we're interested in seeing implemented, et cetera. Although I highly doubt it was the authors' intent, it feels almost aggressively disrespectful to anyone who doesn't read the document in full on first reading.
3.  I'm a mathematican. One of the courses I had at university literally provided experience analysing academic papers on subjects we didn't know anything about and discussing the bits we did understand, which are the mathematics. I am routinely frustrated at the almost intentionally low quality of the prose you see in most academic papers, since many will provide the levels of fluff you'd expect to only be achieved by sleep-deprived high schoolers. While English teachers and publishing companies will be elated to see how many words you've written, most readers here will not.

Overall, this just rubs me as something that was written by someone with little investment or understanding in the RFC process. Importantly, RFCs are by definition first drafts, and I hope to see all of these issues ironed out by time. I would hate to be proven correct, and hope that things change for the better.

[![clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=60&v=4)](/clarfonthey)

**[clarfonthey](/clarfonthey)** reviewed [Mar 28, 2023](#pullrequestreview-1360324373)

[View reviewed changes](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102)

Comment thread [text/0000-sigstore-integration.md](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102#diff-5dc244b2ebc842f3f86e387f3db08bb4ac9c6a78e1439f3cca0f4e410d29a17e) Outdated

\# Motivation

\[motivation\]: #motivation

  

It is in the context of failure after failure in the OSS ecosystem related to compromised packages and lack of reliable provenance, as well as the looming changes that will be driven by the recently announced White House cybersecurity strategy, that this RFC is presented. The Rust ecosystem can \*and should\* lead on these topics given its accelerating adoption in mission critical scenarios, expanding use in linux core, etc, etc. Not only can the community address basic artifact signature operations, but it can also “skate to where the puck is going to be” on the evolving build plant ecosystem.

### 

 ![@clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=48&v=4)**[clarfonthey](/clarfonthey)** [Mar 28, 2023](#discussion_r1150106095)

Copy link

Copy Markdown

Contributor

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

I really don't like the conflation of compromised packages with a lack of provenance, since this simply isn't true. I additionally don't like the appeal to the White House as a definitive authority on what security practices are best.

Honestly, "these people agree this is a good idea" should either be backed with their reasoning, or be relegated to a footnote. This paragraph overall uses a lot of words to say "there are problems, and smart people agree with us" which isn't very helpful to explaining why this RFC is necessary.

[![clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=60&v=4)](/clarfonthey)

**[clarfonthey](/clarfonthey)** reviewed [Mar 28, 2023](#pullrequestreview-1360325923)

[View reviewed changes](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102)

Comment thread [text/0000-sigstore-integration.md](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102#diff-5dc244b2ebc842f3f86e387f3db08bb4ac9c6a78e1439f3cca0f4e410d29a17e)

  

It is in the context of failure after failure in the OSS ecosystem related to compromised packages and lack of reliable provenance, as well as the looming changes that will be driven by the recently announced White House cybersecurity strategy, that this RFC is presented. The Rust ecosystem can \*and should\* lead on these topics given its accelerating adoption in mission critical scenarios, expanding use in linux core, etc, etc. Not only can the community address basic artifact signature operations, but it can also “skate to where the puck is going to be” on the evolving build plant ecosystem.

  

On the topic of build system integrity, historically, this operational domain was not delineated as a specific function from generic security systems operations in the context of say, NIST. However, with the new SSDF directive NIST has specifically engaged on this topic. from a standards perspective. It’s not an exaggeration to say that NIST artifacts can be a bit dense, but more interestingly, one of the other early ecosystem events post Solar Winds was the launch of the Supply Chain Levels for Software Artifacts or “SLSA”. \[SLSA\](https://slsa.dev) is a capabilities framework that specifically and exclusively addresses the topic of build system fidelity and fills a gap in the existing standards. It is relatively lean and approachable and provides organizations with a fast, easy way to assess current capabilities and plan for improvement. SLSA addresses both artifact provenance and build system integrity and also very clearly lays out relevant attack vectors as can be seen below):

### 

 ![@clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=48&v=4)**[clarfonthey](/clarfonthey)** [Mar 28, 2023](#discussion_r1150107159)

Copy link

Copy Markdown

Contributor

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

This paragraph can essentially be shortened to a link to the context and the below image.

[![clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=60&v=4)](/clarfonthey)

**[clarfonthey](/clarfonthey)** reviewed [Mar 28, 2023](#pullrequestreview-1360328566)

[View reviewed changes](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102)

Comment thread [text/0000-sigstore-integration.md](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102#diff-5dc244b2ebc842f3f86e387f3db08bb4ac9c6a78e1439f3cca0f4e410d29a17e) Outdated Show resolved Hide resolved

### Uh oh!

There was an error while loading. Please reload this page.

[![clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=60&v=4)](/clarfonthey)

**[clarfonthey](/clarfonthey)** reviewed [Mar 28, 2023](#pullrequestreview-1360330552)

[View reviewed changes](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102)

Comment thread [text/0000-sigstore-integration.md](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102#diff-5dc244b2ebc842f3f86e387f3db08bb4ac9c6a78e1439f3cca0f4e410d29a17e)

\* The verification of the above information relies on a third party (crates.io) not being compromised.

\* In the event that crates.io is compromised, crates pulled from crates.io cannot be verified.

\* There is no way to establish the identity of the system that built the artifact.

\* There is only the limited identity metadata associated with the GH ID that is the source of the artifact.

### 

 ![@clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=48&v=4)**[clarfonthey](/clarfonthey)** [Mar 28, 2023](#discussion_r1150110085)

Copy link

Copy Markdown

Contributor

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

This assumes that all sources on crates.io are on GitHub, which is distinctly false.

### 

 ![@carols10cents](https://avatars.githubusercontent.com/u/193874?s=48&v=4)**[carols10cents](/carols10cents)** [Mar 31, 2023](#discussion_r1154711780)

Copy link

Copy Markdown

Member

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

Right now, GitHub is the source of the _identity_ of the _people_ who publish all crates, but our intention is to have other ways to log in to crates.io in the future. I agree that there is no current requirement for hosting the source code of any crate on GitHub, but it _is_ the only way to log in to crates.io right now.

[![clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=60&v=4)](/clarfonthey)

**[clarfonthey](/clarfonthey)** reviewed [Mar 28, 2023](#pullrequestreview-1360333580)

[View reviewed changes](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102)

Comment thread [text/0000-sigstore-integration.md](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102#diff-5dc244b2ebc842f3f86e387f3db08bb4ac9c6a78e1439f3cca0f4e410d29a17e)

  

By executing on the adoption of Sigstore and structuring crates.io metadata around the ability to present information capable of driving policy based consumption (both on the desktop and in the build and runtime environments), the Rust community will take a large and important step in evolving the its tooling to meet the demands of a rapidly evolving software supply chain ecosystem and of the security and regulatory demands that are coming into play.

  

One of the first principles for considering the implementing this type of tooling in the community ecosystem is making sure that the developer experience remains a Tier 1 consideration. Historically, when security specific capabilities are brought into the mix the impact to productivity and developer experience has been of such a level that very often the security “stuff” gets ignored or just falls to the wayside (see PGP signing as an example). This is one area where Sigstore truly shines. From the outset Sigstore was designed to be a toolchain that would be a trivial impact to the day to day workflow of a developer as to be a non-issue. The cosign application is easy to use on the desktop (and fairly easy to drop into a build system) and the integration with many widely used IdP implementations (GH, GCP, etc) make the workflow simple. There are no long-term keys to manage, nor any other infrastructure when you are utilizing the public service. Further the verification service (Rekor) is accessed through a well documented API making both desktop CLI and machine level access a straight-forward proposition.

### 

 ![@clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=48&v=4)**[clarfonthey](/clarfonthey)** [Mar 28, 2023](#discussion_r1150112100) •

edited

Loading

### Uh oh!

There was an error while loading. Please reload this page.

Copy link

Copy Markdown

Contributor

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

> One of the first principles for considering the implementing this type of tooling in the community ecosystem is making sure that the developer experience remains a Tier 1 consideration.

This entire sentence exists to say "it's important to make sure our proposal isn't bad" which isn't very productive. Overall, the low density of this paragraph makes it very difficult to decipher the important details. Bulleted lists are actually pretty nice.

In case it wasn't clear:

> One of the first principles for considering the implementing

First,

> this type of tooling

this document you're reading right now,

> in the community ecosystem

for readers like you,

> is making sure that the developer experience

is making sure your experience,

> remains a Tier 1 consideration.

is good.

### 

 ![@comex](https://avatars.githubusercontent.com/u/47517?s=48&v=4)**[comex](/comex)** [Mar 28, 2023](#discussion_r1150886703) •

edited

Loading

### Uh oh!

There was an error while loading. Please reload this page.

Copy link

Copy Markdown

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

> This entire sentence exists to say "it's important to make sure our proposal isn't bad" which isn't very productive

Hmm, I disagree. Security systems often sacrifice UX in the name of better security – though as the RFC alludes to in the following sentence, doing so tends to actually reduce security due to non-adoption. It’s valuable to state that this design is trying to avoid that mistake by prioritizing UX.

### 

 ![@teor2345](https://avatars.githubusercontent.com/u/8951843?s=48&v=4)**[teor2345](/teor2345)** [Apr 2, 2023](#discussion_r1155380166) •

edited

Loading

### Uh oh!

There was an error while loading. Please reload this page.

Copy link

Copy Markdown

Member

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

> this design is trying to avoid that mistake by prioritizing UX.

\[…which encourages adoption\]

It might help to just say this directly. You don't need to be subtle here.

If a longer sentence can be interpreted in multiple ways, because it uses a lot of words, maybe it's not fulfilling its intended purpose effectively.

[![clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=60&v=4)](/clarfonthey)

**[clarfonthey](/clarfonthey)** reviewed [Mar 28, 2023](#pullrequestreview-1360342752)

[View reviewed changes](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102)

Comment thread [text/0000-sigstore-integration.md](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102#diff-5dc244b2ebc842f3f86e387f3db08bb4ac9c6a78e1439f3cca0f4e410d29a17e)

  

One of the first principles for considering the implementing this type of tooling in the community ecosystem is making sure that the developer experience remains a Tier 1 consideration. Historically, when security specific capabilities are brought into the mix the impact to productivity and developer experience has been of such a level that very often the security “stuff” gets ignored or just falls to the wayside (see PGP signing as an example). This is one area where Sigstore truly shines. From the outset Sigstore was designed to be a toolchain that would be a trivial impact to the day to day workflow of a developer as to be a non-issue. The cosign application is easy to use on the desktop (and fairly easy to drop into a build system) and the integration with many widely used IdP implementations (GH, GCP, etc) make the workflow simple. There are no long-term keys to manage, nor any other infrastructure when you are utilizing the public service. Further the verification service (Rekor) is accessed through a well documented API making both desktop CLI and machine level access a straight-forward proposition.

  

While not a part of this RFC, end users can implement additional projects such as \[in-toto\](https://in-toto.io/) to build more advanced verification and attestation of software.

### 

 ![@clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=48&v=4)**[clarfonthey](/clarfonthey)** [Mar 28, 2023](#discussion_r1150118032)

Copy link

Copy Markdown

Contributor

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

Why would a user want to do that? What features are included in that that this proposal doesn't include? Why not include those features in this proposal? Why is that a good decision? Without answers to any of these questions, I'm not sure why you linked this, and it would be helpful to either a) clarify that you answer this later in the document (and maybe link this there instead?) or b) explain why you don't think it's important (which may involve answering all those questions I asked).

[![clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=60&v=4)](/clarfonthey)

**[clarfonthey](/clarfonthey)** reviewed [Mar 28, 2023](#pullrequestreview-1360346516)

[View reviewed changes](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102)

Comment thread [text/0000-sigstore-integration.md](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102#diff-5dc244b2ebc842f3f86e387f3db08bb4ac9c6a78e1439f3cca0f4e410d29a17e)

  

While not a part of this RFC, end users can implement additional projects such as \[in-toto\](https://in-toto.io/) to build more advanced verification and attestation of software.

  

\## Goals

### 

 ![@clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=48&v=4)**[clarfonthey](/clarfonthey)** [Mar 28, 2023](#discussion_r1150120423)

Copy link

Copy Markdown

Contributor

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

This should be in, if not the summary, the beginning of the motivation section. In fact, this is basically the purpose of the motivation section, so, it feels weird that it's its own subsection.

Perhaps a better justification would be for separating it out if you explicitly delineated motivating incidents (bad things that happened that need stopping, like the Solar Winds breach you mention constantly) and goals, so that those who are already convinced don't need to read all the examples.

But also, I think that examples are mostly overrated if the goals are well-stated.

[![clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=60&v=4)](/clarfonthey)

**[clarfonthey](/clarfonthey)** reviewed [Mar 28, 2023](#pullrequestreview-1360347201)

[View reviewed changes](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102)

Comment thread [text/0000-sigstore-integration.md](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102#diff-5dc244b2ebc842f3f86e387f3db08bb4ac9c6a78e1439f3cca0f4e410d29a17e)

  

\## Goals

  

This proposal will enhance cargo and crates.io through adoption of the Sigstore capabilities and workflows for supporting both use cases as outlined above. Specifically,

### 

 ![@clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=48&v=4)**[clarfonthey](/clarfonthey)** [Mar 28, 2023](#discussion_r1150120918)

Copy link

Copy Markdown

Contributor

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

As outlined above where? Every word up to this point? The wording is confusing here.

[![clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=60&v=4)](/clarfonthey)

**[clarfonthey](/clarfonthey)** reviewed [Mar 28, 2023](#pullrequestreview-1360348430)

[View reviewed changes](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102)

Comment thread [text/0000-sigstore-integration.md](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102#diff-5dc244b2ebc842f3f86e387f3db08bb4ac9c6a78e1439f3cca0f4e410d29a17e)

  

This proposal will enhance cargo and crates.io through adoption of the Sigstore capabilities and workflows for supporting both use cases as outlined above. Specifically,

  

\* Adopt Sigstore infrastructure to allow for the signing of crates for use both above.

### 

 ![@clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=48&v=4)**[clarfonthey](/clarfonthey)** [Mar 28, 2023](#discussion_r1150121731)

Copy link

Copy Markdown

Contributor

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

This isn't a goal. Adopting infrastructure is a solution to a problem, and the goal is to eliminate that problem.

[![clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=60&v=4)](/clarfonthey)

**[clarfonthey](/clarfonthey)** reviewed [Mar 28, 2023](#pullrequestreview-1360351696)

[View reviewed changes](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102)

Comment thread [text/0000-sigstore-integration.md](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102#diff-5dc244b2ebc842f3f86e387f3db08bb4ac9c6a78e1439f3cca0f4e410d29a17e)

This proposal will enhance cargo and crates.io through adoption of the Sigstore capabilities and workflows for supporting both use cases as outlined above. Specifically,

  

\* Adopt Sigstore infrastructure to allow for the signing of crates for use both above.

\* Facilitate workflows in both Cargo and crates.io to allow for signature generation in the former case and verification in the latter case of crates and their dependencies by crate consumers (a note on dependencies: the depth level should be 1 for verification in this first phase)

### 

 ![@clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=48&v=4)**[clarfonthey](/clarfonthey)** [Mar 28, 2023](#discussion_r1150123837)

Copy link

Copy Markdown

Contributor

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

This sentence is a train wreck. It asks for:

-   Signature generation for cargo
-   Signature verification for crates.io
-   1-depth dependency signing (dependencies only, not dependencies of dependencies)

[![clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=60&v=4)](/clarfonthey)

**[clarfonthey](/clarfonthey)** reviewed [Mar 28, 2023](#pullrequestreview-1360353272)

[View reviewed changes](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102)

Comment thread [text/0000-sigstore-integration.md](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102#diff-5dc244b2ebc842f3f86e387f3db08bb4ac9c6a78e1439f3cca0f4e410d29a17e)

\* Adopt Sigstore infrastructure to allow for the signing of crates for use both above.

\* Facilitate workflows in both Cargo and crates.io to allow for signature generation in the former case and verification in the latter case of crates and their dependencies by crate consumers (a note on dependencies: the depth level should be 1 for verification in this first phase)

  

This implementation will support all three Sigstore implementation models which will be effectively transparent to both crates.io maintainers and crates.io consumers. At a high level the three Sigstore implementation models are:

### 

 ![@clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=48&v=4)**[clarfonthey](/clarfonthey)** [Mar 28, 2023](#discussion_r1150124943)

Copy link

Copy Markdown

Contributor

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

This is an implementation detail that should be in the implementation sections.

[![clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=60&v=4)](/clarfonthey)

**[clarfonthey](/clarfonthey)** reviewed [Mar 28, 2023](#pullrequestreview-1360355338)

[View reviewed changes](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102)

Comment thread [text/0000-sigstore-integration.md](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102#diff-5dc244b2ebc842f3f86e387f3db08bb4ac9c6a78e1439f3cca0f4e410d29a17e)

  

\# Non Goals

  

\* Implementing TUF - this proposal describes a sequenced implementation with TUF in a phase 2.

### 

 ![@clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=48&v=4)**[clarfonthey](/clarfonthey)** [Mar 28, 2023](#discussion_r1150126326) •

edited

Loading

### Uh oh!

There was an error while loading. Please reload this page.

Copy link

Copy Markdown

Contributor

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

Again, not a goal. What is in TUF that makes it out of scope compared to SigStore? Also: define TUF. (The Update Framework)

[![clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=60&v=4)](/clarfonthey)

**[clarfonthey](/clarfonthey)** reviewed [Mar 28, 2023](#pullrequestreview-1360359326)

[View reviewed changes](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102)

Comment thread [text/0000-sigstore-integration.md](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102#diff-5dc244b2ebc842f3f86e387f3db08bb4ac9c6a78e1439f3cca0f4e410d29a17e)

\# Non Goals

  

\* Implementing TUF - this proposal describes a sequenced implementation with TUF in a phase 2.

\* Signing crates.io index - this is covered by other proposals, but is discussed in the context of TUF later in this document.

### 

 ![@clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=48&v=4)**[clarfonthey](/clarfonthey)** [Mar 28, 2023](#discussion_r1150128926)

Copy link

Copy Markdown

Contributor

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

This seems to reflect the older git-based registry of crates.io and also would not be very possible under sparse registries, assuming that I'm interpreting this as signing the actual commit for the index itself.

I think that it's worth clarifying that, by index, you mean the effective state of crates.io, not simply ensuring that all crates are signed.

[![clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=60&v=4)](/clarfonthey)

**[clarfonthey](/clarfonthey)** reviewed [Mar 28, 2023](#pullrequestreview-1360359769)

[View reviewed changes](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102)

Comment thread [text/0000-sigstore-integration.md](/rust-lang/rfcs/pull/3403/files/188160a01aff8184ffdf692de59f8481e78cd102#diff-5dc244b2ebc842f3f86e387f3db08bb4ac9c6a78e1439f3cca0f4e410d29a17e)

  

\* Implementing TUF - this proposal describes a sequenced implementation with TUF in a phase 2.

\* Signing crates.io index - this is covered by other proposals, but is discussed in the context of TUF later in this document.

\* Extending or altering the Identity approach of Sigstore, i.e. OIDC based

### 

 ![@clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=48&v=4)**[clarfonthey](/clarfonthey)** [Mar 28, 2023](#discussion_r1150129218)

Copy link

Copy Markdown

Contributor

There was a problem hiding this comment.

### Choose a reason for hiding this comment

The reason will be displayed to describe this comment to others. [Learn more](https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment).

Again, non-goal, implementation detail.

[![@8573](https://avatars.githubusercontent.com/u/3662816?s=80&v=4)](/8573)

### 

**[8573](/8573)** commented [Mar 29, 2023](#issuecomment-1489252738) •

edited

Loading

### Uh oh!

There was an error while loading. Please reload this page.

Copy link

Copy Markdown

> I don't think I've ever had such a negative knee-jerk reaction to an RFC. \[...\]
> 
> 1.  The fact that the authors and their employers are clearly listed. I've not seen a single other RFC do this, \[...\]

This is standard practice in IETF RFCs, as well as in academic papers in many fields. Listing authors (albeit not their affiliations) is also required in, e.g., NixOS RFCs, which are based on Rust's. IETF's likely being the best-known RFCs, I would not fault inexperienced submitters of Rust RFCs for doing something more IETF-RFC-like, especially when the instructions for Rust RFCs don't say _not_ to do this.

[![woodruffw](https://avatars.githubusercontent.com/u/3059210?s=60&v=4)](/woodruffw)

**[woodruffw](/woodruffw)** reviewed [Mar 30, 2023](#pullrequestreview-1365410225)

[View reviewed changes](/rust-lang/rfcs/pull/3403/files/a7571b75ad5a20359e7efa07b609d5ca437987f2)

Comment thread [text/0000-sigstore-integration.md](/rust-lang/rfcs/pull/3403/files/a7571b75ad5a20359e7efa07b609d5ca437987f2#diff-5dc244b2ebc842f3f86e387f3db08bb4ac9c6a78e1439f3cca0f4e410d29a17e) Outdated Show resolved Hide resolved

### Uh oh!

There was an error while loading. Please reload this page.

This was referenced Mar 30, 2023

[Cargo signing sigstore/community#25](/sigstore/community/issues/25)

Open

[Security model / TUF rust-lang/crates.io#75](/rust-lang/crates.io/issues/75)

Closed

[![@Kixunil](https://avatars.githubusercontent.com/u/1178779?s=80&u=4bd8c56dac06b90d985b2688ec76f0859f297404&v=4)](/Kixunil)

### 

**[Kixunil](/Kixunil)** commented [Mar 31, 2023](#issuecomment-1491343287)

Copy link

Copy Markdown

Nice to see an attempt to solve it. Whether it's workable I can't say right now but I did notice it doesn't mention [cargo-crev](https://github.com/crev-dev/cargo-crev) which I believe is worth mentioning.

[lulf](/lulf) and others added 4 commits [March 31, 2023 14:24](#commits-pushed-f11ca9c)

 [![@lulf](https://avatars.githubusercontent.com/u/19670?s=40&v=4)](/lulf)[![@workingjubilee](https://avatars.githubusercontent.com/u/46493976?s=40&v=4)](/workingjubilee)

`[Update text/0000-sigstore-integration.md](/rust-lang/rfcs/pull/3403/commits/f11ca9c15ecfe295e82abd501e73004c3911b80a "Update text/0000-sigstore-integration.md Co-authored-by: Jubilee <46493976+workingjubilee@users.noreply.github.com>")` …

    

  

`[f11ca9c](/rust-lang/rfcs/pull/3403/commits/f11ca9c15ecfe295e82abd501e73004c3911b80a)`

Co-authored-by: Jubilee <46493976+workingjubilee@users.noreply.github.com>

 [![@lulf](https://avatars.githubusercontent.com/u/19670?s=40&v=4)](/lulf)[![@workingjubilee](https://avatars.githubusercontent.com/u/46493976?s=40&v=4)](/workingjubilee)

`[Update text/0000-sigstore-integration.md](/rust-lang/rfcs/pull/3403/commits/400ee4beffa7995905d9a0062578b6e6e45957f9 "Update text/0000-sigstore-integration.md Co-authored-by: Jubilee <46493976+workingjubilee@users.noreply.github.com>")` …

    

  

`[400ee4b](/rust-lang/rfcs/pull/3403/commits/400ee4beffa7995905d9a0062578b6e6e45957f9)`

Co-authored-by: Jubilee <46493976+workingjubilee@users.noreply.github.com>

 [![@lulf](https://avatars.githubusercontent.com/u/19670?s=40&v=4)](/lulf)[![@woodruffw](https://avatars.githubusercontent.com/u/3059210?s=40&v=4)](/woodruffw)

`[Update text/0000-sigstore-integration.md](/rust-lang/rfcs/pull/3403/commits/da1fa851eb7f7b1e1746e795234621ee942cd74e "Update text/0000-sigstore-integration.md Co-authored-by: William Woodruff <william@yossarian.net>")` …

    

  

`[da1fa85](/rust-lang/rfcs/pull/3403/commits/da1fa851eb7f7b1e1746e795234621ee942cd74e)`

Co-authored-by: William Woodruff <william@yossarian.net>

![Ulf Lilleengen](https://github.githubassets.com/images/gravatars/gravatar-user-420.png)

`[build plant -> build system](/rust-lang/rfcs/pull/3403/commits/3d715cfc8d62dec933f16ba12da960d50e763b0b "build plant -> build system")`

    

  

`[3d715cf](/rust-lang/rfcs/pull/3403/commits/3d715cfc8d62dec933f16ba12da960d50e763b0b)`

[![@AaronFriel](https://avatars.githubusercontent.com/u/788800?s=80&u=7b046403605cf8c19935a19fab6ddc6f633461cd&v=4)](/AaronFriel)

### 

**[AaronFriel](/AaronFriel)** commented [Apr 4, 2023](#issuecomment-1496337251) •

edited

Loading

### Uh oh!

There was an error while loading. Please reload this page.

Copy link

Copy Markdown

[@lulf](https://github.com/lulf) (CC [@Eh2406](https://github.com/Eh2406)) it would be interesting to consider what this proposal would look like if an OCI Registry was used as the backing store for Cargo. If that were the case, I think architecturally it would be simpler to staple artifacts onto Cargo crates in the form of SBOMs, sigstore certificates, etc.

Using OCI would also not couple Cargo to a particular ecosystem for verification, e.g.: if it made sense to also support Notary and to implement [The Update Framework (TUF)](https://theupdateframework.io/).

[![@tarcieri](https://avatars.githubusercontent.com/u/797?s=40&u=aca2ca512c04d8fb56e791ffd737ceb54be75ad3&v=4)](/tarcieri) [tarcieri](/tarcieri) mentioned this pull request [Apr 10, 2023](#ref-issue-951205609)

[Signing Crates build-trust/ockam#1588](/build-trust/ockam/issues/1588)

Closed

[![@tarcieri](https://avatars.githubusercontent.com/u/797?s=80&u=aca2ca512c04d8fb56e791ffd737ceb54be75ad3&v=4)](/tarcieri)

### 

**[tarcieri](/tarcieri)** commented [May 18, 2023](#issuecomment-1553670085)

Copy link

Copy Markdown

Regarding concerns about signer privacy, here's a proposed design for how to preserve such privacy in Sigstore while still maintaining its existing security properties: [https://arxiv.org/abs/2305.06463](https://arxiv.org/abs/2305.06463)

[![@znewman01](https://avatars.githubusercontent.com/u/873857?s=80&v=4)](/znewman01)

### 

**[znewman01](/znewman01)** commented [May 18, 2023](#issuecomment-1553699944)

Copy link

Copy Markdown

I'm one of the authors on that proposal and also involved in the Sigstore community. I'll note that the prior VRF-based approach [@tarcieri](https://github.com/tarcieri) mentions is also plausible, and also something we would consider implementing in Sigstore. The paper describes a few of the tradeoffs between these approaches. If one or the other makes sense for the Rust ecosystem, I can help push to get it implemented in Sigstore.

[![@burdges](https://avatars.githubusercontent.com/u/680126?s=80&v=4)](/burdges)

### 

**[burdges](/burdges)** commented [May 19, 2023](#issuecomment-1554076709) •

edited

Loading

### Uh oh!

There was an error while loading. Please reload this page.

Copy link

Copy Markdown

I doubt the VRF/VUF scheme conforms to GDPR because users who expose their email but later anonymize their email also typically leak the link between their VRF/VIF output and their email somewhere.

Identity tags could be Pedersen commitments, provided the party creating the Pedersen commitment rotates the blinding factors. It appears the Speranza paper obfuscates what crypto they employ, but their appendices suggest they simply sign a Pedersen commitment to the hash of the email. I've no idea if it helps, but you could merge the signature into a PoK for the Pedersen commitment.

Identity tags could also be VRF outputs with user controlled & rotatable VRF signing keys, in which we anonymize the users' VRF public keys using other techniques, ala proof-of-personhood parties using VRFs or similar. I guess folks dislike setting up user controlled keys here, but they give additional properties which sound relevant.

[![@woodruffw](https://avatars.githubusercontent.com/u/3059210?s=80&u=1376a0d0a4d01d43ad56c47b81da4ae1bfcc4367&v=4)](/woodruffw)

### 

**[woodruffw](/woodruffw)** commented [May 19, 2023](#issuecomment-1555020329) •

edited

Loading

### Uh oh!

There was an error while loading. Please reload this page.

Copy link

Copy Markdown

Just to orient things a bit: there are other identities besides emails that can be used with Sigstore, and those identities frequently have more desirable privacy properties.

For example: Sigstore supports OIDC identities tied to machines or individual workflow runs, such as a specific run of a release workflow in GitHub Actions. That identity embeds state for the GitHub repository (including the owning org/user), but not their email.

Here's an example of that, in the form of the embedded certificate claims ([permalink](https://search.sigstore.dev/?logIndex=18676299)):

```
 OIDC Issuer: https://token.actions.githubusercontent.com
  GitHub Workflow Trigger: release
  GitHub Workflow SHA: f2123ba8f11a0b46481fe1927ababf2d4c612d91
  GitHub Workflow Name: Release
  GitHub Workflow Repository: sigstore/sigstore-python
  GitHub Workflow Ref: refs/tags/v1.1.2
  OIDC Issuer (v2): https://token.actions.githubusercontent.com
  Build Signer URI: https://github.com/sigstore/sigstore-python/.github/workflows/release.yml@refs/tags/v1.1.2
  Build Signer Digest: f2123ba8f11a0b46481fe1927ababf2d4c612d91
  Runner Environment: github-hosted
  Source Repository URI: https://github.com/sigstore/sigstore-python
  Source Repository Digest: f2123ba8f11a0b46481fe1927ababf2d4c612d91
  Source Repository Ref: refs/tags/v1.1.2
  Source Repository Identifier: '447691086'
  Source Repository Owner URI: https://github.com/sigstore
  Source Repository Owner Identifier: '71096353'
  Build Config URI: https://github.com/sigstore/sigstore-python/.github/workflows/release.yml@refs/tags/v1.1.2
  Build Config Digest: f2123ba8f11a0b46481fe1927ababf2d4c612d91
  Build Trigger: release
  Run Invocation URI: https://github.com/sigstore/sigstore-python/actions/runs/4775034890/attempts/1
  1.3.6.1.4.1.11129.2.4.2: 04:79:00:77:00:75:00:dd:3d:30:6a:c6:c7:11:32:63:19:1e:1c:99:67:37:02:a2:4a:5e:b8:de:3c:ad:ff:87:8a:72:80:2f:29:ee:8e:00:00:01:87:ab:13:91:f6:00:00:04:03:00:46:30:44:02:20:05:0f:72:d6:e9:7b:85:35:0d:f7:14:74:6f:0e:43:57:5a:68:10:81:1b:4f:f5:1f:29:99:59:d2:dc:4d:02:32:02:20:67:23:c0:eb:79:92:56:42:82:e2:b7:64:aa:80:d2:82:49:ec:ba:95:87:2e:49:45:20:26:60:b0:f5:3c:bf:a4
```

I believe some ecosystems deploying Sigstore (e.g. Node/NPM, unless I'm misremembering) are starting with _just_ machine identities, meaning that there are no emails (or human names, etc.) anywhere in their signatures, certificates, or transparency log entries.

[![@8573](https://avatars.githubusercontent.com/u/3662816?s=80&v=4)](/8573)

### 

**[8573](/8573)** commented [May 23, 2023](#issuecomment-1558221969)

Copy link

Copy Markdown

> That identity embeds state for the GitHub repository (including the owning org/user), but not their email.

Hm... how much consideration has been given to what happens if the user changes their username (or whatever one calls the equivalent for an organization), especially if someone else then takes the old name?

I don't mean to imply that this is at all insurmountable, but I assume it would be appreciated if some thoughts about such cases are documented somewhere.

[![@woodruffw](https://avatars.githubusercontent.com/u/3059210?s=80&u=1376a0d0a4d01d43ad56c47b81da4ae1bfcc4367&v=4)](/woodruffw)

### 

**[woodruffw](/woodruffw)** commented [May 23, 2023](#issuecomment-1558260959)

Copy link

Copy Markdown

> I don't mean to imply that this is at all insurmountable, but I assume it would be appreciated if some thoughts about such cases are documented somewhere.

I appreciate you bringing this up! I'm not sure if it's documented anywhere ([@znewman01](https://github.com/znewman01) or @haydentherapper might know), but there are three responses to this:

1.  For GitHub Actions, the "identity" is effectively the repository at a single state in time, including the SHA revision corresponding to whatever symbolic git `ref` was used. In other words: an attacker who manages to reuse a specific username (or even `user/repo` combination) will still be unable to produce an authentic SHA for the repository they're intending to spoof.
    
2.  The claims embedded in the certificate include the `Source Repository Identifier` and `Source Repository Owner Identifier`. These values are meant to be stable identifiers for the underlying repository or owner, regardless of their name. As a matter of policy, verifying certificates that are issued from workflow identities _should_ include ensuring that those identifiers are the ones expected, for services or contexts where ATO is a practical concern.
    
3.  GitHub, at the very least (not sure about other services) has protections against this: [https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-personal-account-settings/changing-your-github-username](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-personal-account-settings/changing-your-github-username). To quote them:
    

> If the account namespace includes any public repositories that contain an action listed on GitHub Marketplace, or that had more than 100 clones or more than 100 uses of GitHub Actions in the week prior to you renaming your account, GitHub permanently retires the old owner name and repository name combination (OLD-OWNER/REPOSITORY-NAME) when you rename your account. If you try to create a repository using a retired owner name and repository name combination, you will see the error: "The repository <REPOSITORY\_NAME> has been retired and cannot be reused."

[![@Eh2406](https://avatars.githubusercontent.com/u/3709504?s=80&u=e957bfeea78103fd4b186f41411dee4f52e5c4ce&v=4)](/Eh2406)

### 

**[Eh2406](/Eh2406)** commented [May 27, 2023](#issuecomment-1565585352)

Copy link

Copy Markdown

Contributor

I am not speaking for any of the relevant teams, but I am a voting member of the cargo team. I had a meeting this week about this RFC with one of the engineers working on sigstore integration in npm. He offered to work on documenting what engineering decisions were made in npm's integration and **why**, which I thought would be enormously helpful to this discussion.

Looking back at the enormous amounts of discussion here are some issues that I raised that need to be addressed by the next draft of this RFC:

-   I would like to see a more narrative based threat model. If there was a security incident how would it be investigated currently, and how would that be different if we adopt this RFC. Obviously in a utopian future, all the fancy new technologies will work together to catch it instantly. Which is why this threat model needs to focus on what happens if this RFC is the only new technology adopted. I don't think this needs to be a complete model, two or three narratives would suffice to explain how this is helpful. My contact at npm was interested in writing these narratives to explain their integration, which would be a good head start for answering this issue.
-   How does the sigstore configuration work if I am pulling crates from multiple registries that use different instances?
-   Where is the sigstore data being stored? When is it being downloaded? How big is it? If were adding data to the index, how well will this work with the existing git index. (The get index needs to be kept around for backwards compatibility.)
-   The post publish signing involves a whole new API. How is it going to work? Who can sign for a package? Where is the data going to be stored? How is it going to be moderated?

The discussion also has feedback from many other people, most of which are on point criticisms and edits. Hopefully there issues will also be addressed in the next draft.

[![@walterhpearce](https://avatars.githubusercontent.com/u/123987141?s=80&v=4)](/walterhpearce)

### 

**[walterhpearce](/walterhpearce)** commented [Jun 7, 2023](#issuecomment-1581539272)

Copy link

Copy Markdown

I'd like to raise a few additional questions, in line with [@Eh2406](https://github.com/Eh2406) thinking around around.

-   What level of addition effort and maintenance does this entail on the `cargo` side for integration by end users? Will this involve future requests for binary package support and integration? What lines will be drawn for end-user integration support cases? Given sigstores aim is mainly geared towards binary distribution, our use case is only used up until the build phase in the threat model (`B` and tangentially `E`). What use cases and/or expansion is going to the likely next steps requested by users? Said another way, what is the future outlook on further integration that is most likely going to stem from this work in enterprise build environments.
    
-   As `crates.io` and `cargo` stand right now, sigstore would basically used to provide signing and audit trails for publishing via github identities. Given the major threat iterated here is the compromise of a developer system and a malicious package being published by them - I don't see this actually giving us any additional guarantees here without additional changes being made. he RFC does not iterate how cargo should go about retrieving and/or caching this github OIDC token or the requirements placed on it. In that case, the compromise is just shifted from a crates token to a github token.
    
-   How does going this direction align _specifically for Rust_; outside of the fact other ecosystems are adopting it? I think this should be iterating in the RFC specifically because we do not perform binary distribution (for now) via crates.io, and so a majority of the use cases for sigstore are not covered directly within our ecosystem. Those other package repositories do perform binary distribution; so the stages of provenance from source-build-distribute are more thoroughly covered here.
    
-   What do we gain with using sigstore specifically vs. "bring your own key" solutions? I understand a large portion of this is to alleviate the issues of such a solution and to tie signing to an OIDC identity vs a key; however, the RFC doesn't communicate why this is a better solution for a source repository. As an example alternative - we could utilize GPG specifically because `git` supports signing commits; so from a provenance perspective, wouldn't this allow for easier end-to-end _source code validation_ from a repository to a crate package? I'd like to see this specific area explored
    

[![@AaronFriel](https://avatars.githubusercontent.com/u/788800?s=80&u=7b046403605cf8c19935a19fab6ddc6f633461cd&v=4)](/AaronFriel)

### 

**[AaronFriel](/AaronFriel)** commented [Jun 7, 2023](#issuecomment-1581590091) •

edited

Loading

### Uh oh!

There was an error while loading. Please reload this page.

Copy link

Copy Markdown

[@Eh2406](https://github.com/Eh2406) & [@walterhpearce](https://github.com/walterhpearce) I would love to work with you and/or [@lulf](https://github.com/lulf) to revise or create an RFC and a prototype to answer questions around storage by aligning Cargo with OCI 1.1's distribution & image specification.

This would address the storage question and set up Cargo to flexibly adopt this RFC and others in the future, including binary distribution, WASM precompiled proc macros, and so on. It would make it easier for users to create a local mirror of crates, or to use private registries such as AWS ECR, Azure Container Registry, Google Artifact Registry, Zot, Harbor, JFrog Artifactory, and more.

I have no stake in the adoption of sigstore, but I do think that there is a different path to supporting it that creates optionality for not just sigstore, but the counterfactuals you pose. A flexible registry model will make the Cargo ecosystem stronger and aligning to the OCI spec ensures you aren't locked in to a particular signing scheme, or that _the next_ artifact that you might wish to associate with a crate isn't a unique engineering challenge.

[![@tarcieri](https://avatars.githubusercontent.com/u/797?s=80&u=aca2ca512c04d8fb56e791ffd737ceb54be75ad3&v=4)](/tarcieri)

### 

**[tarcieri](/tarcieri)** commented [Jun 7, 2023](#issuecomment-1581594271)

Copy link

Copy Markdown

> Will this involve future requests for binary package support and integration? What lines will be drawn for end-user integration support cases? Given sigstores aim is mainly geared towards binary distribution...

[@walterhpearce](https://github.com/walterhpearce) the "binary" being signed could be a `.crate` file containing source code

[![@walterhpearce](https://avatars.githubusercontent.com/u/123987141?s=80&v=4)](/walterhpearce)

### 

**[walterhpearce](/walterhpearce)** commented [Jun 7, 2023](#issuecomment-1581597615)

Copy link

Copy Markdown

> > Will this involve future requests for binary package support and integration? What lines will be drawn for end-user integration support cases? Given sigstores aim is mainly geared towards binary distribution...
> 
> [@walterhpearce](https://github.com/walterhpearce) the "binary" being signed could be a `.crate` file containing source code

In this immediate case, absolutely. I was further refering to [RFC-3028](https://rust-lang.github.io/rfcs/3028-cargo-binary-dependencies.html), as that is a previously accepted RFC which has direct ramifications for a `cargo` implementation of sigstore verification and signing.

[![@woodruffw](https://avatars.githubusercontent.com/u/3059210?s=80&u=1376a0d0a4d01d43ad56c47b81da4ae1bfcc4367&v=4)](/woodruffw)

### 

**[woodruffw](/woodruffw)** commented [Jun 7, 2023](#issuecomment-1581653286)

Copy link

Copy Markdown

> Will this involve future requests for binary package support and integration? What lines will be drawn for end-user integration support cases? Given sigstores aim is mainly geared towards binary distribution, our use case is only used up until the build phase in the threat model

To add to what [@tarcieri](https://github.com/tarcieri) said: Sigstore doesn't care about _what_ you're signing, or its underlying representation. Supporting binaries (versus source archives) as a discrete category isn't in its design; our plans on PyPI include using it for both source and built distributions, with source distributions closely resembling the source artifacts that `cargo` deals with.

(I think this also answers the question about "how does this align for Rust" -- most package indices are conceptually an artifact store with attached metadata, and this, not binary formats, is all a Sigstore integration is concerned with.)

> Given the major threat iterated here is the compromise of a developer system and a malicious package being published by them - I don't see this actually giving us any additional guarantees here without additional changes being made. he RFC does not iterate how cargo should go about retrieving and/or caching this github OIDC token or the requirements placed on it. In that case, the compromise is just shifted from a crates token to a github token.

I think there might be a breakdown in understanding here (possibly not helped by the diagrams in the RFC): Sigstore doesn't replace any Crates tokens. It's solely a codesigning scheme; it doesn't touch Crates' authentication or authorization components.

The RFC should probably be edited to clarify the OIDC relationship here: when being used from GitHub Actions (and similar CI/CD providers), `cargo` is expected to retrieve an ambient OIDC token that GitHub Actions provides to the current workflow. When being used locally, `cargo` is expected to perform an interactive OAuth2/OIDC flow against the user's identity provider.

> As an example alternative - we could utilize GPG specifically because git supports signing commits; so from a provenance perspective, wouldn't this allow for easier end-to-end source code validation from a repository to a crate package?

We [recently removed GPG support from PyPI](https://blog.pypi.org/posts/2023-05-23-removing-pgp/) because approximately 20 years of end-user use didn't yield appreciable benefits: even advanced users consistently fail to use GPG and related parts of the PGP ecosystem securely and correctly.

GPG also does not solve the end-to-end signing problem: you still need to establish trust in a particular key ID. Without that trust, verifying a GPG signature is roughly equivalent to verifying an untrusted digest in terms of strength (but more misleading, since it implies an identity relationship that does not exist).

The advantage of a scheme like Sigstore is that it replaces an opaque key identifier with a human-readable identifier (an email address, user handle, URL, etc.) while _also_ eliminating a handful of traditional sources of failures in devolved signing schemes (all keys are ephemeral and auditable, users cannot generate weak keys, etc.).

(As an aside: `git` has supported SSH and X.509 signatures for a few years now, and GitHub supports both as well. You can even use Sigstore to sign `git` commits and tags with [`gitsign`](https://github.com/sigstore/gitsign).)

[![@cfm](https://avatars.githubusercontent.com/u/357435?s=40&v=4)](/cfm) [cfm](/cfm) mentioned this pull request [Jun 21, 2023](#ref-issue-1313571720)

[Determine plan for auditing Rust dependencies freedomofpress/securedrop#6500](/freedomofpress/securedrop/issues/6500)

Closed

[![@lulf](https://avatars.githubusercontent.com/u/19670?s=80&u=7392d7bef61e982b56574a360dc652ea70f65765&v=4)](/lulf)

### 

**[lulf](/lulf)** commented [Aug 14, 2023](#issuecomment-1677239117)

Copy link

Copy Markdown

Author

Due to time constraints on my end I'll close this RFC for now, but I'm happy to hand over to anyone who'd like to continue working on this.

[![@lulf](https://avatars.githubusercontent.com/u/19670?s=40&u=7392d7bef61e982b56574a360dc652ea70f65765&v=4)](/lulf) [lulf](/lulf) closed this [Aug 14, 2023](#event-10086148075)

[![@NobodyXu](https://avatars.githubusercontent.com/u/30436523?s=40&v=4)](/NobodyXu) [NobodyXu](/NobodyXu) mentioned this pull request [Aug 19, 2023](#ref-issue-766067469)

[Support package signing and verification cargo-bins/cargo-binstall#1](/cargo-bins/cargo-binstall/issues/1)

Open

3 tasks done

[![@lukehinds](https://avatars.githubusercontent.com/u/7058938?s=80&u=b601f1de5519e0cab69c45f75987b04a64c2867b&v=4)](/lukehinds)

### 

**[lukehinds](/lukehinds)** commented [Nov 1, 2023](#issuecomment-1789448428)

Copy link

Copy Markdown

[@lulf](https://github.com/lulf) It would be a shame to see this work not happen, I can takeover and caretake.

[![@tarcieri](https://avatars.githubusercontent.com/u/797?s=80&u=aca2ca512c04d8fb56e791ffd737ceb54be75ad3&v=4)](/tarcieri)

### 

**[tarcieri](/tarcieri)** commented [Dec 21, 2023](#issuecomment-1866794023)

Copy link

Copy Markdown

FYI to anyone interested in this: the Rust Foundation has announced intention to do some RFC work in this particular area as well, in case anyone wants to collaborate or carry some of this work forward

[https://foundation.rust-lang.org/news/2023-12-21-improving-supply-chain-security/](https://foundation.rust-lang.org/news/2023-12-21-improving-supply-chain-security/)

[![@SantiagoTorres](https://avatars.githubusercontent.com/u/3579933?s=40&v=4)](/SantiagoTorres) [SantiagoTorres](/SantiagoTorres) mentioned this pull request [Nov 5, 2024](#ref-pullrequest-2627687624)

[Implement The Update Framework (TUF) for Project Signing #3724](/rust-lang/rfcs/pull/3724)

Open

[Sign up for free](/join?source=comment-repo) **to join this conversation on GitHub**. Already have an account? [Sign in to comment](/login?return_to=https%3A%2F%2Fgithub.com%2Frust-lang%2Frfcs%2Fpull%2F3403)

### Labels

[T-cargo](/rust-lang/rfcs/issues?q=state%3Aopen%20label%3AT-cargo) Relevant to the Cargo team, which will review and decide on the RFC. [T-crates-io](/rust-lang/rfcs/issues?q=state%3Aopen%20label%3AT-crates-io) Relevant to the crates.io team, which will review and decide on the RFC.

### 20 participants

 [![@lulf](https://avatars.githubusercontent.com/u/19670?s=52&v=4)](/lulf)[![@jonas-schievink](https://avatars.githubusercontent.com/u/1786438?s=52&v=4) ](/jonas-schievink)[![@programmerjake](https://avatars.githubusercontent.com/u/4584340?s=52&v=4) ](/programmerjake)[![@tpletcher](https://avatars.githubusercontent.com/u/28309?s=52&v=4) ](/tpletcher)[![@comex](https://avatars.githubusercontent.com/u/47517?s=52&v=4) ](/comex)[![@clarfonthey](https://avatars.githubusercontent.com/u/15850505?s=52&v=4) ](/clarfonthey)[![@JakobDegen](https://avatars.githubusercontent.com/u/51179609?s=52&v=4) ](/JakobDegen)[![@workingjubilee](https://avatars.githubusercontent.com/u/46493976?s=52&v=4) ](/workingjubilee)[![@emilyalbini](https://avatars.githubusercontent.com/u/2299951?s=52&v=4) ](/emilyalbini)[![@tarcieri](https://avatars.githubusercontent.com/u/797?s=52&v=4) ](/tarcieri)[![@8573](https://avatars.githubusercontent.com/u/3662816?s=52&v=4) ](/8573)[![@Kixunil](https://avatars.githubusercontent.com/u/1178779?s=52&v=4) ](/Kixunil)[![@AaronFriel](https://avatars.githubusercontent.com/u/788800?s=52&v=4) ](/AaronFriel)[![@znewman01](https://avatars.githubusercontent.com/u/873857?s=52&v=4) ](/znewman01)[![@burdges](https://avatars.githubusercontent.com/u/680126?s=52&v=4) ](/burdges)[![@woodruffw](https://avatars.githubusercontent.com/u/3059210?s=52&v=4) ](/woodruffw)[![@Eh2406](https://avatars.githubusercontent.com/u/3709504?s=52&v=4) ](/Eh2406)[![@walterhpearce](https://avatars.githubusercontent.com/u/123987141?s=52&v=4) ](/walterhpearce)[![@lukehinds](https://avatars.githubusercontent.com/u/7058938?s=52&v=4) ](/lukehinds)[![@joshtriplett](https://avatars.githubusercontent.com/u/162737?s=52&v=4)](/joshtriplett)                   

Add this suggestion to a batch that can be applied as a single commit.This suggestion is invalid because no changes were made to the code.Suggestions cannot be applied while the pull request is closed.Suggestions cannot be applied while viewing a subset of changes.Only one suggestion per line can be applied in a batch.Add this suggestion to a batch that can be applied as a single commit.Applying suggestions on deleted lines is not supported.You must change the existing code in this line in order to create a valid suggestion.Outdated suggestions cannot be applied.This suggestion has been applied or marked resolved.Suggestions cannot be applied from pending reviews.Suggestions cannot be applied on multi-line comments.Suggestions cannot be applied while the pull request is queued to merge.Suggestion cannot be applied right now. Please check back later.
