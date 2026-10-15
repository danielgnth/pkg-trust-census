/**
 * Every external source the curated facts rest on, by id. This is the only place a source URL
 * may appear: facts, the report and the docs refer to sources by id (test/sources.test.ts
 * enforces it). `bun run sources` archives each one under sources/ with its access time.
 *
 * A source is a URL, or a command whose output is the evidence (a measurement we ran).
 * Registry API endpoints the adapters read data from are not sources and stay in the adapters.
 */

export type SourceDef = string | { command: string[]; repoPath: string };

export const SOURCES = {
  // PyPI and Python packaging
  pypi2faEnforced: "https://blog.pypi.org/posts/2024-01-01-2fa-enforced/",
  pypiTrustedPublishersLaunch: "https://blog.pypi.org/posts/2023-04-20-introducing-trusted-publishers/",
  pypiAttestationsGa: "https://blog.pypi.org/posts/2024-11-14-pypi-now-supports-digital-attestations/",
  pypiPgpRemoved: "https://blog.pypi.org/posts/2023-05-23-removing-pgp/",
  pypiQuarantine: "https://blog.pypi.org/posts/2024-12-30-quarantine/",
  pypi14Days: "https://blog.pypi.org/posts/2026-07-22-releases-now-reject-new-files-after-14-days/",
  pypiHelpApiToken: "https://pypi.org/help/#apitoken",
  pypiHelpFilenameReuse: "https://pypi.org/help/#file-name-reuse",
  pypiHelp2fa: "https://pypi.org/help/#twofa",
  pypiTrustedPublishersDocs: "https://docs.pypi.org/trusted-publishers/",
  pypiTrustedPublishersAdding: "https://docs.pypi.org/trusted-publishers/adding-a-publisher/",
  pypiUltranormalize: "https://github.com/pypi/warehouse/blob/main/warehouse/migrations/versions/d18d443f89f0_ultranormalize_name_function.py",
  pypiMacaroonService: "https://github.com/pypi/warehouse/blob/main/warehouse/macaroons/services.py",
  pypiNameCheck: "https://github.com/pypi/warehouse/blob/main/warehouse/packaging/services.py",
  pep458: "https://peps.python.org/pep-0458/",
  pep592: "https://peps.python.org/pep-0592/",
  pep740: "https://peps.python.org/pep-0740/",
  pep751: "https://peps.python.org/pep-0751/",
  pep752: "https://peps.python.org/pep-0752/",
  pipPrepare: "https://github.com/pypa/pip/blob/main/src/pip/_internal/operations/prepare.py",
  pipSecureInstalls: "https://pip.pypa.io/en/stable/topics/secure-installs/",
  pipAudit: "https://pypi.org/project/pip-audit/",
  uvPublish: "https://docs.astral.sh/uv/reference/cli/#uv-publish",

  // npm
  npmTrustedPublishingGa: "https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/",
  npmTop100Require2fa: "https://github.blog/2022-02-01-top-100-npm-package-maintainers-require-2fa-additional-security",
  npmTop500Require2fa: "https://github.blog/2022-05-10-enhanced-2fa-experience-for-your-npm-account/",
  npmHighImpact2fa: "https://github.blog/changelog/2022-11-01-high-impact-package-maintainers-now-require-2fa/",
  npmSecureSupplyChainPlan: "https://github.blog/security/supply-chain-security/our-plan-for-a-more-secure-npm-supply-chain/",
  npmBypass2faRestricted: "https://github.blog/changelog/2026-07-31-restricting-npm-bypass-2fa-granular-access-tokens/",
  npmClassicTokensDisabled: "https://github.blog/changelog/2025-11-05-npm-security-update-classic-token-creation-disabled-and-granular-token-changes/",
  npmProvenanceGa: "https://github.blog/changelog/2023-09-26-npm-provenance-general-availability/",
  npmTrustedPublishersDocs: "https://docs.npmjs.com/trusted-publishers",
  npmGeneratingProvenance: "https://docs.npmjs.com/generating-provenance-statements",
  npmProvenanceRepo: "https://github.com/npm/provenance",
  npmVerifyingSignatures: "https://docs.npmjs.com/verifying-registry-signatures",
  npmRegistryKeys: "https://registry.npmjs.org/-/npm/v1/keys",
  npmPackageLock: "https://docs.npmjs.com/cli/configuring-npm/package-lock-json",
  npmAccessTokens: "https://docs.npmjs.com/about-access-tokens",
  npm2fa: "https://docs.npmjs.com/configuring-two-factor-authentication",
  npmScopes: "https://docs.npmjs.com/about-scopes",
  npmUnpublishPolicy: "https://docs.npmjs.com/policies/unpublish",
  npmDeprecate: "https://docs.npmjs.com/deprecating-and-undeprecating-packages-or-package-versions",
  npmInstallAudit: "https://docs.npmjs.com/cli/v11/commands/npm-install#audit",
  npmMonikerRules: "https://blog.npmjs.org/post/168978377570/new-package-moniker-rules",
  npmSecurityHolding: "https://registry.npmjs.org/wesily",
  npm12InstallScripts: "https://github.com/orgs/community/discussions/198547",
  pnpmTrustPolicy: "https://pnpm.io/settings/dependency-resolution#trustpolicy",
  pnpmTrustChecks: "https://github.com/pnpm/pnpm/blob/main/pnpm11/resolving/npm-resolver/src/trustChecks.ts",
  pnpmSignatures: "https://github.com/pnpm/pnpm/blob/main/pnpm11/deps/security/signatures/README.md",
  yarnProvenance: "https://github.com/yarnpkg/berry/blob/master/packages/plugin-npm/sources/npmProvenance.ts",
  bunInstall: "https://bun.sh/docs/cli/install",

  // crates.io and Cargo
  cratesUpdate202507: "https://blog.rust-lang.org/2025/07/11/crates-io-development-update-2025-07",
  cratesUpdate202601: "https://blog.rust-lang.org/2026/01/21/crates-io-development-update",
  cratesTokens: "https://blog.rust-lang.org/2023/06/23/improved-api-tokens-for-crates-io/",
  cratesMalware: "https://blog.rust-lang.org/2026/02/13/crates.io-malicious-crate-update",
  cratesTrustedPublishingRfc: "https://rust-lang.github.io/rfcs/3691-trusted-publishing-cratesio.html",
  cratesDeletionRfc: "https://rust-lang.github.io/rfcs/3660-crates-io-crate-deletions.html",
  cratesCanonName: "https://github.com/rust-lang/crates.io/blob/main/migrations/20150319224700_dumped_migration_93/up.sql",
  cratesCanonIndex: "https://github.com/rust-lang/crates.io/blob/main/migrations/20150319224701_dumped_migration_94/up.sql",
  cratesTyposquat: "https://github.com/rust-lang/crates.io/blob/main/src/worker/jobs/typosquat.rs",
  cargoIndex: "https://doc.rust-lang.org/cargo/reference/registry-index.html",
  cargoDownloadVerify: "https://github.com/rust-lang/cargo/blob/master/src/sources/registry/download.rs",
  cargoLockExample: "https://github.com/rust-lang/rustlings/blob/main/Cargo.lock",
  cargoBuildScripts: "https://doc.rust-lang.org/cargo/reference/build-scripts.html",
  cargoYank: "https://doc.rust-lang.org/cargo/commands/cargo-yank.html",
  cargoSigstoreRfc: "https://github.com/rust-lang/rfcs/pull/3403",
  rustTufGoal: "https://rust-lang.github.io/goals/2025h1/verification-and-mirroring.html",
  rustNamespacesGoal: "https://rust-lang.github.io/goals/2026/open-namespaces.html",
  rustsec: "https://rustsec.org/",

  // RubyGems
  rubygemsTrustedPublishing: "https://guides.rubygems.org/trusted-publishing/",
  rubygemsMfaPopular: "https://blog.rubygems.org/2022/08/15/requiring-mfa-on-popular-gems.html",
  rubygemsMfaOptIn: "https://guides.rubygems.org/mfa-requirement-opt-in/",
  rubygemsMfaSetup: "https://guides.rubygems.org/setting-up-multifactor-authentication/",
  rubygemsApiKeyScopes: "https://guides.rubygems.org/api-key-scopes/",
  rubygemsSecurityGuide: "https://guides.rubygems.org/security/",
  rubygemsExtensions: "https://guides.rubygems.org/gems-with-extensions/",
  rubygemsNameYourGem: "https://guides.rubygems.org/name-your-gem/",
  rubygemsPermadelete: "https://blog.rubygems.org/2015/04/13/permadelete-on-yank.html",
  rubygemsDec2024: "https://blog.rubygems.org/2025/01/24/december-rubygems-updates.html",
  rubygemsSecurityResponse: "https://blog.rubygems.org/2025/08/25/rubygems-security-response.html",
  rubygemsPusher: "https://github.com/rubygems/rubygems.org/blob/master/app/models/pusher.rb",
  rubygemsGemTypo: "https://github.com/rubygems/rubygems.org/blob/master/app/models/gem_typo.rb",
  gemPushCommand: "https://github.com/ruby/rubygems/blob/master/lib/rubygems/commands/push_command.rb",
  bundler26: "https://blog.rubygems.org/2024/12/19/bundler-v2-6",
  bundlerEndpointChecksum: "https://github.com/ruby/rubygems/blob/master/lib/bundler/endpoint_specification.rb",
  bundlerChecksumMismatch: "https://github.com/ruby/rubygems/blob/master/lib/bundler/checksum.rb",
  bundlerAudit: "https://github.com/rubysec/bundler-audit",

  // Go
  goSupplyChain: "https://go.dev/blog/supply-chain",
  goModuleMirrorLaunch: "https://go.dev/blog/module-mirror-launch",
  goChecksumDb: "https://go.dev/ref/mod#checksum-database",
  goRetract: "https://go.dev/ref/mod#go-mod-file-retract",
  goModulePath: "https://go.dev/ref/mod#module-path",
  goVcs: "https://go.dev/ref/mod#vcs",
  goSignedNote: "https://pkg.go.dev/golang.org/x/mod/sumdb/note",
  goProxy: "https://proxy.golang.org/",
  govulncheck: "https://go.dev/doc/security/vuln/",

  // Maven Central
  mavenGpgRequirement: "https://central.sonatype.org/publish/requirements/gpg/",
  mavenSigstoreValidation: "https://central.sonatype.org/news/20250128_sigstore_signature_validation_via_portal/",
  mavenPortalApi: "https://central.sonatype.org/publish/publish-portal-api/",
  mavenPortalToken: "https://central.sonatype.org/publish/generate-portal-token/",
  mavenImmutable: "https://central.sonatype.org/faq/can-i-change-a-component/",
  mavenNamespace: "https://central.sonatype.org/register/namespace/",
  sonatypeMfa: "https://help.sonatype.com/en/authentication-with-sonatype-cloud.html",
  mavenMalwareRemoved: "https://www.sonatype.com/blog/malware-removed-from-maven-central",
  mavenResolverChecksums: "https://maven.apache.org/resolver/about-checksums.html",
  mavenChecksumFailJira: "https://issues.apache.org/jira/browse/MNG-5728",
  mavenLockfile: "https://github.com/chains-project/maven-lockfile",
  pgpverifyMavenPlugin: "https://www.simplify4u.org/pgpverify-maven-plugin/",
  gradleVerification: "https://docs.gradle.org/current/userguide/dependency_verification.html",
  jdk23AnnotationProcessing: "https://inside.java/2024/06/18/quality-heads-up/",
  owaspDependencyCheck: "https://owasp.org/www-project-dependency-check/",

  // Packagist and Composer
  packagist2026: "https://blog.packagist.com/an-update-on-composer-packagist-supply-chain-security/",
  packagistImmutable: "https://blog.packagist.com/immutable-versions-on-packagist/",
  packagistVendorHijacking: "https://blog.packagist.com/preventing-dependency-hijacking/",
  packagist15Years: "https://blog.packagist.com/15-years-of-packagist-over-200-billion-package-installs/",
  privatePackagistAug2026: "https://blog.packagist.com/whats-new-in-private-packagist-august-2026-update/",
  packagistAbout: "https://packagist.org/about",
  packagistMonologP2: "https://repo.packagist.org/p2/monolog/monolog.json",
  packagistTypoValidator: "https://github.com/composer/packagist/blob/main/src/Validator/TypoSquattersValidator.php",
  composerRepositories: "https://getcomposer.org/doc/05-repositories.md",
  composerLockfile: "https://getcomposer.org/doc/01-basic-usage.md#commit-your-composer-lock-file-to-version-control",
  composerInstall: "https://getcomposer.org/doc/03-cli.md#install-i",
  composerAllowPlugins: "https://getcomposer.org/doc/06-config.md#allow-plugins",
  composerPolicy: "https://getcomposer.org/doc/06-config.md#policy",
  composerScripts: "https://getcomposer.org/doc/articles/scripts.md",

  // Sigstore, GitHub, standards
  sigstoreTrustedRoot: "https://github.com/sigstore/root-signing/blob/main/targets/trusted_root.json",
  sigstorePqc: "https://blog.sigstore.dev/pqc-sigstore/",
  githubOidcJwks: "https://token.actions.githubusercontent.com/.well-known/jwks",
  githubUserKeys: "https://docs.github.com/en/rest/users/keys#list-public-keys-for-a-user",
  github2fa: "https://docs.github.com/en/authentication/securing-your-account-with-two-factor-authentication-2fa/about-two-factor-authentication",
  rfc9980: "https://www.rfc-editor.org/rfc/rfc9980.html",

  // Advisories, package URLs, SBOM
  osvQuerybatch: "https://google.github.io/osv.dev/post-v1-querybatch/",
  osvSchema: "https://ossf.github.io/osv-schema/",
  ghsaDatabase: "https://github.com/github/advisory-database/blob/main/README.md",
  purlSpec: "https://github.com/package-url/purl-spec/blob/main/README.md",
  purlGolangType: "https://github.com/package-url/purl-spec/blob/main/types/golang-definition.json",
  cyclonedxVdr: "https://cyclonedx.org/capabilities/vdr/",

  // Our own measurements
  probePqTls: { command: ["bun", "run", "scripts/probe-pq-tls.ts"], repoPath: "scripts/probe-pq-tls.ts" },
} as const satisfies Record<string, SourceDef>;

export type SourceId = keyof typeof SOURCES;
