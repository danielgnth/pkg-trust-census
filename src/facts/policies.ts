/**
 * Registry governance and incident containment, curated from primary sources and registry
 * source code (verified 2026-10-13).
 *
 * Two questions the per-release signals cannot answer. Governance: what stops a malicious
 * package from getting in under a trusted-looking name? Containment: once one is in, what
 * can the registry and its users do about it? Like the baseline, these describe ecosystem
 * rules, not the sampled packages, so they are not part of the trust score. How often the
 * containment tools are actually used is measured separately (withdrawn versions).
 */

import type { EcosystemId } from "../types.ts";
import type { BaselineValue } from "./baseline.ts";

export const POLICIES_VERIFIED = "2026-10-13";

export const POLICY_PROPERTIES = [
  {
    id: "owned_namespaces",
    group: "governance",
    label: "Owned namespaces",
    question: "Can a publisher own a name prefix that nobody else can publish into?",
  },
  {
    id: "confusable_names_blocked",
    group: "governance",
    label: "Confusable names blocked",
    question: "Does registration reject a name confusable with an existing package?",
  },
  {
    id: "upload_scanning",
    group: "governance",
    label: "Uploads scanned",
    question: "Are new uploads analysed for malware automatically, by the registry or a feed it acts on?",
  },
  {
    id: "withdraw_keeps_lockfiles",
    group: "containment",
    label: "Withdraw, keep lockfiles",
    question: "Can a version be withdrawn from new resolution while existing lockfiles still install it (yank)?",
  },
  {
    id: "deletion_restricted",
    group: "containment",
    label: "Deletion restricted",
    question: "Are authors prevented from deleting a published version after the fact?",
  },
  {
    id: "client_blocks_advisories",
    group: "containment",
    label: "Client acts on advisories",
    question: "Does the default client warn about or block known-vulnerable versions without extra tools?",
  },
] as const;

export type PolicyProperty = (typeof POLICY_PROPERTIES)[number]["id"];

export interface PolicyFact {
  ecosystem: EcosystemId;
  property: PolicyProperty;
  value: BaselineValue;
  /** When the current value took effect, if recently (YYYY-MM). */
  since?: string;
  note: string;
  sources: string[];
}

const S = {
  mavenNamespace: "https://central.sonatype.org/register/namespace/",
  goModulePath: "https://go.dev/ref/mod#module-path",
  packagistVendor: "https://blog.packagist.com/preventing-dependency-hijacking/",
  npmScopes: "https://docs.npmjs.com/about-scopes",
  pep752: "https://peps.python.org/pep-0752/",
  cratesNamespaces: "https://rust-lang.github.io/goals/2026/open-namespaces.html",
  rubygemsNames: "https://guides.rubygems.org/name-your-gem/",
  pypiUltranormalize: "https://github.com/pypi/warehouse/blob/main/warehouse/migrations/versions/d18d443f89f0_ultranormalize_name_function.py",
  pypiNameCheck: "https://github.com/pypi/warehouse/blob/main/warehouse/packaging/services.py",
  npmMoniker: "https://blog.npmjs.org/post/168978377570/new-package-moniker-rules",
  rubygemsTypo: "https://github.com/rubygems/rubygems.org/blob/master/app/models/gem_typo.rb",
  cratesCanon: "https://github.com/rust-lang/crates.io/blob/main/crates/crates_io_database/src/fns.rs",
  cratesTyposquat: "https://github.com/rust-lang/crates.io/blob/main/src/worker/jobs/typosquat.rs",
  packagistTypo: "https://github.com/composer/packagist/blob/main/src/Validator/TypoSquattersValidator.php",
  rubygemsScanning: "https://blog.rubygems.org/2025/08/25/rubygems-security-response.html",
  packagistAikido: "https://blog.packagist.com/an-update-on-composer-packagist-supply-chain-security/",
  pypiQuarantine: "https://blog.pypi.org/posts/2024-12-30-quarantine/",
  npmHolding: "https://registry.npmjs.org/wesily",
  cratesMalware: "https://blog.rust-lang.org/2026/02/13/crates.io-malicious-crate-update",
  goProxy: "https://proxy.golang.org/",
  mavenMalware: "https://www.sonatype.com/blog/malware-removed-from-maven-central",
  pep592: "https://peps.python.org/pep-0592/",
  cargoYank: "https://doc.rust-lang.org/cargo/commands/cargo-yank.html",
  goRetract: "https://go.dev/ref/mod#go-mod-file-retract",
  npmDeprecate: "https://docs.npmjs.com/deprecating-and-undeprecating-packages-or-package-versions",
  npmUnpublish: "https://docs.npmjs.com/policies/unpublish",
  rubygemsYank: "https://blog.rubygems.org/2015/04/13/permadelete-on-yank.html",
  mavenImmutable: "https://central.sonatype.org/faq/can-i-change-a-component/",
  packagistImmutable: "https://blog.packagist.com/immutable-versions-on-packagist/",
  cratesDeletion: "https://rust-lang.github.io/rfcs/3660-crates-io-crate-deletions.html",
  pypiFileReuse: "https://pypi.org/help/#file-name-reuse",
  composerPolicy: "https://getcomposer.org/doc/06-config.md#policy",
  npmInstallAudit: "https://docs.npmjs.com/cli/v11/commands/npm-install#audit",
  pipAudit: "https://pypi.org/project/pip-audit/",
  cargoAudit: "https://rustsec.org/",
  bundlerAudit: "https://github.com/rubysec/bundler-audit",
  govulncheck: "https://go.dev/doc/security/vuln/",
  dependencyCheck: "https://owasp.org/www-project-dependency-check/",
};

const f = (
  ecosystem: EcosystemId,
  property: PolicyProperty,
  value: BaselineValue,
  note: string,
  sources: string[],
  since?: string,
): PolicyFact => ({ ecosystem, property, value, note, sources, ...(since ? { since } : {}) });

export const POLICIES: PolicyFact[] = [
  // Owned namespaces
  f("maven", "owned_namespaces", "yes", "A groupId must be verified before publishing: a DNS TXT record for the domain, or the code-hosting account for io.github.*.", [S.mavenNamespace]),
  f("go", "owned_namespaces", "yes", "The module path is a domain or repository path, so whoever controls the domain or repository controls the name.", [S.goModulePath]),
  f("packagist", "owned_namespaces", "yes", "A vendor prefix belongs to the first account to publish under it; nobody else can add packages to it.", [S.packagistVendor]),
  f("npm", "owned_namespaces", "partial", "@scope/ names belong to a user or organisation, but scopes are optional and unscoped names are first come, first served.", [S.npmScopes]),
  f("pypi", "owned_namespaces", "no", "One flat namespace. Namespace prefixes are proposed (PEP 752), not deployed.", [S.pep752]),
  f("crates", "owned_namespaces", "no", "One flat namespace. Namespaced crates (RFC 3243) are accepted but not implemented on crates.io.", [S.cratesNamespaces]),
  f("rubygems", "owned_namespaces", "no", "One flat namespace.", [S.rubygemsNames]),

  // Confusable names blocked
  f("pypi", "confusable_names_blocked", "partial", "A new name is rejected if it matches any existing project after removing . _ - and folding l/i→1 and o→0 (ultranormalize). Other misspellings pass.", [S.pypiUltranormalize, S.pypiNameCheck]),
  f("npm", "confusable_names_blocked", "partial", "A new name is rejected if it equals an existing one once punctuation is removed (2017). Other misspellings pass.", [S.npmMoniker]),
  f("crates", "confusable_names_blocked", "partial", "- and _ are equivalent (canon_crate_name), so such variants cannot be registered. A typosquat check runs after publication and only emails the crates.io team.", [S.cratesCanon, S.cratesTyposquat]),
  f("rubygems", "confusable_names_blocked", "partial", "A push is rejected if the name equals an established gem's (≥ 10,000 downloads or released in the last five years) ignoring case, _ and -.", [S.rubygemsTypo]),
  f("packagist", "confusable_names_blocked", "partial", "A package whose vendor is one edit away from an existing vendor with the same package name is rejected if the existing package has ≥ 1M downloads; otherwise the admins are emailed.", [S.packagistTypo]),
  f("go", "confusable_names_blocked", "n/a", "Names are domains and repository paths; there is no registration step.", [S.goModulePath]),
  f("maven", "confusable_names_blocked", "n/a", "Names sit under a verified namespace, so confusable names fall under namespace verification.", [S.mavenNamespace]),

  // Uploads scanned
  f("rubygems", "upload_scanning", "yes", "Every upload gets static and dynamic analysis and a risk score; high scores go to manual review. The team reports finding 70–80% of the malware it removes itself.", [S.rubygemsScanning]),
  f("packagist", "upload_scanning", "yes", "Aikido's malware detections are imported and shipped in the metadata Composer reads; Composer 2.10 blocks flagged versions.", [S.packagistAikido], "2026-03"),
  f("pypi", "upload_scanning", "partial", "Report-driven: trusted researchers (Observers) report through an API, and admins quarantine projects (hidden from the index, frozen) pending review. Auto-quarantine is proposed.", [S.pypiQuarantine]),
  f("npm", "upload_scanning", "partial", "Malicious packages are removed and replaced by a '0.0.1-security' holding package, but npm does not document how they are detected.", [S.npmHolding]),
  f("crates", "upload_scanning", "partial", "Typosquat checks on new crates alert the team; malicious crates are deleted, their accounts disabled and a RustSec advisory published.", [S.cratesTyposquat, S.cratesMalware]),
  f("go", "upload_scanning", "no", "The mirror caches whatever a VCS serves; malicious modules are removed on request.", [S.goProxy]),
  f("maven", "upload_scanning", "no", "Central validates signatures and metadata on upload but documents no malware analysis; malicious components are removed once reported.", [S.mavenMalware]),

  // Withdraw, keep lockfiles
  f("pypi", "withdraw_keeps_lockfiles", "yes", "Yank (PEP 592): resolvers skip the release unless it is pinned exactly.", [S.pep592]),
  f("crates", "withdraw_keeps_lockfiles", "yes", "cargo yank: new resolution skips the version; Cargo.lock keeps using it.", [S.cargoYank]),
  f("go", "withdraw_keeps_lockfiles", "yes", "A retract directive in a later go.mod hides the version from new resolution; go.mod requirements keep it.", [S.goRetract]),
  f("npm", "withdraw_keeps_lockfiles", "partial", "npm deprecate only warns; the version still resolves. Hiding it means unpublishing, which also breaks lockfiles.", [S.npmDeprecate, S.npmUnpublish]),
  f("packagist", "withdraw_keeps_lockfiles", "partial", "Soft deletion removes a version from the metadata Composer resolves, keeps a record and can be undone; lockfiles fetch archives from the forge, which the maintainer controls.", [S.packagistImmutable], "2026-07"),
  f("rubygems", "withdraw_keeps_lockfiles", "no", "A yank removes the .gem file, so locked installs of it fail.", [S.rubygemsYank]),
  f("maven", "withdraw_keeps_lockfiles", "no", "Nothing can be withdrawn.", [S.mavenImmutable]),

  // Deletion restricted
  f("npm", "deletion_restricted", "yes", "Unpublishing is allowed within 72 hours, or later only for packages with no dependents, under 300 weekly downloads and one owner.", [S.npmUnpublish]),
  f("crates", "deletion_restricted", "yes", "Deletion is allowed within 72 hours, or later only for crates with one owner, no dependents and few downloads (RFC 3660).", [S.cratesDeletion]),
  f("go", "deletion_restricted", "yes", "The mirror and checksum database keep every version; deleting the tag upstream changes nothing.", [S.goProxy]),
  f("maven", "deletion_restricted", "yes", "Released components can never be changed or deleted.", [S.mavenImmutable]),
  f("packagist", "deletion_restricted", "partial", "Deletion is now a recoverable soft delete with a public record, but the code lives in the maintainer's repository, which they can delete.", [S.packagistImmutable], "2026-07"),
  f("pypi", "deletion_restricted", "no", "Owners can delete files and releases at any time; only the filename can never be reused.", [S.pypiFileReuse]),
  f("rubygems", "deletion_restricted", "no", "A yank, possible at any time, deletes the file; only the version number stays taken.", [S.rubygemsYank]),

  // Client acts on advisories
  f("packagist", "client_blocks_advisories", "yes", "Composer blocks versions with security advisories during update/require by default (policy.advisories.block); installs from a lockfile are not checked.", [S.composerPolicy]),
  f("npm", "client_blocks_advisories", "partial", "npm install runs an audit by default and reports known vulnerabilities, but installs them.", [S.npmInstallAudit]),
  f("pypi", "client_blocks_advisories", "no", "pip does not check advisories; pip-audit is separate.", [S.pipAudit]),
  f("crates", "client_blocks_advisories", "no", "Cargo does not check advisories; cargo-audit (RustSec) is separate.", [S.cargoAudit]),
  f("rubygems", "client_blocks_advisories", "no", "Bundler does not check advisories; bundler-audit is separate.", [S.bundlerAudit]),
  f("go", "client_blocks_advisories", "no", "The go command does not check advisories; govulncheck is separate.", [S.govulncheck]),
  f("maven", "client_blocks_advisories", "no", "Maven does not check advisories; plugins such as OWASP Dependency-Check are separate.", [S.dependencyCheck]),
];

export function policyOf(ecosystem: EcosystemId, property: PolicyProperty): PolicyFact {
  const fact = POLICIES.find((p) => p.ecosystem === ecosystem && p.property === property);
  if (!fact) throw new Error(`no policy fact for ${ecosystem}/${property}`);
  return fact;
}
