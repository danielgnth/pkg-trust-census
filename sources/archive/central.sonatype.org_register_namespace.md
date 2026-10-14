## Choosing a Namespace[⚓︎](#choosing-a-namespace "Permanent link")

If you are new to the Central Portal you will have no verified namespaces and will see a prompt to view instructions for verifying namespaces:

![No Verified Namespaces](../../images/noverifiednamespaces.png)

Important

If you do not see this pop-up **AND** you signed up with **GitHub**, then Sonatype was able to grant you permissions to the namespace associated with your GitHub identity automatically. As part of your GitHub subscription, GitHub provides you with a **github.io** domain that reflects your username and allows you to publish [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages#types-of-github-pages-sites) under that domain. Because of this, Sonatype can, in most cases, automatically verify and provision publishing access to a namespace that looks like **`io.github.<your GitHub username>`**.

If you click the "View Instructions to Verify Namespace" button, your browser will open a new tab showing this documentation.

Before you can publish your components, you must choose a namespace. In the Maven ecosystem, this is also known as a `groupId`, which is one of the three required coordinates to describe any component published to Maven Central, i.e. `groupId`, `artifactId`, `version`. Read about [choosing your coordinates](../../publish/requirements/coordinates/) in our [publishing guide](../../publish/publish-portal-guide/).

Namespaces identify your top-level project or your organization uniquely across all other publishers whose components are hosted on Maven Central.

### Adding a Namespace[⚓︎](#adding-a-namespace "Permanent link")

To add a namespace, click on your username/email address in the top right corner of [https://central.sonatype.com](https://central.sonatype.com). This will open a dropdown menu, where you can click the "View Namespaces" link:

![View Namespaces Link in Dropdown](../../images/viewnamespaces.png)

#### For DNS[⚓︎](#for-dns "Permanent link")

Similar to the [Java package naming convention](https://docs.oracle.com/javase/tutorial/java/package/namingpkgs.html) a namespace can reuse the **domain name system in a reversed manner**. This means that if you are the owner or maintainer of a domain name, you can use any groupId starting with the reverse domain name and as many subsections as you desire.

E.g., if you control _example.com_, you can use any groupId starting with _com.example_ e.g. _com.example.domain_, _com.example.testsupport_ and so on. Other examples are

-   www.springframework.org -> org.springframework
-   subdomain.example.com -> com.example
-   my-domain.com -> com.my-domain

Hint

The groupId should reverse the domain name exactly, even if the domain name contains hyphens or other characters that would result in an invalid Java package name. Hyphens are perfectly acceptable in groupIds, and you would not need to change your Java package name to match it.

#### For Code Hosting Services with Personal groupId[⚓︎](#for-code-hosting-services-with-personal-groupid "Permanent link")

We support a simple verification process for artifacts whose code is hosted in services listed in the table below. If you use one of these services, a simple verification will be required to prove ownership.

For the user `myusername` on each service

**Service**

**Example namespace**

**GitHub**

io.github.myusername

**GitLab**

io.gitlab.myusername

**Gitee**

io.gitee.myusername

**Bitbucket**

io.bitbucket.myusername

You can then click on either button labeled "Add Namespace":

![Publishing Settings - Namespaces](../../images/publishingsettings_namespace.png)

Enter the namespace you've chosen based on the guidance in the previous section and click "Submit":

![Add Namespace](../../images/addnamespace.png)

Your namespace request will be created, but it will start in the "Unverified" state:

![Namespace Added](../../images/verifynamespace.png)

Clicking the "Verify Namespace" button will ask you to confirm whether you're ready for us to verify your namespace (for more information see [Verifying a Namespace](#verifying-a-namespace)):

![Verify Namespace](../../images/verifynamespacepopup.png)

Do not confirm unless you've added a DNS TXT record

Do not proceed with verification unless you have added and verified your DNS TXT record. Doing so will result in namespace verification delays because the NXDOMAIN response is cached, and you'd have to wait until the cache expires for verification to complete successfully.

Clicking "Confirm" will move your request to the "Verification Pending" state:

![Namespace Verification Pending](../../images/namespaceverificationpending.png)

### Verifying a Namespace[⚓︎](#verifying-a-namespace "Permanent link")

#### By DNS[⚓︎](#by-dns "Permanent link")

Before Sonatype can grant you permissions to publish under your requested namespace, we must validate that you own the web domain reflected by your namespace. You can prove domain ownership by adding a DNS TXT record with a value set to the Verification Key we assigned to your namespace request.

Click the clipboard icon next to the Verification Key to copy the value to your computer's clipboard:

![Copy Verification Key to Clipboard](../../images/copyverificationkey.png)

You can then use this value in setting up the DNS TXT record with your DNS registrar or web hosting provider. Please see this [FAQ](../../faq/how-to-set-txt-record/) for instructions on setting up DNS TXT records with popular DNS registrars and hosting providers.

Warning

The automated system checks the _exact_ domain for the namespace for the `TXT` record. For the `com.example` namespace, the registration process checks `example.com`. It does not check `com.example.com`, `maven-central.example.com`, or any other variation that you might find on other services. Please verify that you have set the namespace request on the correct domain _before_ submitting your request. Failure to do so will result in your support request being prioritized lower than those that do.

If you have set up your DNS TXT record correctly, it should only take a few minutes for us to verify your namespace. You can refresh the Namespace page to see if the verification status has changed to "Verified." If verification takes more than a few hours to complete or returns an error, please email [Central Support](mailto:central-support@sonatype.com) and provide as much supporting information as you can (e.g. screenshots, logs, steps to reproduce).

#### By Code Hosting Services[⚓︎](#by-code-hosting-services "Permanent link")

If you want to use a domain linked to a Hosting Service we need you to prove ownership of the account by creating a temporary, public repository with a name having the value set to the Verification Key we assigned to your namespace request.

E.g. if you want to use `io.gitlab.myusername` **you must create a public repository** like this `gitlab.com/myusername/verification-key`.

Click the clipboard icon next to the Verification Key to copy the value to your computer's clipboard:

![Copy Verification Key to Clipboard](../../images/copyverificationkey-hosted-service.png)

The same applies for the other Hosting Services, e.g. if you want to use `io.gitee.myusername` you must create a public repository `gitee.com/myusername/verification-key`.

At the end of the process when your groupId is registered you can simply delete the empty repository. It is only needed during the validation phase.

### Namespaces and Organizations[⚓︎](#namespaces-and-organizations "Permanent link")

An Organization represents a collective entity (company, project team, open-source group) that owns one or more namespaces on Maven Central.

When you create a new namespace, Maven Central will automatically map the namespace to an existing organization if one already exists with the same namespace name. If no organization exists, it will create a new organization with you as the administrator.

For more details, see [the Organizations documentation](../../publish/publish-portal-organizations/).

### Namespace details and actions[⚓︎](#namespace-details-and-actions "Permanent link")

The menu in the top right of the namespace verification card allows you to do certain actions:

![Namespace Menu](../../images/namespacepopupmenu.png)

-   **View ID** - shows you the Verification Key for your namespace request.
-   **Cancel Verification** - cancels the verification process and returns the request to the "Unverified" state.
-   **View History** - views the status of each of your verification requests. If it takes longer than a few minutes for us to verify your namespace, you can use the View History link to see if there were any errors related to our validation process and find out how you can get help: ![Namespace View History](../../images/namespaceviewhistory.png)
-   **View Users** - currently unsupported, but in later releases, the Publisher experience on [https://central.sonatype.com](https://central.sonatype.com) will allow users to invite other users to publish under namespaces they have already verified.
-   **Remove Namespace** - if you change your mind about using this namespace, click this link to delete your request.

### GitHub Namespaces[⚓︎](#github-namespaces "Permanent link")

As mentioned above, if you sign up with a GitHub account, you will automatically receive a verified namespace in the form `io.github.<github username>`. The intent of this is to reduce the effort required in order to publish to Maven Central, by offloading part of the verification process (proof of domain ownership) to GitHub.

Currently, we only support the GitHub username that you used to sign up, so `io.github.<github organization name>` is not available as an automatically registered namespace.

If you log in to your account via GitHub and you do not have an automatically created namespace, please email \[[Central Support](mailto:central-support@sonatype.com) for help.

### Existing OSSRH Namespaces[⚓︎](#existing-ossrh-namespaces "Permanent link")

If you attempt to register a namespace and the registration fails, it might be because you or someone else has already registered that domain via the old OSSRH publishing workflow. In order to ensure that we uphold [the immutability of components published to Maven Central](../../faq/can-i-change-a-component/), we do not allow namespaces to be active for both OSSRH and the new Portal workflow.

As documented below, manually publishing has a slightly different structure for the bundled archive file and publishing via Maven requires a different plugin, so you will need to update your existing build process.

### List of all current publisher users[⚓︎](#list-of-all-current-publisher-users "Permanent link")

1.  Navigate to the [namespaces page](https://central.sonatype.com/publishing/namespaces).
    
2.  Observe the sections labeled as "Central Portal Namespaces" or "OSSRH Namespaces".
    
    -   If "OSSRH Namespaces" section does not exist, there are no OSSRH namespaces associated with your account. If you expect there to be namespaces listed, first verify that they are not associated with a different publisher account, and then contact [Central Support](mailto:central-support@sonatype.com).
3.  Click the menu in the top right of the namespace (three dots).
    
    ![A screenshot of the namespaces page that shows the menu activated by the More Actions button](../../images/namespace-more-actions-button.png)
    
4.  Click "View Users". You will be redirected to a page that will list all the current publisher users of the selected namespace.
    
    ![A screenshot of the list of all current publisher users of a namespace, which displays their usernames and email addressese](../../images/list-all-current-publisher-users-of-a-namespace.png)
    

Info

There are no roles currently available for project management, the only available permissions is `publisher`.
