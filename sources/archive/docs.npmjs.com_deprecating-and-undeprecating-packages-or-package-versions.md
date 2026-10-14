Table of contents

-   -   [Using the website](#using-the-website)
    -   [Using the command line](#using-the-command-line)
-   -   [Using the command line](#using-the-command-line-1)
-   [Undeprecating a package or version](#undeprecating-a-package-or-version)
-   [Transferring a deprecated package to npm](#transferring-a-deprecated-package-to-npm)

If you no longer wish to maintain a package, or if you would like to encourage users to update to a new or different version, you can [deprecate](/cli/deprecate) it. Deprecating a package or version will print a message to the terminal when a user installs it.

A deprecation warning or message can say anything. You may wish to include a message encouraging users to update to a specific version, or an alternate, supported package.

**Note:** We strongly recommend deprecating packages or package versions instead of [unpublishing](/unpublishing-packages-from-the-registry) them, because unpublishing removes a package from the registry entirely, meaning anyone who relied on it will no longer be able to use it, with no warning.

## [Deprecating an entire package](#deprecating-an-entire-package)

Deprecating an entire package will remove it from search results on the npm website and a deprecation message will also be displayed on the package page.

![Screenshot of package deprecation](/packages-and-modules/updating-and-managing-your-published-packages/deprecate-package.png)

Deprecating a package is an alternative to deleting a package if your package does not meet the [unpublishing requirements](/policies/unpublish).

## [Using the website](#using-the-website)

1.  On the npm "[Sign In](https://www.npmjs.com/login)" page, enter your account details and click **Sign In**. ![Screenshot of npm login dialog](/shared/user-login.png)
2.  Navigate to the package page for the package you want to deprecate, replacing `<your-package-name>` with the name of your package: `https://www.npmjs.com/package/<your-package-name>`.
    
3.  Click **Settings**.
    
    ![Screenshot showing the settings tab on a package page](/packages-and-modules/securing-your-code/2fa-package-admin.png)
4.  Under "deprecate package", click **Deprecate package**.
    
    ![Screenshot showing the deprecate package button](/packages-and-modules/deleting-deprecating/deprecate-package-settings.png)
5.  If you are sure that you want to continue, enter your package name and click **Deprecate package**.
    
    ![Screenshot showing the deprecate package confirmation](/packages-and-modules/deleting-deprecating/deprecate-package-confirm.png)

## [Using the command line](#using-the-command-line)

To deprecate an entire package, run the following command, replacing `<package-name>` with the name of your package, and `"<message>"` with your deprecation message:

`npm deprecate <package-name> "<message>"`

If you have enabled [two-factor authentication](/about-two-factor-authentication), add a one-time password to the command, `--otp=123456` (where _123456_ is the code from your authenticator app).

## [Deprecating a single version of a package](#deprecating-a-single-version-of-a-package)

When you deprecate a version of a package, a red message will be displayed on that version's package page, similar to deprecating an entire package.

![Screenshot of package deprecation for a particular version](/packages-and-modules/updating-and-managing-your-published-packages/deprecate-version.png)

## [Using the command line](#using-the-command-line-1)

To deprecate a package version, run the following command, replacing `<package-name>` with the name of your package, `<version>` with your version number, and `"<message>"` with your deprecation message:

`npm deprecate <package-name>@<version> "<message>"`

The CLI will also accept version ranges for `<version>`.

If you have two-factor auth, add a one-time password to the command, `--otp=123456` (where _123456_ is the code from your authenticator).

## [Undeprecating a package or version](#undeprecating-a-package-or-version)

To undeprecate a package, replace `"<message>"` with `""` (an empty string) in one of the above commands.

For example, to undeprecate an entire package, run the following command, replacing `<package-name>` with the name of your package, and `<version>` with your version number:

`npm deprecate <package-name> ""`

Or to undeprecate only a single package version, run the following command, replacing `<package-name>` with the name of your package, and `<version>` with your version number:

`npm deprecate <package-name>@<version> ""`

If you have two-factor auth, add a one-time password to the command, `--otp=123456` (where _123456_ is the code from your authenticator).

## [Transferring a deprecated package to npm](#transferring-a-deprecated-package-to-npm)

If you are no longer maintaining a package, but other users depend on it, and you'd like to remove it from your user profile, you can transfer it to the [`@npm`](https://www.npmjs.com/~npm) user account, which is owned by the npm registry.

**Note:** Once you transfer a package to the npm account, you will no longer be able to update it.

To transfer a package to the npm user account, run the following two commands in order, replacing `<user>` with your npm user name, and `<package-name>` with the package you want to transfer:

npm owner add npm <package-name\>

npm owner rm <user\> <package-name\>

If you have two-factor auth, add a one-time password to the command, `--otp=123456` (where _123456_ is the code from your authenticator).
