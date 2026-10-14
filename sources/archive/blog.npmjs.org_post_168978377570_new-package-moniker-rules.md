We’ve recently made some changes to how package naming works to better fight typosquatting, and help package authors pick names that stand out.

You might have read our post earlier about [typosquatting on the npm registry](http://blog.npmjs.org/post/163723642530/crossenv-malware-on-the-npm-registry). We responded to this incident with some internal tooling that identifies new packages with names similar to existing ones. We’ve been reviewing these by hand and taking action in a few cases. Some trends we have noticed in these packages led us to believe that we can encourage package naming that better suits the needs of both registry users and package authors. Specifically, you can no longer publish packages that differ from existing packages in punctuation only.

Package names can include punctuation like dots, dashes, and underscores (`.`, `-`, `_`). Punctuation can make package names readable! For example `react-native` is a more readable name than `reactnative` would be. However, many typosquat names either accidentally or on purpose use punctuation differences to sneak through. For example, until this change it was possible to typosquat `react-native` by publishing `reactnative`. Under our new naming rules, however, this is disallowed.

Read on for details about the change.

## The new rules

If you are publishing a new package—that is, a package that has not been in the registry before—we remove punctuation from its name and compare it to existing package names. If the names are identical without punctuation, we do not allow the package to be created. Instead, we suggest that you publish the package with that name under your own scope. You can, of course, also find a new name that’s sufficiently different from an existing package, but using your own scope is a fast way to do that.

Here are some examples of how this comparison works.

Because `react-native` exists, no one can publish variations like:

-   `reactnative`
-   `react_native`
-   `react.native`

Similarly, because `jsonstream` exists, no one can publish variations like:

-   `json-stream`
-   `json.stream`
-   `json_stream`
-   `js-on-stream`

## Use a scope!

If you are prevented from publishing a package with a name too similar to an existing package, the easiest way to find a unique name is to use your _scope_. You can scope packages to your npm account by putting `@` + your npm user name in front of the name. For example, my npm user name is `ceejbot`, so my scope is `@ceejbot`.

Publishing public packages to your own scope is free for everyone! Here’s how to do it:

Here I have been told that `json-stream` is too similar to an existing package, so I need to find a new name. First, I edit my `package.json` to add my npm user name as a scope:

```
{
    "name": "json-stream"
}
```

becomes

\`{
    "name": "@ceejbot/json-stream"
}
\`

Next, I publish the package. Scoped packages default to private, so I pass the flag `--access=public` to make this package public:

```
> npm publish --access=public
+ @ceejbot/json-stream@1.0.0
```

Everyone can publish public scoped packages to the npm registry, but to publish _private_ packages you’ll need a [paid subscription](https://www.npmjs.com/features). For more information on working with scoped packages, check out our [docs](https://docs.npmjs.com/getting-started/scoped-packages).

## A little bit of history

The history of package names in the npm registry is a tale of cautiously-added restrictions over time. In its earliest days, npm allowed packages to have use any url-safe character in their names, including upper and lower case. You can’t create new packages with upper-case letters in the name any more, but packages with upper-case letters in their names are still in the registry and still in use. Package names that differ only in case were our first encounter with accidental typosquatting!

The example most people are likely to encounter is `jsonstream`. The packages [JSONStream](https://www.npmjs.com/package/JSONStream) and [jsonstream](https://www.npmjs.com/package/jsonstream) are different but difficult to distinguish. These packages also cause problems if you are installing them on case-insensitive filesystems, such as the file systems on most OS X computers.

Not every url-safe character is allowed any more. You can use the package [validate-npm-package-name](https://www.npmjs.com/package/validate-npm-package-name) to check if your package name uses allowed characters. You’ll need to do a [search](https://www.npmjs.com/search) of the registry to figure out if the name you’d like is already in use, however.

## Good package names help everyone

We hope this new restriction on names helps package authors pick names that stand out and helps users avoid getting the wrong package by accident. If you have any questions/comments/concerns, shoot us a note at support@npmjs.com or tweet at us [@npm\_support](https://twitter.com/npm_support?lang=en).
