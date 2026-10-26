Search by [![](/img/sponsors/algolia-logo-light.svg?v=1791487890)](https://www.algolia.com/)

## What is Packagist?

Packagist is the default Composer package repository. It lets you find packages and lets Composer know where to get the code from. You can use Composer to manage your project or libraries' dependencies - read more about it on the [Composer website](https://getcomposer.org/).

### Support & Consulting

Commercial support and consulting for PHP dependency management with Packagist and Composer are available through [Private Packagist](https://packagist.com) subscription plans.

For general Composer usage guides and a command reference, see the [Composer documentation](https://getcomposer.org/doc/).

### Contributing

To report issues or contribute code, you can find the source repository on [GitHub](https://github.com/composer/packagist).

The best way to financially support the hosting and maintenance of Packagist.org and Composer is by using [Private Packagist](https://packagist.com). It helps you install packages fast and reliably, provides you with a private package repository, and the proceeds go directly towards Packagist.org and Composer maintenance.

For other ways to sponsor the project, visit our [sponsors page](/sponsor/).

## How to submit packages?

### Naming your package

First of all, you must pick a package name. This is a very important step since it can not change and it should be unique enough to avoid conflicts in the future.

The package name consists of a vendor name and a project name joined by a `/`. The vendor name exists to prevent naming conflicts. For example, by including a vendor name both `igorw` and `seldaek` can have a library named `json` by naming their packages `igorw/json` and `seldaek/json`.

In some cases the vendor name and the package name may be identical. An example of this would be \`monolog/monolog\`. For projects with a unique name this is recommended. It also allows adding more related projects under the same vendor later on. If you are maintaining a library, this would make it really easy to split it up into smaller decoupled parts.

Here is a list of typical package names for reference:

```
// Monolog is a library, so the vendor name and package name are the same.
monolog/monolog

// That could be the name of a drupal module (maintained/provided by monolog,
// if the drupal team did it, the vendor would be drupal).
monolog/monolog-drupal-module

// Acme is a company or person here, they can name their package with a common name (Email).
// As long as it's in their own vendor namespace it does not conflict with anyone else.
acme/email
```

Vendor names on packagist are protected once a package with that name has been published. That means you can not publish packages with a vendor name that already exists on packagist without permission. To be able to publish packages for an already existing vendor name you need to be maintainer of at least one package within that vendor. Package and vendor names are allowed to contain lowercase letters (a-z), numbers (0-9), and the characters ".", "-" and "\_". Each must start with a letter or number.

### Creating a composer.json file

The composer.json file should reside at the top of your package's git/svn/.. repository, and is the way you describe your package to both packagist and composer.

A typical composer.json file looks like this:

```
{
    "name": "monolog/monolog",
    "type": "library",
    "description": "Logging for PHP 8.0",
    "keywords": ["log","logging"],
    "homepage": "https://github.com/Seldaek/monolog",
    "license": "MIT",
    "authors": [
        {
            "name": "Jordi Boggiano",
            "email": "redacted@example.invalid",
            "homepage": "http://seld.be",
            "role": "Developer"
        }
    ],
    "require": {
        "php": ">=8.2"
    },
    "autoload": {
        "psr-4": {
            "Monolog\\": "src/Monolog"
        }
    }
}
```

Most of this information is obvious, keywords are tags, require are list of dependencies that your package has. This can of course be packages, not only a php version. You can use ext-foo to require php extensions (e.g. ext-curl). Note that most extensions don't expose version information, so unless you know for sure it does, it's safer to use `"ext-curl": "*"` to allow any version of it. Finally the type field is in this case indicating that this is a library. If you do plugins for frameworks etc, and if they integrate composer, they may have a custom package type for their plugins that you can use to install the package with their own installer. In the absence of custom type, you can omit it or use "library".

Once you have this file committed in your repository root, you can [submit the package](/packages/submit) to Packagist by entering the public repository URL.

### Validate and publish

Run `composer validate` to check that your composer.json file has no syntax errors, then commit it to your git or other VCS repository.

[Log in](/login/) or [register](/register/) on this site, then hit the [submit](/packages/submit) button in the menu. Once you entered your public repository URL, your package will be automatically crawled periodically - just make sure you keep the composer.json file up to date.

Use [Private Packagist](https://packagist.com) if you want to share private code as a Composer package with colleagues or customers without publishing it for everyone on Packagist.org.

### Managing package versions

New versions of your package are automatically fetched from tags you create in your VCS repository.

The easiest way to manage versioning is to just omit the version field from the composer.json file. The version numbers will then be parsed from the tag and branch names.

Tag/version names should match 'X.Y.Z', or 'vX.Y.Z', with an optional suffix for RC, beta, alpha or patch versions. Here are a few examples of valid tag names:

```
1.0.0
v1.0.0
1.10.5-RC1
v4.4.4beta2
v2.0.0-alpha
v2.0.4-p1
```

Branches will automatically appear as "dev" versions that are easily installable by anyone that wants to try your library's latest and greatest, but that does not mean you should not tag releases. The use of [Semantic Versioning](http://semver.org/) is strongly encouraged.

### Update Schedule

New packages will be crawled **immediately** after submission if you have JS enabled.

Existing packages without auto-updating (GitHub/BitBucket/GitLab/Gitea hook) will be crawled **once a week** for updates. When a hook is enabled, packages are crawled whenever you push, or at least once a month in case the crawl failed. You can also trigger a manual update on your package page if you are logged-in as a maintainer.

It is highly recommended to set up the **GitHub/BitBucket/GitLab/Gitea service hook** for all your packages. This reduces the load on our side, and ensures your package is updated almost instantly. Check the how-to [below](#how-to-update-packages).

The search index is updated **every five minutes**. It will index (or reindex) any package that has been crawled since the last time the search indexer ran.

## How to update packages?

### GitHub Hook

Enabling the Packagist service hook ensures that your package will always be updated instantly when you push to GitHub.

To do so you can:

-   Make sure you log in via GitHub (if you already have an account not connected to GitHub, you can [connect it on your profile](https://packagist.org/profile/edit)). If you are logged in already, log out first then log in via GitHub again to make sure you grant us the required permissions.
-   Make sure [the Packagist application](https://github.com/settings/connections/applications/a059f127e1c09c04aa5a) has access to all the GitHub organizations you need to publish packages from.
-   Check [your package list](https://packagist.org/profile/) to see if any has a warning about not being automatically synced.
-   If you still need to setup sync on some packages, try [triggering a manual account sync](/trigger-github-sync/) to have Packagist try to set up hooks on your account again. Note that archived repositories can not be setup as they are readonly in GitHub's API.

#### Do not want to log in via GitHub and grant us webhook configuration access?

You can configure a GitHub webhook manually by using the following values:

-   Payload URL: `https://packagist.org/api/github?username=PACKAGIST_USERNAME`
-   Content Type: `application/json`
-   Secret: your [Packagist API Token](/profile/)
-   Which events? Just the `push` event is enough.

### Bitbucket Webhooks

To enable the Bitbucket web hook, go to your BitBucket repository, open the settings and select "Webhooks" in the menu. Add a new hook. You have to enter the Packagist endpoint, containing both your username and API token. Enter `https://packagist.org/api/bitbucket?username=USERNAME&apiToken=API_TOKEN` as URL. Save your changes and you're done.

### GitLab Service

To enable the GitLab service integration, go to your GitLab repository, open the Settings > Integrations page from the menu. Search for Packagist in the list of Project Services. Check the "Active" box, enter your packagist.org username and API token. Save your changes and you're done.

### Gitea Webhook

Gitea supports automatic package updates on Packagist since v1.17.

To enable the Gitea webhook, go to your Gitea repository, open the Settings > Webhooks page and click on "Add Webhook". Select "Packagist" from the dropdown menu. You need to enter your packagist username, API token and the packagist URL of your package in the form. All other options can remain unchanged. Save your changes and you're done.

### Manual hook setup

If you do not use Bitbucket or GitHub there is a generic endpoint you can call manually from a git post-receive hook or similar. You have to do a `POST` request to `https://packagist.org/api/update-package?username=USERNAME&apiToken=API_TOKEN` with a request body looking like this: `{"repository":{"url":"PACKAGIST_PACKAGE_URL"}}`

You can do this using curl for example:

curl -XPOST -H'content-type:application/json' 'https://packagist.org/api/update-package?username=USERNAME&apiToken=API\_TOKEN' -d'{"repository":{"url":"PACKAGIST\_PACKAGE\_URL"}}'

### API Token

You can find your API token on [your profile page](/profile/).

### IP Allowlists

If you are trying to restrict IPs and need to grant access to packagist.org workers we maintain a [list of our public IPs](https://packagist-org-network.s3-eu-west-1.amazonaws.com/ip-address-list).
