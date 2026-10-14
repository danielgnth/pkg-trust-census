_Published: January 28, 2025_

[← Back to News Archive](../archive/)

As part of our efforts to ensure the security of our users, we have rolled out an update to the Central Publisher Portal that validates [Sigstore](https://www.sigstore.dev/) signature files. This assists developers looking to adopt Sigstore for their release processes by ensuring that their signatures can successfully be verified by end-users.

We would like to stress that Sigstore signature files are not required to publish at this time. What is being announced today is the integration of support for publishers who wish to provide Sigstore signatures.

## What is Sigstore?[⚓︎](#what-is-sigstore "Permanent link")

Sigstore is a project that is attempting to create a standardized, modern approach to securing the software supply chain. It works in much the same way that PGP signatures work now, but with the intent of having a smoother setup process and easier auditing process for consumers. We recommend reading more about how it works on [the Sigstore website](https://www.sigstore.dev/how-it-works).

As of now publishers are able to publish `<file name>.sigstore.json` files that correspond to `<filename>` files (in the same way that they are required to publish `<filename>.asc` signatures). These files are copied to Maven Central for consumption by end-users. Eventually, Central may provide [in-toto attestations](https://in-toto.io/) or similar attestations as the ecosystem continues to mature. Those attestations would assist end-users in understanding and trusting the entire supply chain from publishing to consuming.

## Is this replacing PGP signatures?[⚓︎](#is-this-replacing-pgp-signatures "Permanent link")

We have no intention of replacing PGP signatures with Sigstore signatures. PGP is an established standard that has served Maven Central well over the years. We encourage end-users to continue making use of the provided PGP signature files to ensure that the software components that they download from Central originate from the publisher they expect.

We are monitoring adoption of Sigstore and may eventually make both Sigstore and PGP signatures required for publishing. If the community adopts Sigstore, there is a possible future where it replaces PGP as the required signature standard for Maven Central. What we can guarantee is that there will always be a way to cryptographically verify components that are downloaded from Maven Central.

## How Can I start publishing Sigstore signatures for my components?[⚓︎](#how-can-i-start-publishing-sigstore-signatures-for-my-components "Permanent link")

Sigstore provides [Maven](https://github.com/sigstore/sigstore-java/tree/main/sigstore-maven-plugin) and [Gradle](https://github.com/sigstore/sigstore-java/tree/main/sigstore-gradle) plugins for signing files. Please see their documentation for the nuances of using the plugins such as in continuous-integration or offline environments.

When publishing via the Central Portal Publisher Service, you will see a warning on the [deployments page](https://central.sonatype.com/publishing/deployments) if we are unable to successfully verify the signatures associated with your deployment. After we gain confidence in the adoption of Sigstore signatures and the usability of our integration, we will turn those warnings into errors that will cause deployments to fail validation. We wish to restate that not providing Sigstore signatures will not cause your deployment to fail, but providing invalid Sigstore signatures will eventually do so.
