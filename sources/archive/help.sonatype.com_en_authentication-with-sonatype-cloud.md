-   [Sonatype Help](index-en.html)
-   [Sonatype Platform Overview](sonatype-product-overview.html)
-   [Sonatype Cloud](sonatype-cloud.html)
-   Authentication with Sonatype Cloud

Sonatype's Cloud solutions support many Auth0-compatible protocols. Multi-factor authentication (MFA) may be configured with an authenticator of your choice.

-   **Supported Auth0 protocols**: SAML, OpenID Connect, JSON Web Token, OAuth 2.0, OAuth 1.0a, WS-Federation, and OpenID.
    
-   **Supported MFA authenticators**: Auth, Google Authenticator, Auth0 Guardian, and Microsoft Authenticator
    

The following is needed to set up secure authentication.

1.  New users receive a "Getting Started" email from the Sonatype Team
    
2.  Follow the link to set your password and select the Reset button
    
3.  Log in with your email address (required) and the new password.
    
4.  Scan the QR code using your authenticator app. Use the one-time code and select Continue
    
5.  Invite more users to [add to your team](user-management-with-sonatype-cloud.html "User Management with Sonatype Cloud") to complete your setup.
    

## User Session Timeout

The session timeout is a configuration property in IQ with a default of `30min`, in SaaS we manage it for each tenant.

Property: `sessionTimeout`
