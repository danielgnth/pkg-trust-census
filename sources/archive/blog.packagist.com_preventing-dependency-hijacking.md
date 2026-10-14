[composer](https://blog.packagist.com/tag/composer/)

-   [![Nils Adermann](//www.gravatar.com/avatar/dc5728eadcbd629aa6b14f3d47148968?s=250&d=mm&r=x)](/author/naderman/)

Alex Birsan recently published his article ["Dependency Confusion: How I Hacked Into Apple, Microsoft and Dozens of Other Companies"](https://medium.com/@alex.birsan/dependency-confusion-4a5d60fec610) in which he explains how he used language level package managers like npm (Javascript), pip (Python), and gems (Ruby) to get companies to install and run his malicious code on their infrastructure.

The problem boils down to companies referencing internal packages by name, e.g. _"my-internal-package"_ and an attacker then publishing a package by the same name _"my-internal-package"_ with a higher version number on the central registry / package repository for that language (for PHP that would be [packagist.org](https://packagist.org)). The companies then installed and ran these malicious packages instead of their internal packages because their package manager chose the higher version number from the default package repository over their internal repository.

Prompted on Twitter for our take on this issue for Composer and Packagist [Jordi briefly explained the different measures](https://twitter.com/seldaek/status/1359417655762055171) Composer and Packagist have in place to help protect companies from this serious problem:

1.  **Composer package names always include a vendor prefix**, e.g. _"my-company/our-internal-pkg"._ This naming is strictly enforced by the command line utility and on packagist.org. Packagist.org reserves vendor name prefixes for the maintainer as soon as they publish a first package. Nobody else can then publish another package with the _my-company/_ vendor prefix without a maintainer's consent.
    
    If your company has **at least one public package on packagist.org** with your vendor prefix (even an empty one works), e.g. _"my-company/dummy-pkg"_, **attackers cannot create packages there which would match any of your internal package names** using your vendor prefix. If you required _"my-company/my-internal-package"_ internally, attackers cannot hijack this name on packagist.org.
    
2.  As of Composer 2.0 custom repositories are [**canonical by default**](https://getcomposer.org/doc/articles/repository-priorities.md#canonical-repositories). This means that if a package name is found in a custom or private package repository, only those versions are loaded at all. If the same package name exists on lower priority repositories or on packagist.org, it is ignored. Even **if an attacker publishes a package** by the same name as your internal package **with a higher version number, Composer will not install it**.
3.  [Private Packagist](https://packagist.com) has always treated third party mirrored repositories including packagist.org as canonical and never loaded package information from mirrors if a private package by that name exists. So **Private Packagist protects users on Composer 1.x in the same way as Composer 2** now does by default.
4.  **[Private Packagist](https://packagist.com) allows you to manually approve each newly mirrored package** from a third party repository like packagist.org before it can be installed with Composer. This is an optional feature to give customers even more control over the third party code they use.
5.  **Composer always generates a lock file** with list of the concrete versions and download URLs of dependencies installed. We strongly recommend you commit the lock file to a version control system and only use _composer install_ during build steps, which will only ever install the exact versions listed in the lock file. You can make reviewing changes to the lock file a part of your regular workflows to ensure code is not loaded from untrusted third parties.
6.  With Composer 2 you can [exclude](https://getcomposer.org/doc/articles/repository-priorities.md#filtering-packages) package names or patterns from loading for each repository. So you can ensure even mistyped non-existent packages without a registered prefix on packagist.org cannot be loaded from packagist.org by replacing the default configuration in composer.json. The exclude filter can be used on additional third party package repositories too.

```
    "repositories": {
        "private-repo": {
            "url": "https://my-repo.internal"
        }
        "packagist.org": {
            "url": "https://repo.packagist.org",
            "exclude": ["myprefix/*"]
        }
    }
```

Supply chain attacks like the ones described by Alex are a serious threat to businesses and have frequently shown up in the news recently, so it is important that your business understands the risks it is exposed to and takes measures to mitigate them. We hope this blog post helps you understand some of the measures you can undertake when working with Composer to protect yourself from dependency chain attacks.
