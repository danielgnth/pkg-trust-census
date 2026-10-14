## Common questions

## [Basics](#basics)

-   [What's a package, project, or release?](#packages)
-   [How do I install a file (package) from PyPI?](#installing)
-   [How do I package and publish my code for PyPI?](#publishing)
-   [What's a trove classifier?](#trove-classifier)
-   [What's a "yanked" release?](#yanked)
-   [What's an archived project?](#archived-project)
-   [What is a pre-release?](#pre-release-versioning)

## [My Account](#my-account)

-   [Why do I need a verified email address?](#verified-email)
-   [Why is PyPI telling me my password is compromised?](#compromised-password)
-   [What should I do if I notice suspicious activity on my account?](#suspicious-activity)
-   [Why is PyPI telling me my API token is compromised?](#compromised-token)
-   [What is two-factor authentication and how does it work on PyPI?](#twofa)
-   [How does two-factor authentication with an authentication application (TOTP) work? How do I set it up on PyPI?](#totp)
-   [How does two-factor authentication with a security device (e.g. USB key) work? How do I set it up on PyPI?](#utfkey)
-   [What devices (other than a USB key) can I use as a security device?](#utfdevices)
-   [How does two-factor authentication with a recovery code work? How do I set it up on PyPI?](#recoverycodes)
-   [How can I use API tokens to authenticate with PyPI?](#apitoken)
-   [Why do certain actions require me to confirm my password?](#sensitiveactions)
-   [How do I change my PyPI username?](#username-change)
-   [How can I use Trusted Publishers to publish to PyPI?](#trusted-publishers)

## [Integrating](#integrating)

-   [Does PyPI have APIs I can use?](#APIs)
-   [How can I run a mirror of PyPI?](#mirroring)
-   [How do I get notified when a new version of a project is released?](#project-release-notifications)
-   [Where can I see statistics about PyPI, downloads, and project/package usage?](#statistics)
-   [What are the file hashes used for, and how can I verify them?](#verify-hashes)

## [Administration of projects on PyPI](#administration)

-   [How can I publish my private packages to PyPI?](#private-indices)
-   [Why isn't my desired project name available?](#project-name)
-   [How do I claim an abandoned or previously registered project name?](#project-name-claim)
-   [What collaborator roles are available for a project on PyPI?](#collaborator-roles)
-   [How do I become an owner/maintainer of a project on PyPI?](#request-ownership)
-   [How can I upload a project description in a different format?](#description-content-type)
-   [How do I get a file size limit exemption or increase for my project?](#file-size-limit)
-   [How do I get a total project size limit exemption or increase for my project?](#project-size-limit)
-   [Where does PyPI get its data on project vulnerabilities from, and how can I correct it?](#vulnerability-data)
-   [How can I restore a deleted project, release or file?](#deletion)

## [Troubleshooting](#troubleshooting)

-   [Why am I getting "the description failed to render" error?](#description-render-failure)
-   [Why can't I manually upload files to PyPI, through the browser interface?](#uploading)
-   [I forgot my PyPI password. Can you help me?](#login-problem)
-   [I've lost access to my PyPI account. Can you help me?](#account-recovery)
-   [Why am I getting an "Invalid or non-existent authentication information." error when uploading files?](#invalid-auth)
-   [Why am I getting "No matching distribution found" or "Could not fetch URL" errors during `pip install`?](#tls-deprecation)
-   [I am having trouble using the PyPI website. Can you help me?](#accessibility)
-   [Why did my package or user registration get blocked?](#admin-intervention)
-   [Why am I getting a "Filename or contents already exists" or "Filename has been previously used" error?](#file-name-reuse)
-   [How do I request a new trove classifier?](#new-classifier)
-   [Where can I report a bug or provide feedback about PyPI?](#feedback)
-   [I'm having trouble setting up two factor authentication with an authentication application (TOTP). Can you help me?](#totp_trouble)
-   [My project or release says it's in quarantine. What does that mean?](#project_in_quarantine)

## [About](#about)

-   [Who maintains PyPI?](#maintainers)
-   [What powers PyPI?](#sponsors)
-   [Can I depend on PyPI being available?](#availability)
-   [How can I contribute to PyPI?](#contributing)
-   [How do I keep up with upcoming changes to PyPI?](#upcoming-changes)
-   [How can I get a list of PyPI's IP addresses?](#ips)
-   [What does the "beta feature" badge mean? What are Warehouse's current beta features?](#beta-badge)
-   [How do I pronounce "PyPI"?](#pronunciation)

## Basics

### What's a package, project, or release?

We use a number of terms to describe software available on PyPI, like "project", "release", "file", and "package". Sometimes those terms are confusing because they're used to describe different things in other contexts. Here's how we use them on PyPI:

A "project" on PyPI is the name of a collection of releases and files, and information about them. Projects on PyPI are made and shared by other members of the Python community so that you can use them.

A "release" on PyPI is a specific version of a project. For example, the [requests](https://pypi.org/project/requests/) project has many releases, like "requests 2.10" and "requests 1.2.1". A release consists of one or more "files".

A "file", also known as a "package", on PyPI is something that you can download and install. Because of different hardware, operating systems, and file formats, a release may have several files (packages), like an archive containing source code or a binary [wheel](https://pypi.org/project/wheel/#files).

### How do I install a file (package) from PyPI?

To learn how to install a file from PyPI, visit the [installation tutorial](https://packaging.python.org/tutorials/installing-packages/ "External link") on the [Python Packaging User Guide](https://packaging.python.org/ "External link").

### How do I package and publish my code for PyPI?

For full instructions on configuring, packaging and distributing your Python project, refer to the [packaging tutorial](https://packaging.python.org/distributing/ "External link") on the [Python Packaging User Guide](https://packaging.python.org "External link").

### What's a trove classifier?

Classifiers are used to categorize projects on PyPI. See [the classifiers page](/classifiers/) for more information, as well as a list of valid classifiers.

### What's a "yanked" release?

A yanked release is a release that is always ignored by an installer, unless it is the only release that matches a version specifier (using either `==` or `===`). See [the user documentation](https://docs.pypi.org/project-management/yanking) for more information, including how to yank a release.

### What's an archived project?

An archived project is a project that is no longer receiving any updates. A project maintainer can mark a project as archived to signal to users that future updates should not be expected. Archived projects are publicly visible and can still be resolved from the index by default, unlike deleted or [yanked](https://docs.pypi.org/project-management/yanking) releases. An archived project cannot make new releases and will not appear in PyPI's search results.

### What is a pre-release?

A pre-release is a version of a package that is not yet considered stable for general use. Pre-releases are typically labelled with suffixes such as `a` (alpha), `b` (beta), or `rc` (release candidate) — for example, `1.0a1` or `2.3rc2`. By default, installers such as pip will not install pre-release versions unless explicitly requested.

## My account

### Why do I need a verified email address?

Currently, PyPI requires a verified email address to perform the following operations:

-   Register a new project.
-   Upload a new version or file.

The list of activities that require a verified email address is likely to grow over time.

This policy will allow us to enforce a key policy of [PEP 541](https://www.python.org/dev/peps/pep-0541/ "External link") regarding maintainer reachability. It also reduces the viability of spam attacks to create many accounts in an automated fashion.

You can manage your account's email addresses in your [account settings](/manage/account/). This also allows for sending a new confirmation email for users who signed up in the past, before we began enforcing this policy.

### Why is PyPI telling me my password is compromised?

PyPI itself has not suffered a breach. This is a protective measure to reduce the risk of [credential stuffing](https://www.owasp.org/index.php/Credential_stuffing "External link") attacks against PyPI and its users.

Each time a user supplies a password — while registering, authenticating, or updating their password — PyPI securely checks whether that password has appeared in public data breaches.

During each of these processes, PyPI generates a SHA-1 hash of the supplied password and uses the first five (5) characters of the hash to check the [Have I Been Pwned API](https://haveibeenpwned.com/API/v2#SearchingPwnedPasswordsByRange "External link") and determine if the password has been previously compromised. The plaintext password is never stored by PyPI or submitted to the Have I Been Pwned API.

PyPI will not allow such passwords to be used when setting a password at registration or updating your password.

If you receive an error message saying that "This password appears in a breach or has been compromised and cannot be used", you should change it all other places that you use it as soon as possible.

If you have received this error while attempting to log in or upload to PyPI, then your password has been reset, and you cannot log in to PyPI until you [reset your password](https://pypi.org/account/request-password-reset/).

### What should I do if I notice suspicious activity on my account?

All PyPI user events are stored under security history in account settings. If there are any events that seem suspicious, take the following steps:

-   [Reset your password](https://pypi.org/account/request-password-reset/)
-   Contact the PyPI admins about the event at [admin@pypi.org](mailto:admin@pypi.org)

### Why is PyPI telling me my API token is compromised?

A PyPI API token linked to your account was posted on a public website. It was automatically revoked, but before regenerating a new one, please check the email you received and attempt to determine the cause. The [suspicious activity](#suspicious-activity) section applies too.

### What is two-factor authentication and how does it work on PyPI?

Two-factor authentication (2FA) makes your account more secure by requiring two things in order to log in: _something you know_ and _something you own_.

In PyPI's case, "something you know" is your username and password, while "something you own" can be [an application to generate a temporary code](#totp), or a [security device](#utfkey) (most commonly a USB key).

Two-factor authentication **is required** on your PyPI account.

During the web login process, users will be asked to provide their second method of identity verification.

### How does two-factor authentication with an authentication application (TOTP) work? How do I set it up on PyPI?

PyPI users can set up two-factor authentication using any authentication application that supports the [TOTP standard](https://en.wikipedia.org/wiki/Time-based_One-time_Password_algorithm "External link").

TOTP authentication applications generate a regularly changing authentication code to use when logging into your account.

Because TOTP is an open standard, there are many applications that are compatible with your PyPI account. Popular applications include:

-   Google Authenticator for [Android](https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2 "External link") or [iOS](https://itunes.apple.com/app/google-authenticator/id388497605 "External link")(proprietary)
-   [Microsoft Authenticator](https://www.microsoft.com/en-us/account/authenticator "External link") (proprietary)
-   Duo Mobile for [Android](https://play.google.com/store/apps/details?id=com.duosecurity.duomobile "External link") or [iOS](https://itunes.apple.com/app/duo-mobile/id422663827 "External link")(proprietary)
-   [Authy](https://authy.com/ "External link") (proprietary)
-   [FreeOTP+](https://play.google.com/store/apps/details?id=org.liberty.android.freeotpplus "External link") (open source)
-   [FreeOTP](https://freeotp.github.io/ "External link") (open source)

Some password managers (e.g. [1Password](https://1password.com/ "External link")) can also generate authentication codes. For security reasons, PyPI only allows you to set up one application per account.

**To set up 2FA with an authentication application:**

1.  Open an authentication (TOTP) application
2.  Log in to your PyPI account, go to your account settings, and choose "Add 2FA with authentication application"
3.  PyPI will generate a secret key, specific to your account. This is displayed as a QR code, and as a text code.
4.  Scan the QR code with your authentication application, or type it in manually. The method of input will depend on the application you have chosen.
5.  Your application will generate an authentication code - use this to verify your set-up on PyPI

The PyPI server and your application now share your PyPI secret key, allowing your application to generate valid authentication codes for your PyPI account.

**Next time you log in to PyPI you'll need to:**

1.  Provide your username and password, as normal
2.  Open your authentication application to generate an authentication code
3.  Use this code to finish logging into PyPI

**Note:** If you lose your authentication application and can no longer log in, you may **permanently lose access to your account**. You should generate and securely store [recovery codes](#recoverycodes) to regain access in that event..

We recommend that all PyPI users set up _at least two_ supported two-factor authentication methods and provision [recovery codes](#recoverycodes).

If you've lost access to all two factor methods for your account and do not have [recovery codes](#recoverycodes), you can request help [with account recovery](#account-recovery).

### How does two-factor authentication with a security device (e.g. USB key) work? How do I set it up on PyPI?

A security device is a USB key or [other device](#utfdevices) that generates a one-time password and sends that password to the browser. This password is then used by PyPI to authenticate you as a user.

**To set up two-factor authentication with a _USB key_, you'll need:**

-   To use a [browser that supports WebAuthn and PublicKeyCredential](https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredential#Browser_compatibility "External link"), as this is the standard implemented by PyPI.
-   To be running JavaScript on your browser
-   To use a USB key that adheres to the [FIDO U2F specification](https://fidoalliance.org/specifications/download/ "External link"):
    -   Popular keys include [Yubikey](https://www.yubico.com/ "External link"), [Google Titan](https://cloud.google.com/titan-security-key/ "External link") and [Thetis](https://thetis.io/ "External link").
    -   Note that some older Yubico USB keys **do not follow the FIDO specification**, and will therefore not work with PyPI

Follow these steps:

1.  Log in to your PyPI account, go to your account settings, and choose "Add 2FA with security device (e.g. USB key)"
2.  Give your key a name. This is necessary because it's possible to add more than one security device to your account.
3.  Click on the "Set up security device" button
4.  Insert and touch your USB key, as instructed by your browser

Once complete, your USB key will be registered to your PyPI account and can be used during the log in process.

**Next time you log in to PyPI you'll need to:**

1.  Provide your username and password, as normal
2.  Insert and touch your USB key to finish logging into PyPI

**Note:** If you lose your security device and can no longer log in, you may **permanently lose access to your account**. You should generate and securely store [recovery codes](#recoverycodes) to regain access in that event..

We recommend that all PyPI users set up _at least two_ supported two-factor authentication methods and provision [recovery codes](#recoverycodes).

If you've lost access to all two factor methods for your account and do not have [recovery codes](#recoverycodes), you can request help [with account recovery](#account-recovery).

### What devices (other than a USB key) can I use as a security device?

There is a growing ecosystem of [devices that are FIDO compliant](https://fidoalliance.org/certification/fido-certified-products/ "External link"), and can therefore be used with PyPI.

Emerging solutions include biometric (facial and fingerprint) scanners and FIDO compatible credit cards. There is also growing support for [mobile phones to act as security devices](https://fidoalliance.org/news-your-google-android-7-phone-is-now-a-fido2-security-key/ "External link").

As PyPI's two-factor implementation follows the [WebAuthn standard](https://www.w3.org/TR/webauthn/ "External link"), PyPI users will be able to take advantage of any future developments in this field.

### How does two-factor authentication with a recovery code work? How do I set it up on PyPI?

If you lose access to your [authentication application](#totp) or [security device](#utfkey), you can use these codes to log in to PyPI.

Recovery codes are **one time use**. They are not a substitute for an [authentication application](#totp) or a [security device](#utfkey) and should only be used for recovery. After using a recovery code to sign in, it becomes inactive.

**To provision recovery codes:**

1.  Log in to your PyPI account, go to your account settings, and choose "Generate recovery codes"
2.  Securely store the displayed recovery codes! Consider printing them out and storing them in a safe location or saving them in a password manager.

If you lose access to your stored recovery codes or use all of them, you can get new ones by selecting "Regenerate recovery codes" in your account settings.

**To sign in with a recovery code:**

1.  Provide your username and password, as normal
2.  When prompted for two-factor authentication, select "Login using recovery codes"
3.  As each code can be used only once, you might want to mark the code as used
4.  If you have few recovery codes remaining, you may also want to generate a new set using the "Regenerate recovery codes" button in your account settings.

### How can I use API tokens to authenticate with PyPI?

API tokens are used to authenticate when **uploading packages** to PyPI.

You can create a token for an entire PyPI account, in which case, the token will work for all projects associated with that account. Alternatively, you can limit a token's scope to a specific project.

When using an API token from a CI provider, we recommend scoping the token down to the minimum necessary projects.

**If you are publishing to PyPI from a CI provider that supports [Trusted Publishing](#trusted-publishers), we strongly recommend using Trusted Publishing instead.**

To make an API token:

-   [Verify your email address](#verified-email) (check your [account settings](/manage/account/))
-   In your [account settings](/manage/account/), go to the API tokens section and select "Add API token"

To use an API token:

-   Set your username to `__token__`
-   Set your password to the token value, including the `pypi-` prefix

Where you edit or add these values will depend on your individual use case. For example, some users may need to edit [their `.pypirc` file](https://packaging.python.org/guides/distributing-packages-using-setuptools/#create-an-account "External link"), while others may need to update their CI configuration file (e.g. [`.travis.yml` if you are using Travis](https://docs.travis-ci.com/user/deployment/pypi/ "External link")).

Advanced users may wish to inspect their token by decoding it with base64, and checking the output against the unique identifier displayed on PyPI.

### Why do certain actions require me to confirm my password?

PyPI asks you to confirm your password before you want to perform a _sensitive action_. Sensitive actions include things like adding or removing maintainers, deleting distributions, generating API tokens, and setting up two-factor authentication.

You'll only have to re-confirm your password if it's been more than an hour since you last confirmed it.

**We strongly recommend you only perform such actions on your personal, password-protected computer.**

### How do I change my PyPI username?

PyPI does not currently support changing a username.

Instead, you can create a new account with the desired username, add the new account as a maintainer of all the projects your old account owns, and then delete the old account, which will have the same effect.

### How can I use Trusted Publishers to publish to PyPI?

PyPI users and projects can use [Trusted Publishers](https://docs.pypi.org/trusted-publishers/) to delegate publishing authority for a PyPI package to a trusted third party service, eliminating the need to use API tokens.

## Integrating

### Does PyPI have APIs I can use?

Yes, including RSS feeds of new packages and new releases. [See the API reference.](https://docs.pypi.org/api/ "External link")

### How can I run a mirror of PyPI?

If you need to run your own mirror of PyPI, the [bandersnatch project](https://pypi.org/project/bandersnatch/) is the recommended solution. Note that the storage requirements for a PyPI mirror would exceed 1 terabyte—and growing!

### How do I get notified when a new version of a project is released?

You can subscribe to the [project releases RSS feed](https://docs.pypi.org/api/feeds/#project-releases-feed "External link"). Additionally, there are several third-party services that offer comprehensive monitoring and notifications for project releases and vulnerabilities listed as [GitHub apps](https://github.com/marketplace?category=dependency-management&query=python "External link").

### Where can I see statistics about PyPI, downloads, and project/package usage?

You can analyze PyPI project/package metadata and [download usage statistics](https://packaging.python.org/guides/analyzing-pypi-package-downloads/ "External link") via our public dataset on Google BigQuery.

[Libraries.io provides statistics for PyPI projects](https://libraries.io/pypi "External link") ([example](https://libraries.io/pypi/twine/ "External link"), [API](https://libraries.io/api "External link")) including GitHub stars and forks, dependency tracking ([in progress](https://github.com/librariesio/bibliothecary/issues/415 "External link")), and [other relevant factors](https://docs.libraries.io/overview#sourcerank "External link").

For recent statistics on uptime and performance, see [our status page](https://status.python.org/ "External link").

### What are the file hashes used for, and how can I verify them?

For each package hosted on PyPI, there are corresponding hashes for that file. These hashes can be used to verify that the file you are downloading is the same one that the project maintainer uploaded. This is especially useful if downloading packages from a mirror. The hashes can be obtained from the project page in the "Download Files" section or from the JSON API. Here is an example of generating the hashes:

import hashlib
with open("file-path-to-verify", "rb") as f:
    file\_contents = f.read()
blake2b\_hash = hashlib.blake2b(file\_contents, digest\_size=32).hexdigest()
sha256\_hash = hashlib.sha256(file\_contents).hexdigest()
print(f"BLAKE2b-256: {blake2b\_hash}\\nSHA256: {sha256\_hash}")

In practice, it would only be necessary to verify one of the hashes. It is not recommended to use the MD5 hash because of known security issues with the MD5 algorithm. This hash is provided for backwards compatibility only.

## Administration of projects on PyPI

### How can I publish my private packages to PyPI?

PyPI does not support publishing private packages. If you need to publish your private package to a package index, the recommended solution is to run your own deployment of the [devpi project](https://pypi.org/project/devpi/).

### Why isn't my desired project name available?

Your publishing tool may return an error that your new project can't be created with your desired name, despite no evidence of a project or release of the same name on PyPI. Currently, there are four primary reasons this may occur:

-   The project name conflicts with a [Python Standard Library](https://docs.python.org/3/library/index.html "External link") module from any major version from 2.5 to present.
-   The project name is too similar to an existing project and may be confusable.
-   The project name has been explicitly prohibited by the PyPI administrators. For example, `pip install requirements.txt` is a common typo for `pip install -r requirements.txt`, and should not surprise the user with a malicious package.
-   The project name has been registered by another user, but no releases have been created.See [How do I claim an abandoned or previously registered project name?](#project-name-claim)

### How do I claim an abandoned or previously registered project name?

Follow the ["How to request a name transfer"](https://www.python.org/dev/peps/pep-0541/#how-to-request-a-name-transfer "External link") section of PEP 541.

### What collaborator roles are available for a project on PyPI?

There are two possible roles for collaborators:

**Maintainer:** Can upload releases for a package. Cannot add collaborators. Cannot delete files, releases, or the project.

**Owner:** Can upload releases. Can add other collaborators. Can delete files, releases, or the entire project.

### How do I become an owner/maintainer of a project on PyPI?

Only the current owners of a project have the ability to add new owners or maintainers. If you need to request ownership, you should contact the current owner(s) of the project directly. Many project owners provide their contact details in the 'Author' field of the 'Meta' details on the project page.

If the owner is unresponsive, see [How do I claim an abandoned or previously registered project name?](#project-name-claim)

### How can I upload a project description in a different format?

When using `pyproject.toml` for project metadata, you can use the extension of the `readme` field value to control how PyPI renders your description.

For example, `readme = "README.md"` will render the description as Markdown, while `readme = "README.rst"` will render it as [reStructuredText](https://docutils.sourceforge.io/rst.html "External link")

Refer to the [Python Packaging User Guide](https://packaging.python.org/guides/making-a-pypi-friendly-readme/ "External link") for details on the available formats.

For how to check a description for validity, see also: [Why am I getting "the description failed to render" error?](#description-render-failure)

### How do I get a file size limit exemption or increase for my project?

If you can't upload your project's release to PyPI because you're hitting the upload file size limit (100.0 MiB by default; individual projects may differ), we can sometimes increase your limit.

See the [user documentation](https://docs.pypi.org/project-management/storage-limits/#requesting-a-file-size-limit-increase) for more information on requesting a file size limit increase.

### How do I get a total project size limit exemption or increase for my project?

If you can't upload your project's release to PyPI because you're hitting the project size limit (10.0 GiB by default; individual projects may differ), first [remove any unnecessary releases or individual files](https://docs.pypi.org/project-management/storage-limits/#freeing-up-storage-on-an-existing-project) to lower your overall project size.

If that is not possible, we can sometimes increase your limit. See the [user documentation](https://docs.pypi.org/project-management/storage-limits/#requesting-a-project-size-limit-increase) for more information on requesting a project size limit increase.

### Where does PyPI get its data on project vulnerabilities from, and how can I correct it?

PyPI receives reports on vulnerabilities in the packages hosted on it from the [Open Source Vulnerabilities project](https://osv.dev/ "External link"), which in turn ingests vulnerabilities from the [Python Packaging Advisory Database](https://github.com/pypa/advisory-database "External link").

If you believe vulnerability data for your project is invalid or incorrect, [file an issue](https://github.com/pypa/advisory-database/issues "External link") with details.

### How can I restore a deleted project, release or file?

Deletion of a project, release or file on PyPI is permanent and irreversible, without exception. Deletion of a project makes it uninstallable, and releases the project name for use by any other PyPI user. Deleted files [cannot be re-uploaded](#file-name-reuse). Deleted projects, releases or files cannot be restored by PyPI administrators.

## Troubleshooting

### Why am I getting "the description failed to render" error?

PyPI will reject uploads if the package description fails to render. You may [use twine's check command](https://twine.readthedocs.io/#twine-check "External link") to locally check a description for validity.

### I forgot my PyPI password. Can you help me?

If you've forgotten your PyPI password, but you remember your email address or username, follow these steps to reset your password:

1.  Go to [reset your password](/account/reset-password/).
2.  Enter the email address or username you used for PyPI and submit the form.
3.  You'll receive an email with a password reset link.

**Note:** All users submitting feedback, reporting issues or contributing to Warehouse are expected to follow the [PSF Code of Conduct](https://github.com/pypa/.github/blob/main/CODE_OF_CONDUCT.md "External link").

### I've lost access to my PyPI account. Can you help me?

If you've lost access to your PyPI account or can't fully verify it due to:

-   Lost access to the email address associated with your account
-   Accidentally registered with an email address you cannot verify
-   Lost two-factor authentication [application](#totp), [device](#utfkey), and [recovery codes](#recoverycodes)

You can proceed to [file an issue on our tracker](https://github.com/pypi/support/issues/new?assignees=&labels=account-recovery&template=account-recovery.yml&title=Account+recovery+request "External link") to request assistance with account recovery.

**Note:** All users submitting feedback, reporting issues or contributing to Warehouse are expected to follow the [PSF Code of Conduct](https://github.com/pypa/.github/blob/main/CODE_OF_CONDUCT.md "External link").

### Why am I getting an "Invalid or non-existent authentication information." error when uploading files?

1.  Ensure that your API Token is valid and has not been revoked.
2.  Ensure that your API Token is [properly formatted](#apitoken) and does not contain any trailing characters such as newlines.
3.  Ensure that the username you are using is `__token__`.

Remember that PyPI and TestPyPI each require you to create an account, so your credentials may be different.

If you're using Windows and trying to paste your token in the Command Prompt or PowerShell, note that Ctrl-V and Shift+Insert won't work. Instead, you can use "Edit > Paste" from the window menu, or enable "Use Ctrl+Shift+C/V as Copy/Paste" in "Properties". This is a [known issue](https://bugs.python.org/issue37426 "External link") with Python's `getpass` module.

### Why am I getting "No matching distribution found" or "Could not fetch URL" errors during `pip install`?

Transport Layer Security, or TLS, is part of how we make sure connections between your computer and PyPI are private and secure. It's a cryptographic protocol that's had several versions over time. PyPI [turned off support for TLS versions 1.0 and 1.1](https://mail.python.org/pipermail/python-announce-list/2018-April/011885.html "External link") in April 2018. [Learn why on the PSF blog](https://pyfound.blogspot.com/2017/01/time-to-upgrade-your-python-tls-v12.html "External link").

If you are having trouble with `pip install` and get a `No matching distribution found` or `Could not fetch URL` error, try adding `-v` to the command to get more information:

`pip install --upgrade -v pip`

If you see an error like `There was a problem confirming the ssl certificate` or `tlsv1 alert protocol version` or `TLSV1_ALERT_PROTOCOL_VERSION`, you need to be connecting to PyPI with a newer TLS support library.

The specific steps you need to take will depend on your operating system version, where your installation of Python originated (python.org, your OS vendor, or an intermediate distributor), and the installed versions of Python, `setuptools`, and `pip`.

For help, go to [the `#pypa` IRC channel on Libera](https://web.libera.chat/#pypa "External link"), file an issue at [pypa/packaging-problems/issues](https://github.com/pypa/packaging-problems/issues "External link"), or [discuss on the Discourse](https://discuss.python.org/c/packaging/14 "External link"), including your OS and installation details and the output of `pip install --upgrade -vvv pip`.

**Note:** All users submitting feedback, reporting issues or contributing to Warehouse are expected to follow the [PSF Code of Conduct](https://github.com/pypa/.github/blob/main/CODE_OF_CONDUCT.md "External link").

### I am having trouble using the PyPI website. Can you help me?

We take [accessibility](https://en.wikipedia.org/wiki/Web_accessibility "External link") very seriously and want to make the website easy to use for everyone.

If you are experiencing an accessibility problem, [report it to us on GitHub](https://github.com/pypi/warehouse/issues "External link"), so we can try to fix the problem, for you and others.

**Note:** All users submitting feedback, reporting issues or contributing to Warehouse are expected to follow the [PSF Code of Conduct](https://github.com/pypa/.github/blob/main/CODE_OF_CONDUCT.md "External link").

### Why can't I manually upload files to PyPI, through the browser interface?

In a previous version of PyPI, it used to be possible for maintainers to upload releases to PyPI using a form in the web browser. This feature was deprecated with the new version of PyPI – we instead recommend that you [use twine to upload your project to PyPI](https://packaging.python.org/guides/distributing-packages-using-setuptools/#uploading-your-project-to-pypi "External link").

### Why did my package or user registration get blocked?

Spammers return to PyPI with some regularity hoping to place their Search Engine Optimized phishing, scam, and click-farming content on the site. Since PyPI allows for indexing of the Long Description and other data related to projects and has a generally solid search reputation, it is a prime target.

When the PyPI administrators are overwhelmed by spam **or** determine that there is some other threat to PyPI, new user registration and/or new project registration may be disabled. Check [our status page](https://status.python.org "External link") for more details, as we'll likely have updated it with reasoning for the intervention.

### Why am I getting a "Filename or contents already exists" or "Filename has been previously used" error?

PyPI will return these errors for one of these reasons:

-   Filename has been used and file exists
-   Filename has been used but file no longer exists
-   A file with the exact same content exists

PyPI does not allow for a filename to be reused, even once a project has been deleted and recreated.

A distribution filename on PyPI consists of the combination of project name, version number, and distribution type.

This ensures that a given distribution for a given release for a given project will always resolve to the same file, and cannot be surreptitiously changed one day by the projects maintainer or a malicious party (it can only be removed).

To avoid this situation in most cases, you will need to change the version number to one that you haven't previously uploaded to PyPI, rebuild the distribution, and then upload the new distribution.

### How do I request a new trove classifier?

If you would like to request a new trove classifier file a pull request on the [`pypa/trove-classifiers` project](https://github.com/pypa/trove-classifiers/ "External link"). Be sure to include a brief justification of why it is important.

**Note:** All users submitting feedback, reporting issues or contributing to Warehouse are expected to follow the [PSF Code of Conduct](https://github.com/pypa/.github/blob/main/CODE_OF_CONDUCT.md "External link").

### Where can I report a bug or provide feedback about PyPI?

If you're experiencing an issue with PyPI itself, we welcome **constructive** feedback and bug reports via our [issue tracker](https://github.com/pypi/warehouse/issues "External link"). Please note that this tracker is only for issues with the software that runs PyPI. Before writing a new issue, first check that a similar issue does not already exist.

If you are having an issue is with a specific package installed from PyPI, you should reach out to the maintainers of that project directly instead.

**Note:** All users submitting feedback, reporting issues or contributing to Warehouse are expected to follow the [PSF Code of Conduct](https://github.com/pypa/.github/blob/main/CODE_OF_CONDUCT.md "External link").

### I'm having trouble setting up two factor authentication with an authentication application (TOTP). Can you help me?

If you are having issues while setting up a TOTP device, it may be because your device time is out of sync. Please check that the time on your device is set automatically, and try setting up the device again.

### My project or release says it's in quarantine. What does that mean?

Projects or individual releases may get placed in quarantine for any number of reasons, such as suspicion of malicious activity, spam, or other violations of the [Terms of Service](https://policies.python.org/pypi.org/Terms-of-Service/) or [Acceptable Use Policy](https://policies.python.org/pypi.org/Acceptable-Use-Policy/).

While in quarantine, the project or release is not installable by clients, and cannot be modified by its maintainers. PyPI Administrators will need to review it before it can be restored. When a single release is quarantined, other releases of the same project are unaffected.

If you believe your project or release has mistakenly been flagged for quarantine, contact PyPI via [security@pypi.org](mailto:security@pypi.org) with any details.

## About

### Who maintains PyPI?

PyPI is powered by the Warehouse project; [Warehouse](https://warehouse.pypa.io/ "External link") is an open source project developed under the umbrella of the Python Packaging Authority (PyPA) and supported by the Python Packaging Working Group (PackagingWG).

The [PyPA](https://www.pypa.io/ "External link") is an independent group of developers whose goal is to improve and maintain many of the core projects related to Python packaging.

The [PackagingWG](https://wiki.python.org/psf/PackagingWG "External link") is a working group of the Python Software Foundation (PSF) whose goal is to raise and disburse funds to support the ongoing improvement of Python packaging. Most recently it [secured an award from the Open Technology Fund](https://pyfound.blogspot.com/2019/03/commencing-security-accessibility-and.html "External link") whose funding is enabling developers to improve Warehouse's security and accessibility.

PyPI is powered by [Warehouse](https://warehouse.pypa.io/ "External link") and by a variety of tools and services provided by our [generous sponsors](/sponsors/).

### Can I depend on PyPI being available?

As of April 16, 2018, PyPI.org is at "production" status, meaning that it has moved out of beta and replaced the old site (pypi.python.org). It is now robust, tested, and ready for expected browser and API traffic.

PyPI is heavily cached and distributed via CDN thanks to our sponsor [Fastly](https://www.fastly.com/ "External link") and thus is generally available globally. However, the site is mostly maintained by volunteers, we do not provide any specific Service Level Agreement, and as could be expected for a giant distributed system, things can and sometimes do go wrong. See [our status page](https://status.python.org/ "External link") for current and past outages and incidents. If you have high availability requirements for your package index, consider either a [mirror](#mirroring) or a [private index](#private-indices).

### How can I contribute to PyPI?

We have a huge amount of work to do to continue to maintain and improve PyPI (also known as [the Warehouse project](https://warehouse.pypa.io/ "External link")).

**Financial:** We would deeply appreciate [your donations to fund development and maintenance](https://donate.pypi.org/).

**Development:** Warehouse is open source, and we would love to see some new faces working on the project. You **do not** need to be an experienced open-source developer to make a contribution – in fact, we'd love to help you make your first open source pull request!

If you have skills in Python, Full-Text Search, HTML, SCSS, JavaScript, or SQLAlchemy then skim our ["Getting started" guide](https://warehouse.pypa.io/development/getting-started/ "External link"), then take a look at the [issue tracker](https://github.com/pypi/warehouse/issues "External link"). We've created a ['Good first issue'](https://github.com/pypi/warehouse/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22 "External link") label – we recommend you start here.

Issues are grouped into [milestones](https://github.com/pypi/warehouse/milestones "External link"); working on issues in the current milestone is a great way to help push the project forward. If you're interested in working on a particular issue, leave a comment, and we can guide you through the contribution process.

**Stay updated:** You can also follow the ongoing development of the project on the [Python packaging forum on Discourse](https://discuss.python.org/c/packaging "External link").

**Note:** All users submitting feedback, reporting issues or contributing to Warehouse are expected to follow the [PSF Code of Conduct](https://github.com/pypa/.github/blob/main/CODE_OF_CONDUCT.md "External link").

### How do I keep up with upcoming changes to PyPI?

Changes to PyPI are generally announced on both the [pypi-announce mailing list](https://mail.python.org/mailman3/lists/pypi-announce.python.org/ "External link") and the [PyPI blog](https://blog.pypi.org "External link"). The PyPI blog also has an [RSS](https://blog.pypi.org/feed_rss_created.xml "External link") feed.

### How can I get a list of PyPI's IP addresses?

All traffic is routed through our global CDN, which lists their public IP addresses here: [https://api.fastly.com/public-ip-list](https://api.fastly.com/public-ip-list).

More information about this list can be found here: [https://docs.fastly.com/en/guides/accessing-fastlys-ip-ranges](https://docs.fastly.com/en/guides/accessing-fastlys-ip-ranges).

### What does the "beta feature" badge mean? What are Warehouse's current beta features?

When Warehouse's maintainers are deploying new features, at first we mark them with a small "beta feature" symbol to tell you: this should probably work fine, but it's new and less tested than other site functionality.

Currently, no features are in beta.

### How do I pronounce "PyPI"?

"PyPI" should be pronounced like "pie pea eye", specifically with the "PI" pronounced as individual letters, rather as a single sound. This minimizes confusion with the [PyPy](https://pypy.org/ "External link") project, which is a popular alternative implementation of the Python language.
