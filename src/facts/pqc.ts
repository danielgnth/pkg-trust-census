/**
 * Post-quantum exposure of every cryptographic mechanism in the publish → install chain,
 * per ecosystem (TLS measured with scripts/probe-pq-tls.ts, archived as the probePqTls source).
 *
 * The threat is a cryptographically relevant quantum computer (CRQC). It breaks RSA, ECDSA
 * and EdDSA outright (Shor), so anyone holding a *public* key can then forge signatures with
 * it. Hashes and symmetric secrets only lose half their bits (Grover), which SHA-256 and
 * longer survive. Two timings matter: signatures can only be forged once a CRQC exists, but
 * traffic recorded today under classical key exchange can be decrypted then ("harvest now,
 * decrypt later"), exposing any credential it carried.
 *
 * Like the baseline, this describes ecosystems rather than sampled packages, so it is not
 * part of the trust score.
 */

import { cite, lastAccessed, type Cite } from "../sources/index.ts";
import type { EcosystemId } from "../types.ts";

export const PQC_LAYERS = [
  { id: "install_hash", label: "Install hash", question: "What hash does the default client check or pin a download against?" },
  { id: "publisher_signature", label: "Publisher signature", question: "What signs the artifact on the publisher's side?" },
  { id: "registry_signature", label: "Registry signature", question: "What does the registry or its log sign artifacts or checkpoints with?" },
  { id: "transparency_log", label: "Transparency log", question: "What makes the log's history tamper-evident, and what signs its checkpoints?" },
  { id: "transport", label: "Transport (TLS)", question: "Which TLS key exchange do the install and publish hosts negotiate? Server certificates are classical everywhere." },
  { id: "publish_credential", label: "Publish credential", question: "What authenticates an upload, and can a CRQC forge it from public data?" },
  { id: "mfa", label: "MFA", question: "Which second factors does the registry offer?" },
] as const;

export type PqcLayer = (typeof PQC_LAYERS)[number]["id"];

/**
 * - `safe`: hash ≥ 256 bits or a symmetric secret; a CRQC gains only Grover's square root.
 * - `partial`: a post-quantum part and a classical part (hash-chained log with classical
 *   checkpoint signatures; hybrid TLS key exchange with classical certificates; TOTP next to
 *   WebAuthn).
 * - `vulnerable`: rests on RSA, ECDSA or EdDSA, which a CRQC breaks.
 * - `weak`: already weak without a quantum computer (SHA-1, MD5).
 */
export type PqcStatus = "safe" | "partial" | "vulnerable" | "weak" | "n/a";

export interface PqcFact {
  ecosystem: EcosystemId;
  layer: PqcLayer;
  /** The primitive, short enough for a chart cell. */
  primitive: string;
  status: PqcStatus;
  note: string;
  sources: Cite[];
}

const f = (ecosystem: EcosystemId, layer: PqcLayer, primitive: string, status: PqcStatus, note: string, sources: Cite[]): PqcFact => ({
  ecosystem,
  layer,
  primitive,
  status,
  note,
  sources,
});

/** One Sigstore bundle, as npm, PyPI, RubyGems and Maven Central accept it. */
const SIGSTORE_SIG = "Sigstore bundle: ephemeral ECDSA P-256 key, certified by Fulcio's ECDSA P-384 CA. A CRQC could forge the CA and mint certificates for any identity. A post-quantum (ML-DSA) Sigstore instance is targeted for mid-2027 as a separate, opt-in trust root.";
const REKOR = "Rekor: entries hash-chained in a SHA-256 Merkle tree (post-quantum safe); checkpoints signed with ECDSA P-256 (rekor.sigstore.dev) or Ed25519 (Rekor v2 shards). A CRQC could sign a forked checkpoint, but not rewrite history a verifier already holds a checkpoint for.";
const OIDC = "Trusted publishing trades a CI-issued OIDC token for a short-lived upload token. GitHub's and GitLab's OIDC tokens are RS256: a CRQC could forge one from the published JWKS and publish as any project. Long-lived API tokens are random secrets, which only harvested traffic would expose.";
const GIT_PUSH = "Releases are VCS tags, so publishing is a push to the forge: SSH keys (Ed25519/RSA, whose public halves are listed at github.com/{user}.keys) or HTTPS tokens. A CRQC could derive SSH private keys from those public keys.";

/** Shared citations for the notes above. */
const SIGSTORE_KEYS = [
  cite("sigstoreTrustedRoot", '"keyDetails": "PKIX_ECDSA_P256_SHA_256"'),
  cite("sigstorePqc", "A production-ready PQC public instance is targeted for mid-2027"),
  cite("sigstorePqc", "PQC Sigstore will launch as an entirely separate infrastructure stack, with trust rooted in a new, ML-DSA-signed TUF repository."),
];
const REKOR_KEYS = [
  cite("sigstoreTrustedRoot", '"keyDetails": "PKIX_ECDSA_P256_SHA_256"'),
  cite("sigstoreTrustedRoot", '"keyDetails": "PKIX_ED25519"'),
];
const GITHUB_OIDC = cite("githubOidcJwks", '"alg": "RS256"');
const tls = (line: string) => cite("probePqTls", line);

export const PQC: PqcFact[] = [
  // Install hash
  f("npm", "install_hash", "SHA-512", "safe", "dist.integrity (SRI sha512), recorded in package-lock.json.", [
    cite("npmPackageLock", "integrity: A `sha512` or `sha1` Standard Subresource Integrity string"),
  ]),
  f("pypi", "install_hash", "SHA-256", "safe", "pip checks each file against the index's sha256.", [
    cite("pipPrepare", "if not self.require_hashes: return req.hashes(trust_internet=True)"),
  ]),
  f("crates", "install_hash", "SHA-256", "safe", "Cargo checks the index's cksum and records it in Cargo.lock.", [
    cite("cargoIndex", "A SHA256 checksum of the `.crate` file."),
  ]),
  f("rubygems", "install_hash", "SHA-256", "safe", "Compact-index checksums; Gemfile.lock CHECKSUMS since Bundler 2.6 (opt-in).", [
    cite("bundlerChecksumMismatch", "raise(ChecksumMismatchError.new(display_name, existing, checksum))"),
    cite("bundler26", "For a single lockfile, you can run `bundle lock --add-checksums`."),
  ]),
  f("go", "install_hash", "SHA-256", "safe", "go.sum h1: hashes (SHA-256 over a file-hash list), checked against the checksum database.", [
    cite("goChecksumDb", "the go command may connect to the checksum database to verify cryptographic hashes of modules not listed in go.sum"),
  ]),
  f("maven", "install_hash", "SHA-1 / MD5", "weak", "Central serves .sha1 and .md5 for every file (.sha256/.sha512 optional); Maven 3 checks SHA-1 and only warns on mismatch. SHA-1 collisions are practical today.", [
    cite("mavenResolverChecksums", "Most Maven repositories contain SHA-1 and MD5 checksums by default."),
    cite("mavenChecksumFailJira", "The default checksum policy when obtaining artifacts during a build is currently, by default, \"warn\"."),
  ]),
  f("packagist", "install_hash", "git SHA-1", "weak", "dist.shasum is empty for forge archives; the only pin is the commit id, a SHA-1 (GitHub detects known collision attacks, but the hash is SHA-1).", [
    cite("packagistMonologP2", '"shasum": ""'),
  ]),

  // Publisher signature
  f("npm", "publisher_signature", "ECDSA P-256", "vulnerable", `Optional provenance. ${SIGSTORE_SIG}`, SIGSTORE_KEYS),
  f("pypi", "publisher_signature", "ECDSA P-256", "vulnerable", `Optional PEP 740 attestations. ${SIGSTORE_SIG}`, SIGSTORE_KEYS),
  f("crates", "publisher_signature", "none", "n/a", "Nothing is signed.", [
    cite("rustTufGoal", "We would like to have a experimental out-of-band version of a signing pipeline for the project for releases and crates.io."),
  ]),
  f("rubygems", "publisher_signature", "ECDSA P-256", "vulnerable", `Optional attestations. ${SIGSTORE_SIG} Legacy gem cert signatures are RSA.`, [
    ...SIGSTORE_KEYS,
    cite("rubygemsSecurityGuide", "Authors create a certificate with `gem cert`"),
  ]),
  f("go", "publisher_signature", "none", "n/a", "Module authors cannot sign.", [
    cite("goSupplyChain", "Module authors don't register an account and don't upload versions to the proxy."),
  ]),
  f("maven", "publisher_signature", "PGP RSA/EdDSA", "vulnerable", "Mandatory PGP. Latest releases of the 50 sampled artifacts: RSA 34, EdDSA 6, ECDSA 5, DSA 4, 1 unsigned (2006). Long-lived keys on public keyservers, so a CRQC could sign as any of them. RFC 9980 (2026-06) adds ML-DSA composites to OpenPGP, but GnuPG cannot sign with them yet and no sampled signature uses them. Optional Sigstore bundles as above.", [
    cite("mavenGpgRequirement", "One of the requirements for publishing your artifacts to the Central Repository, is that they have been signed with PGP."),
    cite("mavenGpgRequirement", "and distribute it to a key server so that users can validate it"),
    cite("rfc9980", "composite public key signatures based on ML-DSA (formerly CRYSTALS-Dilithium)"),
    cite("sigstorePqc", "A production-ready PQC public instance is targeted for mid-2027"),
  ]),
  f("packagist", "publisher_signature", "none", "n/a", "Nothing is signed.", [
    cite("packagist2026", "Packagist.org hosting immutable build artifacts directly, with SLSA build provenance and Sigstore attestations verified on the Composer client side."),
  ]),

  // Registry signature
  f("npm", "registry_signature", "ECDSA P-256", "vulnerable", "dist.signatures and the publish attestation are signed with npm's registry key (ecdsa-sha2-nistp256, published at /-/npm/v1/keys).", [
    cite("npmRegistryKeys", '"keytype": "ecdsa-sha2-nistp256"'),
    cite("npmProvenanceRepo", "When verification is succesful npm attests the publish with by signing a publish attestation."),
  ]),
  f("pypi", "registry_signature", "none", "n/a", "PyPI signs nothing (PEP 458 is not deployed).", [
    cite("pep458", "should be integrated with the Python Package Index"),
  ]),
  f("crates", "registry_signature", "none", "n/a", "The index is unsigned.", [
    cite("rustTufGoal", "We would like to have a experimental out-of-band version of a signing pipeline for the project for releases and crates.io."),
  ]),
  f("rubygems", "registry_signature", "none", "n/a", "rubygems.org signs nothing.", [
    cite("rubygemsSecurityGuide", "In practice signing is rarely used because there is no established chain of trust for signing certificates"),
  ]),
  f("go", "registry_signature", "Ed25519", "vulnerable", "sum.golang.org signs its tree heads as signed notes with Ed25519 (algorithm byte 0x01 in its key).", [
    cite("goSignedNote", "There is only one key type, Ed25519 with algorithm identifier 1."),
    cite("goChecksumDb", "This signed description is in the form of a note"),
  ]),
  f("maven", "registry_signature", "none", "n/a", "Central signs nothing itself.", [
    cite("mavenResolverChecksums", "They do not by themselves establish that the checksum is trustworthy or protect against man-in-the-middle or supply chain attacks."),
  ]),
  f("packagist", "registry_signature", "none", "n/a", "Packagist signs nothing.", [
    cite("packagist2026", "Packagist.org hosting immutable build artifacts directly, with SLSA build provenance and Sigstore attestations verified on the Composer client side."),
  ]),

  // Transparency log
  f("npm", "transparency_log", "SHA-256 · ECDSA", "partial", REKOR, [
    ...REKOR_KEYS,
    cite("npmGeneratingProvenance", "it is signed by Sigstore public good servers and logged in a public transparency ledger"),
  ]),
  f("pypi", "transparency_log", "SHA-256 · ECDSA", "partial", REKOR, REKOR_KEYS),
  f("crates", "transparency_log", "none", "n/a", "No log.", [
    cite("rustTufGoal", "We would like to have a experimental out-of-band version of a signing pipeline for the project for releases and crates.io."),
  ]),
  f("rubygems", "transparency_log", "SHA-256 · ECDSA", "partial", REKOR, REKOR_KEYS),
  f("go", "transparency_log", "SHA-256 · Ed25519", "partial", "sum.golang.org: SHA-256 Merkle tree (post-quantum safe) with Ed25519-signed tree heads. go.sum then pins the hash itself, so a module already in go.sum stays protected.", [
    cite("goChecksumDb", "It is a Transparent Log (or \"Merkle Tree\") of `go.sum` line hashes"),
    cite("goSignedNote", "There is only one key type, Ed25519 with algorithm identifier 1."),
  ]),
  f("maven", "transparency_log", "SHA-256 · ECDSA", "partial", `Only for the optional .sigstore.json bundles. ${REKOR}`, [
    ...REKOR_KEYS,
    cite("mavenSigstoreValidation", "Sigstore"),
  ]),
  f("packagist", "transparency_log", "none", "n/a", "The security-event log is not a log of artifacts.", [
    cite("packagistImmutable", "Our next goal for immutability is now to provide immutable artifacts for each version."),
  ]),

  // Transport: our own handshake per host (scripts/probe-pq-tls.ts), archived with its date.
  f("npm", "transport", "TLS 1.2 · X25519", "vulnerable", "registry.npmjs.org and api.npmjs.org refuse TLS 1.3 (protocol_version alert), so no hybrid key exchange is possible. Publish tokens sent today could be decrypted from recorded traffic later.", [
    tls("npm,registry.npmjs.org,TLSv1.2,X25519,ECDSA-256,false"),
    tls("npm,api.npmjs.org,TLSv1.2,X25519,ECDSA-256,false"),
  ]),
  f("pypi", "transport", "X25519MLKEM768", "partial", "pypi.org, files.pythonhosted.org and upload.pypi.org negotiate hybrid ML-KEM; certificates RSA-2048.", [
    tls("pypi,pypi.org,TLSv1.3,X25519MLKEM768,RSA-2048,true"),
    tls("pypi,files.pythonhosted.org,TLSv1.3,X25519MLKEM768,RSA-2048,true"),
    tls("pypi,upload.pypi.org,TLSv1.3,X25519MLKEM768,RSA-2048,true"),
  ]),
  f("crates", "transport", "X25519MLKEM768", "partial", "crates.io, index.crates.io and static.crates.io negotiate hybrid ML-KEM; certificates RSA-2048.", [
    tls("crates,crates.io,TLSv1.3,X25519MLKEM768,RSA-2048,true"),
    tls("crates,index.crates.io,TLSv1.3,X25519MLKEM768,RSA-2048,true"),
    tls("crates,static.crates.io,TLSv1.3,X25519MLKEM768,RSA-2048,true"),
  ]),
  f("rubygems", "transport", "X25519MLKEM768", "partial", "rubygems.org and index.rubygems.org negotiate hybrid ML-KEM; certificates RSA-2048.", [
    tls("rubygems,rubygems.org,TLSv1.3,X25519MLKEM768,RSA-2048,true"),
    tls("rubygems,index.rubygems.org,TLSv1.3,X25519MLKEM768,RSA-2048,true"),
  ]),
  f("go", "transport", "X25519MLKEM768", "partial", "proxy.golang.org and sum.golang.org negotiate hybrid ML-KEM; certificates ECDSA P-256.", [
    tls("go,proxy.golang.org,TLSv1.3,X25519MLKEM768,ECDSA-256,true"),
    tls("go,sum.golang.org,TLSv1.3,X25519MLKEM768,ECDSA-256,true"),
  ]),
  f("maven", "transport", "X25519MLKEM768", "partial", "repo1.maven.org, repo.maven.apache.org and central.sonatype.com negotiate hybrid ML-KEM; certificates ECDSA P-256.", [
    tls("maven,repo1.maven.org,TLSv1.3,X25519MLKEM768,ECDSA-256,true"),
    tls("maven,repo.maven.apache.org,TLSv1.3,X25519MLKEM768,ECDSA-256,true"),
    tls("maven,central.sonatype.com,TLSv1.3,X25519MLKEM768,ECDSA-256,true"),
  ]),
  f("packagist", "transport", "mixed", "partial", "packagist.org and repo.packagist.org negotiate hybrid ML-KEM, but archives come from GitHub (api.github.com, codeload.github.com), which offers only classical X25519.", [
    tls("packagist,packagist.org,TLSv1.3,X25519MLKEM768,RSA-2048,true"),
    tls("packagist,repo.packagist.org,TLSv1.3,X25519MLKEM768,RSA-2048,true"),
    tls("packagist,api.github.com,TLSv1.3,X25519,ECDSA-256,false"),
    tls("packagist,codeload.github.com,TLSv1.3,X25519,ECDSA-256,false"),
  ]),

  // Publish credential
  f("npm", "publish_credential", "OIDC RS256", "vulnerable", OIDC, [
    GITHUB_OIDC,
    cite("npmAccessTokens", "As of November 2025, only Granular access tokens are supported."),
  ]),
  f("pypi", "publish_credential", "OIDC RS256", "vulnerable", `${OIDC} PyPI's tokens are macaroons (HMAC-SHA256).`, [
    GITHUB_OIDC,
    cite("pypiTrustedPublishersDocs", "using the OpenID Connect (OIDC) standard to exchange short-lived identity tokens between a trusted third-party service and PyPI"),
    cite("pypiMacaroonService", "import pymacaroons"),
  ]),
  f("crates", "publish_credential", "OIDC RS256", "vulnerable", OIDC, [
    GITHUB_OIDC,
    cite("cratesTrustedPublishingRfc", "Short-lived access tokens are granted via the OpenID Connect (OIDC) protocol"),
    cite("cratesTokens", "you can configure a token to solely enable the publishing of new versions for existing crates"),
  ]),
  f("rubygems", "publish_credential", "OIDC RS256", "vulnerable", OIDC, [
    GITHUB_OIDC,
    cite("rubygemsTrustedPublishing", "Under the hood, Trusted Publishing uses OpenID Connect (OIDC) to exchange short-lived identity tokens between GitHub Actions and RubyGems.org."),
    cite("rubygemsApiKeyScopes", "API keys have varying scopes that grant specific privileges."),
  ]),
  f("go", "publish_credential", "forge SSH key", "vulnerable", GIT_PUSH, [
    cite("goSupplyChain", "directly from the VCS, where tags define versions."),
    cite("goVcs", "Modules may be downloaded directly from version control repositories or from module proxy servers."),
    cite("githubUserKeys", "Lists the verified public SSH keys for a user. This is accessible by anyone."),
  ]),
  f("maven", "publish_credential", "bearer token", "safe", "Portal user tokens are random secrets; no OIDC path exists. Only harvested traffic could expose them, and the Central hosts already use hybrid key exchange.", [
    cite("mavenPortalToken", "You must use a user token to publish artifacts to the Central Repository via the Central Publisher Portal."),
    tls("maven,central.sonatype.com,TLSv1.3,X25519MLKEM768,ECDSA-256,true"),
  ]),
  f("packagist", "publish_credential", "forge SSH key", "vulnerable", GIT_PUSH, [
    cite("packagistAbout", "New versions of your package are automatically fetched from tags you create in your VCS repository."),
    cite("githubUserKeys", "Lists the verified public SSH keys for a user. This is accessible by anyone."),
  ]),

  // MFA
  f("npm", "mfa", "TOTP · WebAuthn", "partial", "Security keys (WebAuthn) are the documented method and TOTP is being deprecated. TOTP is HMAC-SHA1 over a shared secret (post-quantum safe). Security keys sign with ECDSA/EdDSA, but their public keys are known only to the registry.", [
    cite("npm2fa", "You can enable two-factor authentication (2FA) on your npm user account to protect against unauthorized access to your account and packages using a security-key."),
    cite("npmSecureSupplyChainPlan", "Deprecate time-based one-time password (TOTP) 2FA, migrating users to FIDO-based 2FA."),
  ]),
  f("pypi", "mfa", "TOTP · WebAuthn", "partial", "Mandatory. TOTP is symmetric; WebAuthn signatures are classical, with public keys known only to PyPI.", [
    cite("pypiHelp2fa", "\"something you own\" can be an application to generate a temporary code, or a security device (most commonly a USB key)."),
    cite("pypi2faEnforced", "PyPI now requires Two-factor authentication (2FA) for all users."),
  ]),
  f("crates", "mfa", "via GitHub", "partial", "Whatever the GitHub account uses: TOTP, WebAuthn/passkeys, GitHub Mobile or SMS.", [
    cite("github2fa", "After you configure 2FA, using a time-based one-time password (TOTP) mobile app, or via text message, you can add a security key"),
    cite("github2fa", "You can also use GitHub Mobile for 2FA after configuring a TOTP mobile app or text messages."),
  ]),
  f("rubygems", "mfa", "TOTP · WebAuthn", "partial", "TOTP is symmetric; WebAuthn signatures are classical, with public keys known only to rubygems.org.", [
    cite("rubygemsMfaSetup", "You may enable MFA using WebAuthn or by using one-time passwords (OTP)."),
  ]),
  f("go", "mfa", "n/a", "n/a", "No publisher accounts; the forge's own 2FA applies.", [
    cite("goSupplyChain", "In Go, there is no such thing as a package repository account."),
  ]),
  f("maven", "mfa", "TOTP (optional)", "safe", "Authenticator apps only (TOTP or Auth0 Guardian push); no security keys.", [
    cite("sonatypeMfa", "Supported MFA authenticators: Auth, Google Authenticator, Auth0 Guardian, and Microsoft Authenticator"),
  ]),
  f("packagist", "mfa", "TOTP (optional)", "safe", "TOTP only, optional.", [
    cite("packagist2026", "Beyond that, we intend to implement FIDO2 support and eventually require MFA for all Packagist.org accounts."),
  ]),
];

/** When every value was last checked: the newest access date among its archived sources. */
export const PQC_VERIFIED = lastAccessed(PQC.flatMap((f) => f.sources));

export function pqcOf(ecosystem: EcosystemId, layer: PqcLayer): PqcFact {
  const fact = PQC.find((p) => p.ecosystem === ecosystem && p.layer === layer);
  if (!fact) throw new Error(`no post-quantum fact for ${ecosystem}/${layer}`);
  return fact;
}
