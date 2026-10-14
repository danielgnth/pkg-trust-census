Late last year, in response to an unprecedented series of account takeovers resulting from the compromise of developer accounts without 2FA enabled, we committed to a variety of enhancements to…

May 10, 2022 | Updated June 2, 2022

|

2 minutes

-   Share:
-   [](https://x.com/share?text=Enhanced%202FA%20experience%20for%20your%20npm%20account&url=https%3A%2F%2Fgithub.blog%2Fnews-insights%2Fproduct-news%2Fenhanced-2fa-experience-for-your-npm-account%2F)
-   [](https://www.facebook.com/sharer/sharer.php?t=Enhanced%202FA%20experience%20for%20your%20npm%20account&u=https%3A%2F%2Fgithub.blog%2Fnews-insights%2Fproduct-news%2Fenhanced-2fa-experience-for-your-npm-account%2F)
-   [](https://www.linkedin.com/shareArticle?title=Enhanced%202FA%20experience%20for%20your%20npm%20account&url=https%3A%2F%2Fgithub.blog%2Fnews-insights%2Fproduct-news%2Fenhanced-2fa-experience-for-your-npm-account%2F)

Late last year, in response to an unprecedented series of account takeovers resulting from the compromise of developer accounts without 2FA enabled, we committed to [a variety of enhancements to the npm registry](https://github.blog/2021-12-07-enrolling-npm-publishers-enhanced-login-verification-two-factor-authentication-enforcement/) to make two-factor authentication (2FA) adoption easier for developers. Today, we are launching a public beta for a significantly improved 2FA experience to all npm accounts, including:

-   -   Support for registering multiple second factors, such as security keys, biometric devices, and authentication applications
    -   A new 2FA configuration menu to manage keys and recovery codes
    -   Full CLI support for login and publish capabilities with physical security keys and biometric devices
    -   Ability to view and regenerate recovery codes

![Animation showing sign in process with 2FA for npm.](https://github.blog/wp-content/uploads/2022/05/167610944-f03f09be-1080-4063-b8b9-2636e2355304.gif?resize=1024%2C576)

On February 1, we [enrolled all maintainers of the top-100 npm packages](https://github.blog/2022-02-01-top-100-npm-package-maintainers-require-2fa-additional-security/) into mandatory 2FA. On May 31, we will enroll the next cohort in mandatory 2FA—maintainers of the top-500 packages. The final cohort will be high-impact maintainers of packages with more than one million weekly downloads or 500 dependents later this year.

Prior to enrolling all high-impact maintainers in 2FA, we will:

-   Streamline the process of logging in and publishing with WebAuthn
-   Improve the account recovery process, including more secure forms of identity verification

To learn more about configuring 2FA, see [Configuring two-factor authentication](https://docs.npmjs.com/configuring-two-factor-authentication).  
To learn more about 2FA in general, see [About two-factor authentication](https://docs.npmjs.com/about-two-factor-authentication).  
For questions and comments, open a discussion in our [feedback repository](http://github.com/npm/feedback).

## Written by

 ![Myles Borins](https://avatars1.githubusercontent.com/u/498775?v=4&s=200)

## Related posts

## We do newsletters, too

Discover tips, technical guides, and best practices in our biweekly newsletter just for devs.

Your email address
