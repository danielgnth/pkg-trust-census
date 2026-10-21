Search by [![](/img/sponsors/algolia-logo-light.svg?v=1792522907)](https://www.algolia.com/)

## API documentation

-   [Best practices](#best-practices)
-   [Authentication](#authentication)
-   [Listing package names](#list-packages)
    -   [All packages](#list-packages-all)
    -   [By organization](#list-packages-by-organization)
    -   [By type](#list-packages-by-type)
    -   [With additional data](#list-packages-with-fields)
-   [List popular packages](#list-popular-packages)
-   [Searching for packages](#search-packages)
    -   [By tag](#search-packages-by-tag)
    -   [By name](#search-packages-by-name)
    -   [By type](#search-packages-by-type)
-   [Getting package data](#get-package-data)
-   [Get package download stats](#get-package-stats)
-   [List the dependents of a package](#list-dependents)
-   [Track package updates](#track-package-updates)
-   [Get statistics](#get-statistics)
-   [List security advisories](#list-security-advisories)
-   [Create a package](#create-package)
-   [Edit a package](#edit-package)
-   [Update a package](#update-package)

### Best practices when using the Packagist.org API

-   If you do scheduled jobs, **avoid running things at midnight or once an hour at XX:00**. Most people do so and we do see traffic peaks every hour. Pick a "random" time by hand for your cron jobs, or even better (if you can) is to make it run on a really randomized schedule.
-   **Send a User-Agent header** with all your requests including `mailto=you@example.com` so we can reach out to you if we have an issue with the way you use the API. If not you can leave us with no choice but to block IPs which we'd rather not do.
-   If you send requests in parallel, be a good citizen and do a **maximum of 10 concurrent requests**, or up to 20 if you only fetch static files. Huge bursts in requests can cause issues for other regular users so try to spread out the load.
-   Use an **HTTP/2**\-capable client and make sure you enable that, it is much more efficient than reconnecting for every request.

### Authentication

A lot of our API is accessible Anonymously. For API endpoints that require authentication, you can authenticate using either Bearer token authorization or query/request parameters:

-   **Bearer token:** `Authorization: Bearer [username]:[apiToken]` header
-   **Query or request parameters:** `username` and `apiToken` as query or POST parameters

The Bearer token method is recommended as it keeps credentials out of URLs and logs.

You have two API tokens accessible in your [profile page](/profile/). The SAFE one is meant to be used for readonly-style operations and can be leaked without causing too much trouble, so use this if possible when putting it in CI systems etc where it might not remain safe. The MAIN token is required for all API endpoints that are marked UNSAFE.

### Listing package names Anonymous

#### All packages

GET https://packagist.org/packages/list.json
`{   "packageNames": [     "[vendor]/[package]",     ...   ] }`

Working example: `[https://packagist.org/packages/list.json](https://packagist.org/packages/list.json)`

#### List packages by organization

GET https://packagist.org/packages/list.json?vendor=\[vendor\]
`{   "packageNames": [     "[vendor]/[package]",     ...   ] }`

Working example: `[https://packagist.org/packages/list.json?vendor=composer](https://packagist.org/packages/list.json?vendor=composer)`

#### List packages by type

GET https://packagist.org/packages/list.json?type=\[type\]
`{   "packageNames": [     "[vendor]/[package]",     ...   ] }`

Working example: `[https://packagist.org/packages/list.json?type=composer-plugin](https://packagist.org/packages/list.json?type=composer-plugin)`

#### Retrieving additional data if the name is not enough

If you need more than just package names you can additionally request one or more fields to be returned with every package. Currently supported fields are: `repository`, `type`, and `abandoned`.

Note that when requesting fields, the response structure is different.

GET https://packagist.org/packages/list.json?vendor=\[type\]&fields\[\]=type&fields\[\]=repository&fields\[\]=abandoned
`{   "package": {     "[vendor]/[package]": {       "type": "library",       "repository": "https://...",       "abandoned": false|true|string (with advised replacement)     },     ...   } }`

Working example: `[https://packagist.org/packages/list.json?vendor=composer&fields[]=repository&fields[]=type](https://packagist.org/packages/list.json?vendor=composer&fields[]=repository&fields[]=type)`

### List popular packages Anonymous

If you need to retrieve the most popular (this is sorted by downloads over the last week, not overall downloads to ensure we demote formerly-popular packages) packages please use this endpoint to avoid having to request the download stats for all of our 300K+ packages individually. This also includes faver count (github stars + packagist.org favorites) and downloads count. The API is paginated if you need more than 100.

GET https://packagist.org/explore/popular.json?per\_page=100
`{   "packages": [     {       "name": "[vendor]/[package]",       "description": "[description]",       "url": "https://packagist.org/packages/[vendor]/[package]",       "downloads": 123456,       "favers": 123     },     ...   ],   "total": 123456,   "next": "https://packagist.org/explore/popular.json?page=2&per_page=100" }`

Working example: `[https://packagist.org/explore/popular.json?per_page=100](https://packagist.org/explore/popular.json?per_page=100)`

### Searching for packages Anonymous

Search results are paginated and you can change the pagination step by using the per\_page parameter. For example `https://packagist.org/search.json?q=[query]&per_page=5`

#### Search packages by name

GET https://packagist.org/search.json?q=\[query\]
`{   "results" : [     {       "name": "[vendor]/[package]",       "description": "[description]",       "url": "https://packagist.org/packages/[vendor]/[package]",       "repository": [repository url],       "downloads": [number of downloads],       "favers": [number of favers]     },     ...   ],   "total": [number of results],   "next": "https://packagist.org/search.json?q=[query]&page=[next page number]" }`

Working example: `[https://packagist.org/search.json?q=monolog](https://packagist.org/search.json?q=monolog)`

#### Search packages by tag

GET https://packagist.org/search.json?tags=\[tag\]
`{   "results": [     {       "name": "[vendor]/[package]",       "description": "[description]",       "url": "https://packagist.org/packages/[vendor]/[package]",       "repository": "[repository url]",       "downloads": [number of downloads],       "favers": [number of favers]     }     ...   ],   "total": [numbers of results] }`

Working example: `[https://packagist.org/search.json?q=monolog&tags=psr-3](https://packagist.org/search.json?q=monolog&tags=psr-3)`

#### Search packages by type

GET https://packagist.org/search.json?q=\[query\]&type=symfony-bundle
`{   "results" : [     {       "name": "[vendor]/[package]",       "description": "[description]",       "url": "https://packagist.org/packages/[vendor]/[package]",       "repository": [repository url],       "downloads": [number of downloads],       "favers": [number of favers]     },     ...   ],   "total": [number of results],   "next": "https://packagist.org/search.json?q=[query]&page=[next page number]" }`

Working example: `[https://packagist.org/search.json?q=monolog&type=symfony-bundle](https://packagist.org/search.json?q=monolog&type=symfony-bundle)`

### Getting package data Anonymous

#### Using the Composer v2 metadata

This is the preferred way to access the data as it is always up to date, and dumped to static files so it is very efficient on our end.

You can also send `If-Modified-Since` headers to limit your bandwidth usage and cache the files on your end with the proper filemtime set according to our `Last-Modified` header.

There are a few gotchas though with using this method:

-   It only provides you with the package metadata but not information about the maintainers, download stats or github info.
-   It is in a compressed format for efficiency which requires you to use `[Composer\MetadataMinifier\MetadataMinifier::expand($response['packages'][$packageName])](https://github.com/composer/metadata-minifier/blob/main/src/MetadataMinifier.php#L17)` from the [composer/metadata-minifier](https://packagist.org/packages/composer/metadata-minifier) package to restore it to the full data.
-   The `p2/$vendor/$package.json` file contains only tagged releases. If you want to fetch information about branches (i.e. dev versions) you need to download `p2/$vendor/$package~dev.json`.

GET https://repo.packagist.org/p2/\[vendor\]/\[package\].json
`{   "packages": {     "[vendor]/[package]": [       {         "name": "[vendor]/[package],         "description": [description],         "version": "[version1]",         // ...       },       {         "version": "[version2]",         // ...       }       // ...     ]   },   "minified": "composer/2.0" }`

Working examples:

-   For tagged releases: `[https://repo.packagist.org/p2/monolog/monolog.json](https://repo.packagist.org/p2/monolog/monolog.json)`
-   For dev releases: `[https://repo.packagist.org/p2/monolog/monolog~dev.json](https://repo.packagist.org/p2/monolog/monolog~dev.json)`

Looking to remain up to date and know when packages updated? See the [Track package updates](#track-package-updates) API.

#### Using the API

The JSON API for packages gives you all the infos we have including downloads, dependents count, github info, etc. However it is generated dynamically so for performance reason we cache the responses for twelve hours. As such if the static file endpoint described above is enough please use it instead.

GET https://packagist.org/packages/\[vendor\]/\[package\].json
`{   "package": {     "name": "[vendor]/[package],     "description": [description],     "time": [packagist package creation datetime],     "maintainers": [list of maintainers],     "versions": [list of versions and their dependencies, the same data of [composer.json](https://getcomposer.org/doc/01-basic-usage.md#package-versions)]     "type": [package type],     "repository": [repository url],     "downloads": {       "total": [numbers of download],       "monthly": [numbers of download per month],       "daily": [numbers of download per day]     },     "favers": [number of favers]   } }`

Working example: `[https://packagist.org/packages/monolog/monolog.json](https://packagist.org/packages/monolog/monolog.json)`

### Get package download stats Anonymous

If you need complete package information and use [the JSON API](#get-package-by-name) already then please use the `downloads` key to retrieve stats from that response.

However if you are only interested in download stats for a set of package names, you can use the stats endpoint which includes overall download stats + the faver count (github stars + packagist.org favorites):

GET https://packagist.org/packages/\[vendor\]/\[package\]/stats.json
`{   "downloads": {     "total": 100,     "monthly": 10,     "daily": 1   },   "versions": [     "[list of versions]",     "[list of versions]"   ],   "date": "2022-09-15" # stats collection start date }`

Working example: `[https://packagist.org/packages/monolog/monolog/stats.json](https://packagist.org/packages/monolog/monolog/stats.json)`

### List the dependents of a package Anonymous

GET https://packagist.org/packages/\[vendor\]/\[package\]/dependents.json?order\_by=none
`{   "packages": [     "[list of packages requiring this one]"   ],   "next": "[url to fetch the next results, absent once you have reached the end]",   "unordered": "[url of this listing in no particular order]",   "ordered_by_downloads": "[url of this listing with the most installed first]" }`

`requires` narrows the listing to `require` or `require-dev`; it defaults to `all`.

**To fetch every dependent, use `order_by=none` and follow `next` until it is no longer returned.** Always follow the `next` url as it is returned to you, do not construct it yourself.

`order_by=downloads` gives the most installed dependents first. It is for looking at the top of the list rather than walking it, and stops after the first 500.

`order_by=name` has been removed, as it could take seconds to answer on a widely required package. Use `order_by=none` if you were iterating the whole list, or `order_by=downloads` if you wanted the interesting entries first.

Working example: `[https://packagist.org/packages/monolog/monolog/dependents.json?order_by=none](https://packagist.org/packages/monolog/monolog/dependents.json?order_by=none)`

### Track package updates Anonymous

This endpoint provides you with a feed of metadata changes you can poll to know what packages you need to update.

First to initialize this you can poll the API without timestamp to get the most current timestamp, or make your own by using `10000 * time()`:

GET https://packagist.org/metadata/changes.json
`{   "error": "Invalid or missing "since" query parameter, make sure you store the timestamp at the initial point you started mirroring, then send that to begin receiving changes, e.g. https://packagist.org/metadata/changes.json?since=16142636710498 for example.",   "timestamp": 16142636710498 }`

Working example: `[https://packagist.org/metadata/changes.json](https://packagist.org/metadata/changes.json)`

After that, you should store the timestamp for the next time you want to call the API, let's say 10 minutes later you want to know what changed, you call this again but this time you pass the previous timestamp:

GET https://packagist.org/metadata/changes.json?since=16142636710498
`{   "actions": [     {       "type": "update",       "package": "acme/package",       "time": 1614264954     },     {       "type": "update",       "package": "foo/bar~dev",       "time": 1614264951     },     {       "type": "delete",       "package": "acme/gone",       "time": 1614264953     }   ] }`

Working example: `[https://packagist.org/metadata/changes.json?since=17925708440000](https://packagist.org/metadata/changes.json?since=17925708440000)`

In the example above, you receive 3 changes, let's go over what they mean and what you should do to sync these up:

-   `acme/update` was updated (tagged releases of `acme/update`), you can fetch `https://repo.packagist.org/p2/acme/update.json` and should ensure that the `Last-Modified` is AT LEAST (`>=`) equal to the `time` value. If it is older than that, wait a few seconds and retry. Due to internal mirroring delays it may happen that you get a race condition and get an outdated file.
-   `foo/bar~dev` was updated (dev releases of `foo/bar`, you can fetch `https://repo.packagist.org/p2/foo/bar~dev.json` and should ensure that the `Last-Modified` is AT LEAST (`>=`) equal to the `time` value.
-   `acme/gone` was deleted, you can delete it on your end as well, this means both `acme/gone` and `acme/gone~dev` are deleted.

**Warning:** The changes log is kept for up to 24h on our end, so make sure you fetch the API at least once a day or you will get a resync response like the following:

GET https://packagist.org/metadata/changes.json?since=16140636710498
`{   "actions": [     {       "type": "resync",       "package": "*",       "time": 1614264954     }   ] }`

If you get this, you should assume your data is stale and you should revalidate everything (if you cached files using `Last-Modified` headers, you can still keep that and make sure with `If-Modified-Since` requests for every file that it is still up to date).

### Get statistics Anonymous

This endpoint provides basic some statistics.

GET https://packagist.org/statistics.json
`{   "totals": {     "downloads": [numbers of download]   } }`

Working example: `[https://packagist.org/statistics.json](https://packagist.org/statistics.json)`

### List security advisories Anonymous

This endpoint provides a list of security advisories. Either a list of packages as query or request parameter OR a timestamp as updatedSince query parameter needs to be passed.

When querying with a list of packages, known packages will be included in the response with an empty array if they don't have any listed vulnerability. Package names which are not known to have no vulnerability will not be included at all to show that we do not have data on those. Note that [PURL](https://github.com/package-url/purl-spec/blob/main/PURL-SPECIFICATION.rst) package URLs like `pkg:composer/foo/bar` can also be provided to the packages parameter.

GET https://packagist.org/api/security-advisories/?packages\[\]=\[vendor/package\]
`{   "advisories": {     "[vendor]/[package]": [       {         "advisoryId": "[unique id]",         "packageName": "[vendor]/[package]",         "remoteId": "[deprecated, use sources instead]",         "title": "[title]",         "link": "[url to issue disclosure]",         "cve": "[cve if available]",         "affectedVersions": [affected version in form of a composer constraint]",         "source": "[deprecated, use sources instead]",         "sources": [             {                 "name": "[Name of the source where the advisory was found e.g. GitHub or FriendsOfPHP/security-advisories]"                 "remoteId": "[A reference to identify the advisory in the source e.g. the GitHub advisory id]"             }         ],         "reportedAt": "[date the issue was reported]",         "composerRepository": "[composer repository the package can be found in]",         "severity": [severity if available, following the CVSS3 spec]       }     ]   } }`

Working examples:

-   Using one or more package names: `[https://packagist.org/api/security-advisories/?packages[]=monolog/monolog](https://packagist.org/api/security-advisories/?packages[]=monolog/monolog)`
-   Fetching new data / updates: `[https://packagist.org/api/security-advisories/?updatedSince=1791966644](https://packagist.org/api/security-advisories/?updatedSince=1791966644)`

### Create a package Authentication Required

This endpoint creates a package for a specific repo. Only the `POST` method is allowed. The `content-type: application/json` header is required.

This endpoint is considered UNSAFE and requires your main [API token](/profile/) to be used.

POST https://packagist.org/api/create-package {"repository":"\[url\]"}
`{   "status": "success" }`

Working example:  
`curl -X POST -H'Content-Type:application/json' -H'Authorization: Bearer USERNAME:********' 'https://packagist.org/api/create-package' -d '{"repository":"https://github.com/Seldaek/monolog"}'`

### Edit a package Authentication Required

This endpoint allows you to edit a package URL. Only the `PUT` method is allowed. The `content-type: application/json` header is required.

This endpoint is considered UNSAFE and requires your main [API token](/profile/) to be used.

PUT https://packagist.org/api/packages/\[package name\] {"repository":"\[url\]"}
`{   "status": "success" }`

Working example:  
`curl -X PUT -H'Content-Type:application/json' -H'Authorization: Bearer USERNAME:********' 'https://packagist.org/api/packages/monolog/monolog' -d '{"repository":"https://github.com/Seldaek/monolog"}'`

### Update a package Authentication Required

This endpoint updates a package by canonical repository URL or packagist.org package URL. Only the `POST` method is allowed. The `content-type: application/json` header is required.

This endpoint is considered SAFE and allows either your main or safe [API token](/profile/) to be used.

POST https://packagist.org/api/update-package {"repository":"\[url\]"}
`{   "status": "success",   "jobs": ["job-id", ".."] }`

Working examples:  
`curl -X POST -H'Content-Type:application/json' -H'Authorization: Bearer USERNAME:********' 'https://packagist.org/api/update-package' -d '{"repository":"https://github.com/Seldaek/monolog"}'`  
`curl -X POST -H'Content-Type:application/json' -H'Authorization: Bearer USERNAME:********' 'https://packagist.org/api/update-package' -d '{"repository":"https://packagist.org/monolog/monolog"}'`
