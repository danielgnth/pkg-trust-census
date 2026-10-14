_**February 1, 2022**: We’ve updated this post to clarify our phased approach to rolling out 2FA enforcement on the npm registry._

* * *

In December, we [announced](https://github.blog/2021-12-07-enrolling-npm-publishers-enhanced-login-verification-two-factor-authentication-enforcement/) that we were enrolling all npm publishers in enhanced login verification, and we shared ongoing investments we plan to make in the npm registry plus a timeline for rolling out enforced two-factor authentication (2FA) for high-impact packages, which are any packages with more than 1 million weekly downloads or 500 dependents.

Starting today, we are rolling out mandatory 2FA to our first cohort, all maintainers of top-100 npm packages by dependents. Maintainers who do not currently have 2FA enabled will have their web sessions revoked and will need to set up 2FA before they can take specific actions with their accounts, such as changing their email address or adding new maintainers to projects.

Our initial roll out of enhanced login verification occured between December 7, 2021 and January 4, 2022. Based on our findings from this initial phase, we are planning to enroll all npm accounts in enhanced login verification on March 1, 2022. We will be running two brown-out dates prior to launch on February 16 and February 23, where we will temporarily opt-in all accounts for a 24-hour period to ensure there are no surprises when we roll this out permanently for all customers. To learn more about enhanced login verification, [you can visit our documentation](https://docs.npmjs.com/receiving-a-one-time-password-over-email).

In preparation to push for broader adoption of 2FA on npm, we have implemented and shipped a number of security-focused enhancements to improve the experience of using 2FA and managing 2FA for organizations.

-   Customers who have enabled 2FA are likely to use [automation tokens](https://github.blog/changelog/2020-10-02-npm-automation-tokens/) in their CI/CD infrastructure when automating tasks such as publishing a package. To make managing multiple tokens clearer, we now support [naming tokens](https://docs.npmjs.com/creating-and-viewing-access-tokens).
-   Similar to GitHub processes, it is now possible to enforce 2FA at the organization level for npm. On the members page of an organization, you can now click **Enable 2FA Enforcement** to enforce 2FA for all members of the organization. If current members do not have 2FA enabled, they will be removed when you confirm removal.
-   We’ve also made it easier to audit adoption of 2FA in organizations as well. You can now see exactly which organization members have 2FA enabled already and filter the list to audit and prepare for enforcing 2FA in your org.
-   Finally, we’ve improved how members are added to organizations. Previously all members would be automatically added to the `developers` team. Now, you can select a different team to add members to when you send them the invitation.

The next big technological investment for npm is implementing support for [WebAuthn](https://github.blog/2019-08-21-github-supports-webauthn-for-security-keys/) to allow maintainers to use and benefit from strong authentication provided by hardware keys and biometric devices. This is in addition to one-time password (OTP) authentication, which npm currently supports using a variety of available apps. We have a working prototype for registering and using security keys for 2FA for the npm website as well as the CLI. We’ve just finished working on the design for a refresh of our 2FA enrollment and management process and engineering work on the production implementation kicked off this week.

We are committed to improving the security of the JavaScript and broader open source supply chain. As we make progress on larger initiatives like WebAuth and enrolling all high-impact package maintainers in 2FA, we will continue to make smaller iterative improvements in the registry.

If you have any ideas about how we could improve the security of npm, please feel free to start a discussion on [our public feedback repository](https://github.com/npm/feedback/discussions) or [submit a proposal through our RFC process](https://github.com/npm/rfcs). If you haven’t yet enabled 2FA on your personal npm account, [you can follow the instructions in our documentation](https://docs.npmjs.com/configuring-two-factor-authentication) to enroll today and take a step towards helping us secure the JavaScript software supply chain.

## Written by

 ![Myles Borins](https://avatars1.githubusercontent.com/u/498775?v=4&s=200)

## Related posts

## Explore more from GitHub

![Docs](https://github.blog/wp-content/uploads/2024/07/Icon-Circle.svg)

### Docs

Everything you need to master GitHub, all in one place.

[Go to Docs](https://docs.github.com/)

![GitHub](https://github.blog/wp-content/uploads/2024/07/recirculation-github-icon.svg)

### GitHub

Build what’s next on GitHub, the place for anyone from anywhere to build anything.

[Start building](https://github.com/)

![Customer stories](https://github.blog/wp-content/uploads/2024/07/Icon_da43dc.svg)

### Customer stories

Meet the companies and engineering teams that build with GitHub.

[Learn more](https://github.com/customer-stories)

![GitHub Universe 2026](https://github.blog/wp-content/uploads/2025/06/Universe26-Icon.svg)

### GitHub Universe 2026

Join us October 28-29 in San Francisco or online for GitHub Universe, our flagship developer event uniting people, agents, and the world’s code.

[Register now](https://githubuniverse.com/?utm_source=Blog&utm_medium=GitHub&utm_campaign=module_uni_26)
