We are making changes to npm replication APIs to optimize performance and availability. As part of this update, certain endpoints will be deprecated as of **Thursday, May 29, 2025**.

To facilitate a seamless transition, the new endpoints will be available starting **Tuesday, March 18, 2025**, operating in parallel with the existing endpoints. The existing endpoints will be fully deprecated on **Thursday, May 29, 2025**.

During the transition period, you may access the new endpoints by including the `npm-replication-opt-in` header with the value `true` in your requests. This option will be available from **Tuesday, March 18, 2025** until the deprecation date, after which only the new endpoints will be available. Effective **Thursday, May 29, 2025**, the header will be ignored, and all requests will be directed to the new endpoints by default.

This notice is provided to ensure adequate time for necessary updates to replication implementations. We strongly encourage developers to migrate to the new endpoints as early as possible.

## [How to migrate?](#how-to-migrate)

To assist with migration, we have detailed documentation in our [replication API migration community discussion](https://github.com/orgs/community/discussions/152515), outlining alternative approaches for deprecated endpoints when available. This is the go-to place for questions and discussions.

### [Additional support for migration](#additional-support-for-migration)

If you have further questions or need additional assistance, please reach out to our [support team](https://www.npmjs.com/support).

## Subscribe to our developer newsletter

Discover tips, technical guides, and best practices in our biweekly newsletter just for devs.

[

Back to top

](#start-of-content)
