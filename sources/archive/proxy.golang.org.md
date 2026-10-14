Go modules services

# Go Module Mirror, Index, and Checksum Database

The Go team is providing the following services run by Google: a module mirror for accelerating Go module downloads, an index for discovering new modules, and a global go.sum database for authenticating module content.

Since Go 1.13, the go command by default downloads and authenticates modules using the Go module mirror and Go checksum database. See [proxy.golang.org/privacy](privacy) for privacy information about these services and the [go command documentation](https://golang.org/ref/mod#private-module-privacy) for configuration details including how to disable the use of these servers or use different ones. If you depend on non-public modules, see the [documentation for configuring your environment](https://pkg.go.dev/cmd/go#hdr-Configuration_for_downloading_non_public_code).

## Services

[**proxy.golang.org**](https://proxy.golang.org) - a module mirror which implements the [module proxy protocol](https://golang.org/ref/mod#goproxy-protocol). For users downloading large numbers of modules (e.g. for bulk static analysis), the mirror supports a separate endpoint `/cached-only` that instructs the proxy to return only cached content. This will avoid slow downloads, at the cost of possibly missing some rarely-used modules.

`GOPROXY=https://proxy.golang.org/cached-only go mod download golang.org/x/tools@v0.1.0`

[**sum.golang.org**](https://sum.golang.org) - an auditable checksum database which will be used by the go command to authenticate modules. Learn more in the [go command documentation](https://golang.org/ref/mod#checksum-database).

[**index.golang.org**](https://index.golang.org) - an index which serves a feed of new module versions that become available by proxy.golang.org. The feed can be viewed at [https://index.golang.org/index](https://index.golang.org/index). The feed is served as new line delimited JSON, providing the module path (as Path), the module version (as Version), and the time it was first cached by proxy.golang.org (as Timestamp). The list is sorted in chronological order. There are optional parameters:

-   'since': the oldest allowable timestamp (RFC3339 format) for module versions in the returned list. Default is the beginning of time, e.g. [https://index.golang.org/index?since=2019-04-10T19:08:52.997264Z](https://index.golang.org/index?since=2019-04-10T19:08:52.997264Z)
-   'limit': the maximum length of the returned list. Default = 2000, Max = 2000, e.g. [https://index.golang.org/index?limit=10](https://index.golang.org/index?limit=10)
-   'include': by default, the index returns module versions that proxy.golang.org has cached copies. If 'include=all', index.golang.org will return all module versions proxy.golang.org or sum.golang.org ever served. Default = "" e.g. [https://index.golang.org/index?include=all](https://index.golang.org/index?include=all)

If you use the index to download many modules from the module mirror, you will want to use the `/cached-only` endpoint, described above.

## Status: Launched

These services are ready for production use. Please [file issues](https://golang.org/issue/new?title=proxy.golang.org:%20) if you spot them, with the title prefix "proxy.golang.org:" (or "index.golang.org:", or "sum.golang.org:").

## Environment setup

These services can only access publicly available source code. If you depend on private modules, set `GOPRIVATE` to a glob pattern that covers them. See [Module configuration for non-public modules](https://pkg.go.dev/cmd/go#hdr-Configuration_for_downloading_non_public_code) in the go command documentation for more details.

To opt-out of this module mirror, you can turn it off by setting `GOPROXY=direct`

See the [go command documentation](https://golang.org/ref/mod#private-module-privacy) for other configuration details.

## FAQ

### Why is proxy.golang.org sending me so much traffic?

The Go module mirror tries to keep its cache up to date by refreshing recently accessed information before it expires. If your server is seeing too much traffic, we can disable that speculative refresh or work with you to understand the traffic better. Please file a [GitHub issue](https://golang.org/issue/new?title=proxy.golang.org%3A+) or email us at [security@golang.org](mailto:security@golang.org).

### I committed a new change (or released a new version) to a repository, why isn't it showing up when I run `go get -u` or `go list -m --versions`?

In order to improve our services' caching and serving latencies, new versions may not show up right away. If you want new code to be immediately available in the mirror, then first make sure there is a semantically versioned tag for this revision in the underlying source repository. Then explicitly request that version via `go get module@version`. The new version should be available within one minute. Note that if someone requested the version before the tag was pushed, it may take up to 30 minutes for the mirror's cache to expire and fresh data about the version to become available. If the version is still not available after 30 minutes, please [file an issue](https://golang.org/issue/new?title=proxy.golang.org%3A+).

### I removed a bad release from my repository but it still appears in the mirror, what should I do?

Whenever possible, the mirror aims to cache content in order to avoid breaking builds for people that depend on your package, so this bad release may still be available in the mirror even if it is not available at the origin. The same situation applies if you delete your entire repository. We suggest creating a new version and encouraging people to use that one instead.

If you would like to hide versions of a module from the `go` command, as well as [pkg.go.dev](https://pkg.go.dev), you should retract them. Retracting a module version involves adding a [retract directive](https://golang.org/ref/mod#go-mod-file-retract) to your go.mod file and publishing a new version. See the Go blog post [New module changes in Go 1.16](https://go.dev/blog/go116-module-changes#module-retraction) and the [modules reference](https://go.dev/ref/mod#go-mod-file-retract) for details.

### I'm running the go command in an environment that can't use the mirror.

The [go command documentation](https://golang.org/ref/mod#private-module-privacy) describes the configuration details including how to disable the use of these servers or use different ones.

### If I don't set `GOPRIVATE` and request a private module from these services, what leaks?

The proxy and checksum database protocols only send module paths and versions to the remote server. If you request a private module, the mirror will try to download it just as any Go user would and fail in the same way. Information about failed requests isn't published anywhere. The only trace of the request will be in internal logs, which are governed by the [privacy policy](privacy).

### Why did a previously available module become unavailable in the mirror?

[proxy.golang.org](https://proxy.golang.org) does not save all modules forever. There are a number of reasons for this, but one reason is if [proxy.golang.org](https://proxy.golang.org) is not able to detect a suitable license. In this case, only a temporarily cached copy of the module will be made available, and may become unavailable if it is removed from the original source and becomes outdated. The checksums will still remain in the checksum database regardless of whether or not they have become unavailable in the mirror.

### I have discovered a malicious module version in the mirror. Where do I report it?

Following [the security policy](https://golang.org/security#reporting), send an email to [security@golang.org](mailto:security@golang.org) with the word "vulnerability" in the message somewhere.
