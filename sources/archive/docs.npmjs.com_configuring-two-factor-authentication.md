Table of contents

-   [Prerequisites](#prerequisites)
-   -   [Enabling 2FA](#enabling-2fa)
    -   [Disabling 2FA](#disabling-2fa)
-   -   [Enabling 2FA from the command line](#enabling-2fa-from-the-command-line)
    -   [Using 2FA with commands](#using-2fa-with-commands)
    -   [Removing 2FA from the command line](#removing-2fa-from-the-command-line)
-   [Configuring account recovery options](#configuring-account-recovery-options)

You can enable two-factor authentication (2FA) on your npm user account to protect against unauthorized access to your account and packages using a [security-key](https://webauthn.guide/).

**Important:** Publishing to npm requires either:

-   Two-factor authentication (2FA) enabled on your account, OR
-   A granular access token with bypass 2FA enabled

For more information, see the npm documentation on [requiring 2FA for package publishing](/requiring-2fa-for-package-publishing-and-settings-modification).

## [Prerequisites](#prerequisites)

Before you enable 2FA on your npm user account, you must:

-   Update your npm client to version 5.5.1 or higher.
-   To configure a security-key requires a modern browser that support [WebAuthn](https://caniuse.com/#search=webauthn). This will allow you to configure a biometric devices featuring Apple [Touch ID](https://support.apple.com/en-gb/HT204587), [Face ID](https://support.apple.com/en-us/HT208108), or [Windows Hello](https://support.microsoft.com/en-us/windows/learn-about-windows-hello-and-set-it-up-dae28983-8242-bb2a-d3d1-87c9d265a5f0) as well as physical keys such as [Yubikey](https://www.yubico.com/), [Thetis](https://thetis.io/), or [Feitian](https://www.ftsafe.com/).

For more information on supported 2FA methods, see "[About two-factor authentication](/about-two-factor-authentication)".

## [Configuring 2FA from the website](#configuring-2fa-from-the-website)

## [Enabling 2FA](#enabling-2fa)

1.  On the npm "[Sign In](https://www.npmjs.com/login)" page, enter your account details and click **Sign In**. ![Screenshot of npm login dialog](/shared/user-login.png)
2.  In the upper right corner of the page, click your profile picture, then click **Account**. ![Screenshot of account settings selection in user menu](/shared/account-settings.png)
3.  On the account settings page, under "Two-Factor Authentication", click **Enable 2FA**.
    
    ![Screenshot showing Enable 2FA button](/getting-started/setting-up-your-npm-user-account/2fa-enable.png)
4.  When prompted provide your current account password and then click **Confirm password to continue**.
    
5.  On the 2FA method page, select the method you would like to enable and click **Continue**. For more information on supported 2FA methods, see "[About two-factor authentication](/about-two-factor-authentication)".
    
    ![Screenshot showing 2FA types](/getting-started/setting-up-your-npm-user-account/device-selection.png)
6.  Configure your security-key:
    
    -   Provide a name for your security-key and click **Add security key**. Follow the browser specific steps to add your security-key.
    
    ![Screenshot showing security key setup](/getting-started/setting-up-your-npm-user-account/2fa-add-security-key.png)

-   Below is an example of configuration from Microsoft Edge running on a MacOS
    
    ![Screenshot showing 2FA device selection](/getting-started/setting-up-your-npm-user-account/touch-id-mac-edge.png)

7.  On the recovery code page, copy the recovery codes to your computer or other safe location that is not your second factor device. We recommend using a password manager.
    
    ![Screenshot showing the Recovery Code page](/getting-started/setting-up-your-npm-user-account/recovery-code.png)
    
    _Recovery codes are the only way to ensure you can recover your account if you lose access to your second factor device. Each code can be used only once. You can [view and regenerate your recovery code](/recovering-your-2fa-enabled-account#viewing-and-regenerating-recovery-code) from your 2FA settings page. For secondary account recovery options, see "[Configuring account recovery options](/configuring-two-factor-authentication#configuring-account-recovery-options)."_
    
    **Important:** Using a recovery code to log in triggers a temporary 72-hour security hold on your account. During this time, you cannot publish packages, create access tokens, or modify account settings.
    
8.  Click **Go back to settings** after confirming that you have saved your codes.
    

## [Disabling 2FA](#disabling-2fa)

If you have 2FA enabled, you can remove it from your account settings page.

**Note:** You cannot remove 2FA if you are a member of an organization that enforces 2FA. You can view the list of organizations memberships from your profile page under the "Organizations" tab.

1.  On the npm "[Sign In](https://www.npmjs.com/login)" page, enter your account details and click **Sign In**. ![Screenshot of npm login dialog](/shared/user-login.png)
2.  In the upper right corner of the page, click your profile picture, then click **Account**. ![Screenshot of account settings selection in user menu](/shared/account-settings.png)
3.  On the account settings page, under "Two-Factor Authentication", click **Modify 2FA**.
    
    ![Screenshot showing Modify 2FA button](/getting-started/setting-up-your-npm-user-account/2fa-modify.png)
4.  Scroll to the bottom of the "Manage Two-Factor Authentication" page and click Disable 2FA.
    
    ![Screenshot showing Disable 2FA button](/getting-started/setting-up-your-npm-user-account/2fa-disable.png)
5.  Agree to the prompt from the browser.
    

## [Configuring 2FA from the command line](#configuring-2fa-from-the-command-line)

## [Enabling 2FA from the command line](#enabling-2fa-from-the-command-line)

Security-key with WebAuthn can be used for authentication from both the web and the command line, but it can only be configured from the web.

**Note:** Settings you configure on the command line will also apply to your profile settings on the npm website.

For the best security experience, we recommend configuring 2FA through the web interface where you can set up security-key authentication.

If you need to enable 2FA from the command line:

1.  If you are logged out on the command line, log in using `npm login` command.
    
2.  On the command line, type the [`npm profile`](/cli/profile) command along with the option for the 2FA mode you want to enable:
    
    -   To enable 2FA for authorization and writes, type:
        
        `npm profile enable-2fa auth-and-writes`
    -   To enable 2FA for authorization only, type:
        
        `npm profile enable-2fa auth-only`

## [Using 2FA with commands](#using-2fa-with-commands)

If you have enabled 2FA auth-and-writes, authentication will be handled automatically when using security-keys. For commands that require 2FA, you will be prompted to authenticate with your configured 2FA method.

## [Removing 2FA from the command line](#removing-2fa-from-the-command-line)

1.  If you are logged out on the command line, log in using `npm login` command.
    
2.  On the command line, type the following command:
    
    `npm profile disable-2fa`
3.  When prompted, enter your npm password:
    
    npm password:
    
4.  You will be prompted to authenticate with your configured 2FA method to complete the removal.
    

## [Configuring account recovery options](#configuring-account-recovery-options)

When you enable 2FA on your npm user account, we strongly recommend you link your GitHub account to your npm user account. In the event you lose access to your 2FA device and recovery codes, this linked account can be used to verify your identity and expedite the recovery of your npm account.

1.  On the npm "[Sign In](https://www.npmjs.com/login)" page, enter your account details and click **Sign In**. ![Screenshot of npm login dialog](/shared/user-login.png)
2.  In the upper right corner of the page, click your profile picture, then click **Account**. ![Screenshot of account settings selection in user menu](/shared/account-settings.png)
3.  To [link your GitHub](/managing-your-profile-settings#linking-your-npm-and-github-accounts) account, on the account settings page, under "Linked Accounts & Recovery Option", click **Link with GitHub**.
    
    ![Screenshot showing Link GitHub account button](/getting-started/setting-up-your-npm-user-account/link-github-account.png)
4.  On the authorization page, verify all information looks correct. Then click **Authorize npm account link**.
    

The GitHub account is now linked to your npm account. To remove the link, you can click the **Remove** button next to the account.

## Table of contents

-   [Prerequisites](#prerequisites)
-   -   [Enabling 2FA](#enabling-2fa)
    -   [Disabling 2FA](#disabling-2fa)
-   -   [Enabling 2FA from the command line](#enabling-2fa-from-the-command-line)
    -   [Using 2FA with commands](#using-2fa-with-commands)
    -   [Removing 2FA from the command line](#removing-2fa-from-the-command-line)
-   [Configuring account recovery options](#configuring-account-recovery-options)
