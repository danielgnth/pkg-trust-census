[](https://github.com/pypi/warehouse/blob/main/docs/user/trusted-publishers/index.md "Edit this page")

## Publishing to PyPI with a Trusted Publisher

"Trusted Publishing" is our term for using the [OpenID Connect (OIDC)](https://openid.net/connect/) standard to exchange short-lived identity tokens between a trusted third-party service and PyPI. This method can be used in automated environments and eliminates the need to use manually generated API tokens to authenticate with PyPI when publishing.

For a quickstart, see:

-   [Adding a trusted publisher to an existing PyPI project](adding-a-publisher/)
-   [Creating a PyPI project with a trusted publisher](creating-a-project-through-oidc/)

## Quick background: Publishing with OpenID Connect

OpenID Connect (OIDC) publishing is a mechanism for uploading packages to PyPI, _complementing_ API tokens.

You don't need to understand OIDC to use OIDC publishing with PyPI, but here's the TL;DR:

1.  Certain CI services (like GitHub Actions) are OIDC _identity providers_, meaning that they can issue short-lived credentials ("OIDC tokens") that a third party can **strongly** verify came from the CI service (as well as which user, repository, etc. actually executed);
2.  Projects on PyPI can be configured to trust a particular configuration on a particular CI service, making that configuration an OIDC publisher for that project;
3.  Release automation (like GitHub Actions) can submit an OIDC token to PyPI. The token will be matched against configurations trusted by different projects; if any projects trust the token's configuration, then PyPI will mint a _short-lived API token_ for those projects and return it;
4.  The short-lived API token behaves exactly like a normal project-scoped API token, except that it's only valid for 15 minutes from time of creation (enough time for the CI to use it to upload packages).

This confers significant usability and security advantages when compared to PyPI's traditional authentication methods:

-   Usability: with Trusted Publishing, users no longer need to manually create API tokens on PyPI and copy-paste them into their CI provider. The only manual step is configuring the publisher on PyPI.
-   Security: PyPI's normal API tokens are long-lived, meaning that an attacker who compromises a package's release token can use it until its legitimate user notices and manually revokes it. Trusted Publishing avoids this problem because the tokens minted expire automatically.
