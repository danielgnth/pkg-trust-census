We've shipped a large batch of updates to Private Packagist over the past few months. A lot of our attention went to supply chain security, which we've covered in depth in our supply chain security series. In this post, we'll highlight the other improvements to account and token security, the API, security monitoring and everyday usability that we introduced in May, June, and July.

## New supply chain security features

We added organization-wide controls to the Security settings: the ability to [block outdated Composer clients](https://blog.packagist.com/enforce-a-safe-composer-version-across-your-organization/) from your repository, [repository-level blocking of malware-flagged versions](https://blog.packagist.com/blocking-malware-downloads-for-every-composer-version-in-private-packagist/) for every Composer version, [an allowlist for which Composer plugins may run](https://blog.packagist.com/restricting-composer-plugins-across-your-organization/) in your organization and two options that [close Composer's silent fallback to upstream dist and source URLs](https://blog.packagist.com/closing-composers-download-fallback-paths-in-private-packagist/). 

Together these configuration options let you enforce supply chain decisions consistently across your entire organization, instead of relying on individual composer.json files and separate environments to be configured correctly.

## Account and token security fixes

Regenerating a user-scoped Composer authentication token on your profile's [Composer Auth](https://packagist.com/profile/auth) page now invalidates the previous token immediately. Previously the old token continued to authenticate downloads for up to 14 days, and we've revoked all remaining cached tokens that predated the fix. 

Enforcing multi-factor authentication for all organization members now extends to Composer authentication tokens for CLI access too: a user without MFA configured can no longer use their Composer auth token to reach the Composer repository of an organization that requires MFA.

## More complete suborganization audit logging

We filled several gaps in the audit log of parent organizations for entries that were only recorded in suborganization audit logs. Creating, editing, regenerating, expiring, or deleting an authentication token in a suborganization now also records an entry in the parent organization's audit log. On the parent organization we now also log changes to the default access for new suborganizations on a team, package, multi-package repository, or mirrored repository, and the deletion of a package that was only made available, not enabled, in a suborganization. 

## Security monitoring reads your Composer 2.10 policy config

Security monitoring now reads the new [config.policy](https://getcomposer.org/doc/06-config.md#policy) section introduced in Composer 2.10 to decide which security advisories to suppress on a monitored branch. There is still a fallback to config.audit for composer.json files that use the older format. If you've already migrated a project's advisory handling to the new policy configuration, your monitoring settings stay in sync with it automatically.

## API improvements

[API request signatures](https://packagist.com/docs/api/api-authentication) moved to a version 2 scheme that also covers URL query parameters. The version 1 scheme allowed query strings, for example pagination filters, to be modified without invalidating the signature. Please upgrade [private-packagist/api-client](https://github.com/packagist/private-packagist-api-client) to version 1.41.0 to use the new signature, as the previous scheme has been deprecated and will eventually be removed. 

The API endpoint that returns [a list of security issues](https://packagist.com/docs/api#/Security%20Monitoring/listPackageSecurityIssues) now accepts a _policy_ query parameter, so you can retrieve only the issues raised by a specific dependency policy. Currently, you can filter by advisories or malware. This makes it easier to build tooling that reacts to malware findings separately from advisories, for example.

You can now also create and manage artifact packages for suborganizations using the [new /api/suborganizations/{suborganizationName}/packages/artifacts/ endpoint](https://packagist.com/docs/api#/Package/createSuborganizationPackageArtifact). Previously this functionality was only available in the top-level organization. Editing a package in a suborganization via the API no longer returns a 404 "No endpoint found" error either, and now applies the change as expected. 

## GitLab subgroup synchronization

Synchronizing a GitLab subgroup no longer fails with a permissions error when the connected user is an owner of the subgroup but lacks permissions to list the parent group's members. Inherited members of a subgroup are now read from the subgroup directly. 

Please note that synchronization now requires GitLab 11.2 or newer, since older versions lack the API endpoint needed to read inherited members without permissions on the parent group.

## Migrating from Bitbucket app passwords to API tokens

Bitbucket has retired the use of app passwords. We already added support for their new API tokens last year, but we've made the migration process more straightforward. Editing an old app password credential and entering an API token now switches the credential type to API token automatically.

Bitbucket API token credentials are now correctly recognized as supporting webhook creation. Previously, no webhook was installed for newly added packages using such a token. Any missing webhooks have now been installed automatically, so you don’t have to take any action if your packages were affected. 

## What else is new?

We've listed the most important changes here, but if you are looking for the full list of all changes and bug fixes, please take a look at our [changelog](https://packagist.com/docs/changelog).

If you have any questions or want to learn more about specific features, feel free to reach out to our support team at any time!
