npm provenance is now generally available.

npm packages built on a supported cloud CI/CD system can publish with provenance. Today this includes GitHub Actions and GitLab CI/CD.

Publishing with provenance verifiably links the package back to its source repository and build instructions. Provenance is restricted to public packages and public source repositories only.

npm will check the linked source commit and repository when you view a package's provenance information on npmjs.com. If the linked source commit or repository cannot be found, an error displays at the top of the page and alongside the provenance information to let you know that provenance for this package can no longer be established. This can happen when a repository is deleted or made private.

Once published, packages display provenance on the [registry website](https://www.npmjs.com/package/sigstore#provenance):

![Provenance displayed on the registry website](https://github.com/github/release-assets/assets/20165/909b5d49-a519-409d-973f-a8a49f9b08ae)

For more information, see [generating provenance](https://docs.npmjs.com/generating-provenance-statements).

## Subscribe to our developer newsletter

Discover tips, technical guides, and best practices in our biweekly newsletter just for devs.

[

Back to top

](#start-of-content)
