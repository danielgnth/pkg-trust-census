/**
 * Registry baseline: ecosystem-level protections that the seven per-release signals do not
 * measure, curated from primary sources (verified 2026-10-13).
 *
 * The trust score asks "can an outsider verify who published this, and from what source?".
 * This table asks the complementary question: "does the default toolchain stop tampering and
 * limit the damage of a bad release?". crates.io scores low on the first and well on the
 * second, so reporting only the score would misrepresent it (docs/methodology.md).
 *
 * Deliberately *not* folded into the score: these describe the ecosystem's defaults, not the
 * sampled packages, and several depend on the client a user happens to run.
 */

import type { EcosystemId } from "../types.ts";

export const BASELINE_PROPERTIES = [
  {
    id: "immutable_versions",
    label: "Immutable versions",
    question: "Once published, can a version's files never be replaced or added to?",
  },
  {
    id: "install_verifies_hash",
    label: "Install checks hash",
    question: "Does the default client check each download against the registry's hash?",
  },
  {
    id: "lockfile_pins_hashes",
    label: "Lockfile pins hashes",
    question: "Does the default lockfile record artifact hashes, so later installs get identical bytes?",
  },
  {
    id: "client_verifies_signature",
    label: "Client checks signature",
    question: "Does the default client check a signature or transparency log, so a compromised registry or mirror is detected?",
  },
  {
    id: "scoped_expiring_tokens",
    label: "Scoped, expiring tokens",
    question: "Can publish credentials be limited to specific packages and made to expire?",
  },
  {
    id: "no_install_code_execution",
    label: "No code at install",
    question: "Does installing or building leave dependency code unexecuted by default?",
  },
] as const;

/** When every baseline value was last checked against its sources. */
export const BASELINE_VERIFIED = "2026-10-13";

export type BaselineProperty = (typeof BASELINE_PROPERTIES)[number]["id"];
export type BaselineValue = "yes" | "partial" | "no" | "n/a";

export interface BaselineFact {
  ecosystem: EcosystemId;
  property: BaselineProperty;
  value: BaselineValue;
  /** When the current value took effect, if recently — the backfill quarters predate it. */
  since?: string;
  note: string;
  sources: string[];
}

const S = {
  goSupplyChain: "https://go.dev/blog/supply-chain",
  goSumdb: "https://go.dev/ref/mod#checksum-database",
  pypi14days: "https://blog.pypi.org/posts/2026-07-22-releases-now-reject-new-files-after-14-days/",
  pypiFilenameReuse: "https://pypi.org/help/#file-name-reuse",
  pipHashes: "https://github.com/pypa/pip/blob/main/src/pip/_internal/operations/prepare.py",
  pipSecure: "https://pip.pypa.io/en/stable/topics/secure-installs/",
  pep751: "https://peps.python.org/pep-0751/",
  pep458: "https://peps.python.org/pep-0458/",
  pypiTokens: "https://pypi.org/help/#apitoken",
  npmUnpublish: "https://docs.npmjs.com/policies/unpublish",
  npmLock: "https://docs.npmjs.com/cli/configuring-npm/package-lock-json",
  npmVerify: "https://docs.npmjs.com/verifying-registry-signatures",
  npmTokens: "https://github.blog/changelog/2025-11-05-npm-security-update-classic-token-creation-disabled-and-granular-token-changes/",
  npm12: "https://github.com/orgs/community/discussions/198547",
  cratesDeletion: "https://rust-lang.github.io/rfcs/3660-crates-io-crate-deletions.html",
  cargoIndex: "https://doc.rust-lang.org/cargo/reference/registry-index.html",
  cargoBuildScripts: "https://doc.rust-lang.org/cargo/reference/build-scripts.html",
  rustTuf: "https://rust-lang.github.io/goals/2025h1/verification-and-mirroring.html",
  cratesTokens: "https://blog.rust-lang.org/2023/06/23/improved-api-tokens-for-crates-io/",
  rubygemsYank: "https://blog.rubygems.org/2015/04/13/permadelete-on-yank.html",
  bundler26: "https://bundler.io/blog/2024/12/19/bundler-v2-6.html",
  rubygemsSecurity: "https://guides.rubygems.org/security/",
  rubygemsKeys: "https://guides.rubygems.org/api-key-scopes/",
  rubygemsExtensions: "https://guides.rubygems.org/gems-with-extensions/",
  mavenImmutable: "https://central.sonatype.org/faq/can-i-change-a-component/",
  mavenChecksums: "https://maven.apache.org/resolver/about-checksums.html",
  mavenChecksumFail: "https://issues.apache.org/jira/browse/MNG-5728",
  mavenLockfile: "https://github.com/chains-project/maven-lockfile",
  mavenPgpVerify: "https://www.simplify4u.org/pgpverify-maven-plugin/",
  mavenTokens: "https://central.sonatype.org/publish/generate-portal-token/",
  jdk23Proc: "https://inside.java/2024/06/18/quality-heads-up/",
  packagist2026: "https://blog.packagist.com/an-update-on-composer-packagist-supply-chain-security/",
  packagistImmutable: "https://blog.packagist.com/immutable-versions-on-packagist/",
  packagistP2: "https://repo.packagist.org/p2/monolog/monolog.json",
  composerLock: "https://getcomposer.org/doc/01-basic-usage.md#commit-your-composer-lock-file-to-version-control",
  composerPlugins: "https://getcomposer.org/doc/06-config.md#allow-plugins",
  composerScripts: "https://getcomposer.org/doc/articles/scripts.md",
};

const f = (
  ecosystem: EcosystemId,
  property: BaselineProperty,
  value: BaselineValue,
  note: string,
  sources: string[],
  since?: string,
): BaselineFact => ({ ecosystem, property, value, note, sources, ...(since ? { since } : {}) });

export const BASELINE: BaselineFact[] = [
  // Immutable versions
  f("pypi", "immutable_versions", "yes", "Filenames can never be reused; new files are rejected on releases older than 14 days (before: any release could gain new files).", [S.pypiFilenameReuse, S.pypi14days], "2026-07"),
  f("npm", "immutable_versions", "yes", "A version number can never be reused, even after unpublishing.", [S.npmUnpublish]),
  f("crates", "immutable_versions", "yes", "Versions are yanked, not replaced; deletion only within 72 h or for barely-used single-owner crates.", [S.cratesDeletion]),
  f("rubygems", "immutable_versions", "yes", "A version cannot be pushed twice, even after it is yanked.", [S.rubygemsYank]),
  f("go", "immutable_versions", "yes", "The proxy and checksum database pin each version's contents; re-tagging upstream changes nothing.", [S.goSupplyChain]),
  f("maven", "immutable_versions", "yes", "Released components can never be changed or deleted.", [S.mavenImmutable]),
  f("packagist", "immutable_versions", "yes", "Stable versions keep their original commit when the tag is moved upstream; dev branches stay mutable. Archives are still generated by the forge, so bytes may differ for the same commit.", [S.packagistImmutable, S.packagist2026], "2026-07"),

  // Install checks hash
  f("pypi", "install_verifies_hash", "yes", "pip checks each file against the sha256 the index lists for it, without needing --require-hashes.", [S.pipHashes]),
  f("npm", "install_verifies_hash", "yes", "Tarballs are checked against dist.integrity.", [S.npmLock]),
  f("crates", "install_verifies_hash", "yes", "Cargo checks every .crate against the index's sha256 (cksum).", [S.cargoIndex]),
  f("rubygems", "install_verifies_hash", "yes", "Bundler validates gems against the compact index's checksums.", [S.bundler26]),
  f("go", "install_verifies_hash", "yes", "Every module is checked against go.sum and the checksum database.", [S.goSumdb]),
  f("maven", "install_verifies_hash", "partial", "Maven 3 checks .sha1 files but only warns on mismatch by default; Maven 4 fails. The checksums come from the same server as the artifact.", [S.mavenChecksums, S.mavenChecksumFail]),
  f("packagist", "install_verifies_hash", "no", "Packagist publishes an empty dist.shasum for forge-hosted archives, so Composer has nothing to check; the commit in the archive URL is the only pin.", [S.packagistP2]),

  // Lockfile pins hashes
  f("pypi", "lockfile_pins_hashes", "partial", "pip has no default lockfile; PEP 751 pylock.toml (2025) and tools like uv and Poetry record hashes.", [S.pep751]),
  f("npm", "lockfile_pins_hashes", "yes", "package-lock.json records each package's integrity hash.", [S.npmLock]),
  f("crates", "lockfile_pins_hashes", "yes", "Cargo.lock records each crate's checksum.", [S.cargoIndex]),
  f("rubygems", "lockfile_pins_hashes", "partial", "Gemfile.lock CHECKSUMS since Bundler 2.6, opt-in (bundle lock --add-checksums).", [S.bundler26]),
  f("go", "lockfile_pins_hashes", "yes", "go.sum records each module's hash.", [S.goSupplyChain]),
  f("maven", "lockfile_pins_hashes", "no", "Maven has no lockfile; third-party plugins exist.", [S.mavenLockfile]),
  f("packagist", "lockfile_pins_hashes", "partial", "composer.lock pins the commit, but the archive hash is empty for forge-hosted packages.", [S.composerLock, S.packagistP2]),

  // Client checks signature
  f("pypi", "client_verifies_signature", "no", "PEP 458 (TUF-signed index) is not deployed; PEP 740 attestations are not verified by pip.", [S.pep458]),
  f("npm", "client_verifies_signature", "no", "Registry signatures are checked only by an explicit `npm audit signatures`.", [S.npmVerify]),
  f("crates", "client_verifies_signature", "no", "The index is not signed; TUF signing is an open Rust project goal.", [S.rustTuf]),
  f("rubygems", "client_verifies_signature", "no", "Signed-gem verification is opt-in (gem install -P MediumSecurity); signing is rarely used.", [S.rubygemsSecurity]),
  f("go", "client_verifies_signature", "yes", "The go command checks every module against the signed sum.golang.org log by default.", [S.goSumdb]),
  f("maven", "client_verifies_signature", "no", "Maven does not check PGP signatures; a plugin is needed.", [S.mavenPgpVerify]),
  f("packagist", "client_verifies_signature", "no", "There is nothing signed to check.", [S.packagist2026]),

  // Scoped, expiring tokens
  f("pypi", "scoped_expiring_tokens", "partial", "API tokens can be scoped to one project but never expire (trusted publishing tokens do).", [S.pypiTokens]),
  f("npm", "scoped_expiring_tokens", "yes", "Granular tokens only; write tokens expire after at most 90 days, classic tokens were revoked.", [S.npmTokens], "2025-11"),
  f("crates", "scoped_expiring_tokens", "yes", "Tokens can be scoped by endpoint and crate, with an optional expiry.", [S.cratesTokens]),
  f("rubygems", "scoped_expiring_tokens", "yes", "API keys have per-action and per-gem scopes, with an optional expiry.", [S.rubygemsKeys]),
  f("go", "scoped_expiring_tokens", "n/a", "No publish credentials exist.", [S.goSupplyChain]),
  f("maven", "scoped_expiring_tokens", "partial", "User tokens can be given an expiry; no per-namespace scoping is documented.", [S.mavenTokens]),
  f("packagist", "scoped_expiring_tokens", "n/a", "Nothing is uploaded; tokens only trigger re-indexing.", [S.packagist2026]),

  // No code at install
  f("pypi", "no_install_code_execution", "partial", "Wheels run no code; source distributions run their build backend.", [S.pipSecure]),
  f("npm", "no_install_code_execution", "yes", "npm 12 runs no dependency install scripts unless allowed (before: all ran).", [S.npm12], "2026-07"),
  f("crates", "no_install_code_execution", "no", "Dependencies' build scripts and procedural macros run at build time.", [S.cargoBuildScripts]),
  f("rubygems", "no_install_code_execution", "partial", "Pure-Ruby gems run nothing; native extensions run extconf.rb on install.", [S.rubygemsExtensions]),
  f("go", "no_install_code_execution", "yes", "An explicit design goal: neither fetching nor building runs dependency code.", [S.goSupplyChain]),
  f("maven", "no_install_code_execution", "partial", "Dependency jars are not run, but javac ran classpath annotation processors implicitly until JDK 23; build plugins run by the project's choice.", [S.jdk23Proc]),
  f("packagist", "no_install_code_execution", "yes", "Only the root project's scripts run; dependency plugins need explicit allow-plugins (Composer 2.2+).", [S.composerScripts, S.composerPlugins]),
];

export function baselineOf(ecosystem: EcosystemId, property: BaselineProperty): BaselineFact {
  const fact = BASELINE.find((b) => b.ecosystem === ecosystem && b.property === property);
  if (!fact) throw new Error(`no baseline fact for ${ecosystem}/${property}`);
  return fact;
}
