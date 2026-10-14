/**
 * Registry governance and incident containment, curated from primary sources and registry
 * source code.
 *
 * Two questions the per-release signals cannot answer. Governance: what stops a malicious
 * package from getting in under a trusted-looking name? Containment: once one is in, what
 * can the registry and its users do about it? Like the baseline, these describe ecosystem
 * rules, not the sampled packages, so they are not part of the trust score. How often the
 * containment tools are actually used is measured separately (withdrawn versions).
 */

import { cite, lastAccessed, type Cite } from "../sources/index.ts";
import type { EcosystemId } from "../types.ts";
import type { BaselineValue } from "./baseline.ts";

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
  sources: Cite[];
}

const f = (
  ecosystem: EcosystemId,
  property: PolicyProperty,
  value: BaselineValue,
  note: string,
  sources: Cite[],
  since?: string,
): PolicyFact => ({ ecosystem, property, value, note, sources, ...(since ? { since } : {}) });

export const POLICIES: PolicyFact[] = [
  // Owned namespaces
  f("maven", "owned_namespaces", "yes", "A groupId must be verified before publishing: a DNS TXT record for the domain, or the code-hosting account for io.github.*.", [
    cite("mavenNamespace", "You can prove domain ownership by adding a DNS TXT record with a value set to the Verification Key we assigned to your namespace request."),
    cite("mavenNamespace", "Sonatype can, in most cases, automatically verify and provision publishing access to a namespace that looks like io.github.<your GitHub username>"),
  ]),
  f("go", "owned_namespaces", "yes", "The module path is a domain or repository path, so whoever controls the domain or repository controls the name.", [
    cite("goModulePath", "The repository root path is the portion of the module path that corresponds to the root directory of the version control repository where the module is developed."),
  ]),
  f("packagist", "owned_namespaces", "yes", "A vendor prefix belongs to the first account to publish under it; nobody else can add packages to it.", [
    cite("packagistVendorHijacking", "Packagist.org reserves vendor name prefixes for the maintainer as soon as they publish a first package. Nobody else can then publish another package with the my-company/ vendor prefix without a maintainer's consent."),
  ]),
  f("npm", "owned_namespaces", "partial", "@scope/ names belong to a user or organisation, but scopes are optional and unscoped names are first come, first served.", [
    cite("npmScopes", "When you sign up for an npm user account or create an organization, you are granted a scope that matches your user or organization name."),
  ]),
  f("pypi", "owned_namespaces", "no", "One flat namespace. Namespace prefixes (PEP 752) are accepted but not deployed.", [
    cite("pep752", "Status: Accepted"),
    cite("pep752", "The current ecosystem lacks a way for projects with many packages to signal a verified pattern of ownership"),
  ]),
  f("crates", "owned_namespaces", "no", "One flat namespace. Namespaced crates (RFC 3243) are accepted but not implemented on crates.io.", [
    cite("rustNamespacesGoal", "Navigate the cross-team design work to get RFC #3243 implemented."),
  ]),
  f("rubygems", "owned_namespaces", "no", "One flat namespace; prefixes are a naming convention only.", [
    cite("rubygemsNameYourGem", "If you're adding functionality to another gem, use a dash."),
  ]),

  // Confusable names blocked
  f("pypi", "confusable_names_blocked", "partial", "A new name is rejected if it matches any existing project after removing . _ - and folding l/i→1 and o→0 (ultranormalize). Other misspellings pass.", [
    cite("pypiUltranormalize", "regexp_replace($1, '(\\.|_|-)', '', 'ig'), '(l|L|i|I)', '1', 'ig' ), '(o|O)', '0', 'ig'"),
    cite("pypiNameCheck", "func.ultranormalize_name(Project.name) == func.ultranormalize_name(name) ) ).first(): raise ProjectNameUnavailableSimilarError(similar_project_name)"),
  ]),
  f("npm", "confusable_names_blocked", "partial", "A new name is rejected if it equals an existing one once punctuation is removed (2017). Other misspellings pass.", [
    cite("npmMonikerRules", "we remove punctuation from its name and compare it to existing package names. If the names are identical without punctuation, we do not allow the package to be created."),
  ]),
  f("crates", "confusable_names_blocked", "partial", "- and _ are equivalent (canon_crate_name), so such variants cannot be registered. A typosquat check runs after publication and only emails the crates.io team.", [
    cite("cratesCanonName", "SELECT replace(lower($1), '-', '_')"),
    cite("cratesCanonIndex", "CREATE UNIQUE INDEX index_crates_name ON crates (canon_crate_name(name));"),
    cite("cratesTyposquat", "Checking new crate for potential typosquatting"),
  ]),
  f("rubygems", "confusable_names_blocked", "partial", "A push is rejected if the name equals an established gem's (≥ 10,000 downloads or released in the last five years) ignoring case, _ and -.", [
    cite("rubygemsGemTypo", "DOWNLOADS_THRESHOLD = 10_000 LAST_RELEASE_TIME = 5.years.ago"),
    cite("rubygemsGemTypo", "regexp_replace(upper(name), '[_-]', '', 'g') = regexp_replace(upper(?), '[_-]', '', 'g')"),
  ]),
  f("packagist", "confusable_names_blocked", "partial", "A package whose vendor is one edit away from an existing vendor with the same package name is rejected if the existing package has ≥ 1M downloads; otherwise the admins are emailed.", [
    cite("packagistTypoValidator", "if (levenshtein($existingVendor, $value->getVendor()) <= 1) {"),
    cite("packagistTypoValidator", "if ($this->downloadManager->getTotalDownloads($existingPackage['id']) >= 1_000_000) {"),
  ]),
  f("go", "confusable_names_blocked", "n/a", "Names are domains and repository paths; there is no registration step.", [
    cite("goModulePath", "A module path should describe both what the module does and where to find it."),
  ]),
  f("maven", "confusable_names_blocked", "n/a", "Names sit under a verified namespace, so confusable names fall under namespace verification.", [
    cite("mavenNamespace", "Before Sonatype can grant you permissions to publish under your requested namespace, we must validate that you own the web domain reflected by your namespace."),
  ]),

  // Uploads scanned
  f("rubygems", "upload_scanning", "yes", "Every upload gets static and dynamic analysis and a risk score; high scores go to manual review. The team reports finding 70–80% of the malware it removes itself.", [
    cite("rubygemsSecurityResponse", "Every gem upload is analyzed using both static and dynamic code analysis, including behavioral checks and metadata review."),
    cite("rubygemsSecurityResponse", "Higher-risk gems are escalated for manual review by a member of our security team."),
    cite("rubygemsSecurityResponse", "our team detects the majority (roughly 70-80%) of malicious packages before they are ever reported to us or the public."),
  ]),
  f("packagist", "upload_scanning", "yes", "Aikido's malware detections are imported and shipped in the metadata Composer reads; Composer 2.10 blocks flagged versions.", [
    cite("packagist2026", "In March 2026, Packagist.org started importing malware detection results from Aikido"),
    cite("packagist2026", "Composer 2.10, introducing a unified dependency policy framework that covers malware-flagged versions"),
  ], "2026-03"),
  f("pypi", "upload_scanning", "partial", "Report-driven: trusted researchers (Observers) report through an API, and admins quarantine projects (hidden from the index, frozen) pending review. Auto-quarantine is proposed.", [
    cite("pypiQuarantine", "I had previously built a new beta API infrastructure to allow Observers to report malicious Projects."),
    cite("pypiQuarantine", "Project is not installable (hidden from simple index) while in quarantine - Project is not modifiable by the project owner while in quarantine"),
  ]),
  f("npm", "upload_scanning", "partial", "Malicious packages are removed and replaced by a '0.0.1-security' holding package, but npm does not document how they are detected.", [
    cite("npmSecurityHolding", '"description": "security holding package"'),
  ]),
  f("crates", "upload_scanning", "partial", "Typosquat checks on new crates alert the team; malicious crates are deleted, their accounts disabled and a RustSec advisory published.", [
    cite("cratesTyposquat", "Checking new crate for potential typosquatting"),
    cite("cratesMalware", "In all cases, the crates were deleted, the user accounts that published them were immediately disabled"),
    cite("cratesMalware", "We will always publish a RustSec advisory when a crate is removed for containing malware."),
  ]),
  f("go", "upload_scanning", "no", "The mirror caches whatever a VCS serves; malicious modules are removed on request.", [
    cite("goProxy", "the mirror aims to cache content in order to avoid breaking builds for people that depend on your package, so this bad release may still be available in the mirror even if it is not available at the origin."),
  ]),
  f("maven", "upload_scanning", "no", "Central validates signatures and metadata on upload but documents no malware analysis; malicious components are removed once reported.", [
    cite("mavenMalwareRemoved", "Upon becoming aware of the issue, we immediately blocked access to those components removed them from the Central Repository"),
  ]),

  // Withdraw, keep lockfiles
  f("pypi", "withdraw_keeps_lockfiles", "yes", "Yank (PEP 592): resolvers skip the release unless it is pinned exactly.", [
    cite("pep592", "Yanking a file allows authors to effectively delete a file, without breaking things for people who have pinned to exactly a specific version."),
  ]),
  f("crates", "withdraw_keeps_lockfiles", "yes", "cargo yank: new resolution skips the version; Cargo.lock keeps using it.", [
    cite("cargoYank", "Yanking only prevents Cargo from selecting this version when resolving dependencies by default. Existing lock files or direct downloads are not affected"),
  ]),
  f("go", "withdraw_keeps_lockfiles", "yes", "A retract directive in a later go.mod hides the version from new resolution; go.mod requirements keep it.", [
    cite("goRetract", "When a module version is retracted, users will not upgrade to it automatically using go get, go mod tidy, or other commands. Builds that depend on retracted versions should continue to work"),
  ]),
  f("npm", "withdraw_keeps_lockfiles", "partial", "npm deprecate only warns; the version still resolves. Hiding it means unpublishing, which also breaks lockfiles.", [
    cite("npmDeprecate", "unpublishing removes a package from the registry entirely, meaning anyone who relied on it will no longer be able to use it, with no warning."),
  ]),
  f("packagist", "withdraw_keeps_lockfiles", "partial", "Soft deletion removes a version from the metadata Composer resolves, keeps a record and can be undone; lockfiles fetch archives from the forge, which the maintainer controls.", [
    cite("packagistImmutable", "Soft-deleted versions are removed from the metadata Composer reads, so Composer can no longer resolve a version that has been pulled, regardless of the reason."),
    cite("packagistImmutable", "Where recovery makes sense, the version shows a Recover button."),
  ], "2026-07"),
  f("rubygems", "withdraw_keeps_lockfiles", "no", "A yank removes the .gem file, so locked installs of it fail.", [
    cite("rubygemsPermadelete", "`gem yank` will remove the .gem file from S3 and our CDN"),
  ]),
  f("maven", "withdraw_keeps_lockfiles", "no", "Nothing can be withdrawn.", [
    cite("mavenImmutable", "Once a component has been released and published to the Central Repository, it cannot be altered."),
  ]),

  // Deletion restricted
  f("npm", "deletion_restricted", "yes", "Unpublishing is allowed within 72 hours, or later only for packages with no dependents, under 300 weekly downloads and one owner.", [
    cite("npmUnpublishPolicy", "you can unpublish anytime within the first 72 hours after publishing."),
    cite("npmUnpublishPolicy", "no other packages in the npm Public Registry depend on it - it had less than 300 downloads over the last week - it has a single owner/maintainer"),
  ]),
  f("crates", "deletion_restricted", "yes", "Deletion is allowed within 72 hours, or later only for crates with one owner, no dependents and few downloads (RFC 3660).", [
    cite("cratesDeletionRfc", "The crate has been published for less than 72 hours"),
    cite("cratesDeletionRfc", "The crate has been downloaded less than 100 times for each month it has been published."),
  ]),
  f("go", "deletion_restricted", "yes", "The mirror and checksum database keep every version; deleting the tag upstream changes nothing.", [
    cite("goProxy", "The same situation applies if you delete your entire repository."),
  ]),
  f("maven", "deletion_restricted", "yes", "Released components can never be changed or deleted.", [
    cite("mavenImmutable", "However you will be unable to change the contents of something that has been pushed to the Central Repository already."),
  ]),
  f("packagist", "deletion_restricted", "partial", "Deletion is now a recoverable soft delete with a public record, but the code lives in the maintainer's repository, which they can delete.", [
    cite("packagistImmutable", "soft-deletions, recoveries, and blocked reference changes all leave a permanent public entry"),
    cite("packagistAbout", "New versions of your package are automatically fetched from tags you create in your VCS repository."),
  ], "2026-07"),
  f("pypi", "deletion_restricted", "no", "Owners can delete files and releases at any time; only the filename can never be reused.", [
    cite("pypiHelpFilenameReuse", "Deletion of a project, release or file on PyPI is permanent and irreversible, without exception."),
  ]),
  f("rubygems", "deletion_restricted", "no", "A yank, possible at any time, deletes the file; only the version number stays taken.", [
    cite("rubygemsPermadelete", "`gem yank` will remove the .gem file from S3 and our CDN"),
    cite("rubygemsPermadelete", "A gem version can not be published twice."),
  ]),

  // Client acts on advisories
  f("packagist", "client_blocks_advisories", "yes", "Composer blocks versions with security advisories during update/require by default (policy.advisories.block); installs from a lockfile are not checked.", [
    cite("composerPolicy", "Defaults to `true`. When `true`, package versions with active security advisories are blocked and cannot be installed during `update`/`require`/`remove`"),
  ]),
  f("npm", "client_blocks_advisories", "partial", "npm install runs an audit by default and reports known vulnerabilities, but installs them.", [
    cite("npmInstallAudit", "Default: true - Type: Boolean When \"true\" submit audit reports alongside the current npm command"),
  ]),
  f("pypi", "client_blocks_advisories", "no", "pip does not check advisories; pip-audit is separate.", [
    cite("pipAudit", "pip-audit is a tool for scanning Python environments for packages with known vulnerabilities."),
  ]),
  f("crates", "client_blocks_advisories", "no", "Cargo does not check advisories; cargo-audit (RustSec) is separate.", [
    cite("rustsec", "cargo audit Scanning Cargo.lock for vulnerabilities"),
  ]),
  f("rubygems", "client_blocks_advisories", "no", "Bundler does not check advisories; bundler-audit is separate.", [
    cite("bundlerAudit", "Checks for vulnerable versions of gems in `Gemfile.lock`."),
  ]),
  f("go", "client_blocks_advisories", "no", "The go command does not check advisories; govulncheck is separate.", [
    cite("govulncheck", "Vulnerability checking is integrated into Go's tools and services, including a new command line tool, govulncheck"),
  ]),
  f("maven", "client_blocks_advisories", "no", "Maven does not check advisories; plugins such as OWASP Dependency-Check are separate.", [
    cite("owaspDependencyCheck", "Dependency-Check is a Software Composition Analysis (SCA) tool suite that identifies project dependencies and checks if there are any known, publicly disclosed, vulnerabilities."),
  ]),
];

/** When every value was last checked: the newest access date among its archived sources. */
export const POLICIES_VERIFIED = lastAccessed(POLICIES.flatMap((f) => f.sources));

export function policyOf(ecosystem: EcosystemId, property: PolicyProperty): PolicyFact {
  const fact = POLICIES.find((p) => p.ecosystem === ecosystem && p.property === property);
  if (!fact) throw new Error(`no policy fact for ${ecosystem}/${property}`);
  return fact;
}
