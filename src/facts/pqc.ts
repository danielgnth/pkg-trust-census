/**
 * Post-quantum exposure of every cryptographic mechanism in the publish → install chain,
 * per ecosystem (verified 2026-10-13; TLS measured with scripts/probe-pq-tls.ts).
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

import type { EcosystemId } from "../types.ts";

export const PQC_VERIFIED = "2026-10-13";

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
  sources: string[];
}

const S = {
  sigstoreRoot: "https://github.com/sigstore/root-signing/blob/main/targets/trusted_root.json",
  sigstorePqc: "https://blog.sigstore.dev/pqc-sigstore/",
  npmKeys: "https://registry.npmjs.org/-/npm/v1/keys",
  npmIntegrity: "https://docs.npmjs.com/cli/configuring-npm/package-lock-json",
  npmProvenance: "https://github.com/npm/provenance",
  npmTokens: "https://docs.npmjs.com/about-access-tokens",
  npm2fa: "https://docs.npmjs.com/configuring-two-factor-authentication",
  pypiHashes: "https://github.com/pypa/pip/blob/main/src/pip/_internal/operations/prepare.py",
  pypiTokens: "https://pypi.org/help/#apitoken",
  pypiTp: "https://docs.pypi.org/trusted-publishers/",
  pypi2fa: "https://pypi.org/help/#twofa",
  cargoIndex: "https://doc.rust-lang.org/cargo/reference/registry-index.html",
  cratesTokens: "https://blog.rust-lang.org/2023/06/23/improved-api-tokens-for-crates-io/",
  cratesTp: "https://rust-lang.github.io/rfcs/3691-trusted-publishing-cratesio.html",
  github2fa: "https://docs.github.com/en/authentication/securing-your-account-with-two-factor-authentication-2fa/about-two-factor-authentication",
  githubOidc: "https://token.actions.githubusercontent.com/.well-known/jwks",
  githubKeys: "https://docs.github.com/en/rest/users/keys#list-public-keys-for-a-user",
  bundler26: "https://bundler.io/blog/2024/12/19/bundler-v2-6.html",
  rubygemsKeys: "https://guides.rubygems.org/api-key-scopes/",
  rubygemsTp: "https://guides.rubygems.org/trusted-publishing/",
  rubygemsMfa: "https://guides.rubygems.org/setting-up-multifactor-authentication/",
  goSumdb: "https://go.dev/ref/mod#checksum-database",
  goNote: "https://pkg.go.dev/golang.org/x/mod/sumdb/note",
  goModules: "https://go.dev/ref/mod#vcs",
  mavenChecksums: "https://maven.apache.org/resolver/about-checksums.html",
  mavenGpg: "https://central.sonatype.org/publish/requirements/gpg/",
  mavenTokens: "https://central.sonatype.org/publish/generate-portal-token/",
  sonatypeMfa: "https://help.sonatype.com/en/authentication-with-sonatype-cloud.html",
  openpgpPqc: "https://www.rfc-editor.org/rfc/rfc9980.html",
  packagistP2: "https://repo.packagist.org/p2/monolog/monolog.json",
  packagistAbout: "https://packagist.org/about",
  packagist2026: "https://blog.packagist.com/an-update-on-composer-packagist-supply-chain-security/",
  probe: "https://github.com/danielgnth/pkg-trust-census/blob/main/scripts/probe-pq-tls.ts",
};

const f = (ecosystem: EcosystemId, layer: PqcLayer, primitive: string, status: PqcStatus, note: string, sources: string[]): PqcFact => ({
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

export const PQC: PqcFact[] = [
  // Install hash
  f("npm", "install_hash", "SHA-512", "safe", "dist.integrity (SRI sha512), recorded in package-lock.json.", [S.npmIntegrity]),
  f("pypi", "install_hash", "SHA-256", "safe", "pip checks each file against the index's sha256.", [S.pypiHashes]),
  f("crates", "install_hash", "SHA-256", "safe", "Cargo checks the index's cksum and records it in Cargo.lock.", [S.cargoIndex]),
  f("rubygems", "install_hash", "SHA-256", "safe", "Compact-index checksums; Gemfile.lock CHECKSUMS since Bundler 2.6 (opt-in).", [S.bundler26]),
  f("go", "install_hash", "SHA-256", "safe", "go.sum h1: hashes (SHA-256 over a file-hash list), checked against the checksum database.", [S.goSumdb]),
  f("maven", "install_hash", "SHA-1 / MD5", "weak", "Central serves .sha1 and .md5 for every file (.sha256/.sha512 optional); Maven 3 checks SHA-1 and only warns on mismatch. SHA-1 collisions are practical today.", [S.mavenChecksums]),
  f("packagist", "install_hash", "git SHA-1", "weak", "dist.shasum is empty for forge archives; the only pin is the commit id, a SHA-1 (GitHub detects known collision attacks, but the hash is SHA-1).", [S.packagistP2]),

  // Publisher signature
  f("npm", "publisher_signature", "ECDSA P-256", "vulnerable", `Optional provenance. ${SIGSTORE_SIG}`, [S.sigstoreRoot, S.sigstorePqc]),
  f("pypi", "publisher_signature", "ECDSA P-256", "vulnerable", `Optional PEP 740 attestations. ${SIGSTORE_SIG}`, [S.sigstoreRoot, S.sigstorePqc]),
  f("crates", "publisher_signature", "none", "n/a", "Nothing is signed.", [S.cargoIndex]),
  f("rubygems", "publisher_signature", "ECDSA P-256", "vulnerable", `Optional attestations. ${SIGSTORE_SIG} Legacy gem cert signatures are RSA.`, [S.sigstoreRoot, S.sigstorePqc]),
  f("go", "publisher_signature", "none", "n/a", "Module authors cannot sign.", [S.goSumdb]),
  f("maven", "publisher_signature", "PGP RSA/EdDSA", "vulnerable", "Mandatory PGP. Latest releases of the 50 sampled artifacts: RSA 34, EdDSA 6, ECDSA 5, DSA 4, 1 unsigned (2006). Long-lived keys on public keyservers, so a CRQC could sign as any of them. RFC 9980 (2026-06) adds ML-DSA composites to OpenPGP, but GnuPG cannot sign with them yet and no sampled signature uses them. Optional Sigstore bundles as above.", [S.mavenGpg, S.openpgpPqc, S.sigstorePqc]),
  f("packagist", "publisher_signature", "none", "n/a", "Nothing is signed.", [S.packagist2026]),

  // Registry signature
  f("npm", "registry_signature", "ECDSA P-256", "vulnerable", "dist.signatures and the publish attestation are signed with npm's registry key (ecdsa-sha2-nistp256, published at /-/npm/v1/keys).", [S.npmKeys, S.npmProvenance]),
  f("pypi", "registry_signature", "none", "n/a", "PyPI signs nothing (PEP 458 is not deployed).", [S.pypiHashes]),
  f("crates", "registry_signature", "none", "n/a", "The index is unsigned.", [S.cargoIndex]),
  f("rubygems", "registry_signature", "none", "n/a", "rubygems.org signs nothing.", [S.rubygemsKeys]),
  f("go", "registry_signature", "Ed25519", "vulnerable", "sum.golang.org signs its tree heads as signed notes with Ed25519 (algorithm byte 0x01 in its key).", [S.goNote, S.goSumdb]),
  f("maven", "registry_signature", "none", "n/a", "Central signs nothing itself.", [S.mavenGpg]),
  f("packagist", "registry_signature", "none", "n/a", "Packagist signs nothing.", [S.packagist2026]),

  // Transparency log
  f("npm", "transparency_log", "SHA-256 · ECDSA", "partial", REKOR, [S.sigstoreRoot]),
  f("pypi", "transparency_log", "SHA-256 · ECDSA", "partial", REKOR, [S.sigstoreRoot]),
  f("crates", "transparency_log", "none", "n/a", "No log.", [S.cargoIndex]),
  f("rubygems", "transparency_log", "SHA-256 · ECDSA", "partial", REKOR, [S.sigstoreRoot]),
  f("go", "transparency_log", "SHA-256 · Ed25519", "partial", "sum.golang.org: SHA-256 Merkle tree (post-quantum safe) with Ed25519-signed tree heads. go.sum then pins the hash itself, so a module already in go.sum stays protected.", [S.goSumdb, S.goNote]),
  f("maven", "transparency_log", "SHA-256 · ECDSA", "partial", `Only for the optional .sigstore.json bundles. ${REKOR}`, [S.sigstoreRoot]),
  f("packagist", "transparency_log", "none", "n/a", "The security-event log is not a log of artifacts.", [S.packagist2026]),

  // Transport: measured 2026-10-13 (scripts/probe-pq-tls.ts). Certificates are RSA-2048 or ECDSA P-256 on every host.
  f("npm", "transport", "TLS 1.2 · X25519", "vulnerable", "registry.npmjs.org and api.npmjs.org refuse TLS 1.3 (protocol_version alert), so no hybrid key exchange is possible. Publish tokens sent today could be decrypted from recorded traffic later.", [S.probe]),
  f("pypi", "transport", "X25519MLKEM768", "partial", "pypi.org, files.pythonhosted.org and upload.pypi.org negotiate hybrid ML-KEM; certificates RSA-2048.", [S.probe]),
  f("crates", "transport", "X25519MLKEM768", "partial", "crates.io, index.crates.io and static.crates.io negotiate hybrid ML-KEM; certificates RSA-2048.", [S.probe]),
  f("rubygems", "transport", "X25519MLKEM768", "partial", "rubygems.org and index.rubygems.org negotiate hybrid ML-KEM; certificates RSA-2048.", [S.probe]),
  f("go", "transport", "X25519MLKEM768", "partial", "proxy.golang.org and sum.golang.org negotiate hybrid ML-KEM; certificates ECDSA P-256.", [S.probe]),
  f("maven", "transport", "X25519MLKEM768", "partial", "repo1.maven.org, repo.maven.apache.org and central.sonatype.com negotiate hybrid ML-KEM; certificates ECDSA P-256.", [S.probe]),
  f("packagist", "transport", "mixed", "partial", "packagist.org and repo.packagist.org negotiate hybrid ML-KEM, but archives come from GitHub (api.github.com, codeload.github.com), which offers only classical X25519.", [S.probe]),

  // Publish credential
  f("npm", "publish_credential", "OIDC RS256", "vulnerable", OIDC, [S.githubOidc, S.npmTokens]),
  f("pypi", "publish_credential", "OIDC RS256", "vulnerable", `${OIDC} PyPI's tokens are macaroons (HMAC-SHA256).`, [S.githubOidc, S.pypiTp, S.pypiTokens]),
  f("crates", "publish_credential", "OIDC RS256", "vulnerable", OIDC, [S.githubOidc, S.cratesTp, S.cratesTokens]),
  f("rubygems", "publish_credential", "OIDC RS256", "vulnerable", OIDC, [S.githubOidc, S.rubygemsTp, S.rubygemsKeys]),
  f("go", "publish_credential", "forge SSH key", "vulnerable", GIT_PUSH, [S.goModules, S.githubKeys]),
  f("maven", "publish_credential", "bearer token", "safe", "Portal user tokens are random secrets; no OIDC path exists. Only harvested traffic could expose them, and the Central hosts already use hybrid key exchange.", [S.mavenTokens]),
  f("packagist", "publish_credential", "forge SSH key", "vulnerable", GIT_PUSH, [S.packagistAbout, S.githubKeys]),

  // MFA
  f("npm", "mfa", "TOTP · WebAuthn", "partial", "TOTP is HMAC-SHA1 over a shared secret (post-quantum safe). Security keys sign with ECDSA/EdDSA, but their public keys are known only to the registry.", [S.npm2fa]),
  f("pypi", "mfa", "TOTP · WebAuthn", "partial", "Mandatory. TOTP is symmetric; WebAuthn signatures are classical, with public keys known only to PyPI.", [S.pypi2fa]),
  f("crates", "mfa", "via GitHub", "partial", "Whatever the GitHub account uses: TOTP, WebAuthn/passkeys, GitHub Mobile or SMS.", [S.github2fa]),
  f("rubygems", "mfa", "TOTP · WebAuthn", "partial", "TOTP is symmetric; WebAuthn signatures are classical, with public keys known only to rubygems.org.", [S.rubygemsMfa]),
  f("go", "mfa", "n/a", "n/a", "No publisher accounts; the forge's own 2FA applies.", [S.goModules]),
  f("maven", "mfa", "TOTP (optional)", "safe", "Authenticator apps only (TOTP or Auth0 Guardian push); no security keys.", [S.sonatypeMfa]),
  f("packagist", "mfa", "TOTP (optional)", "safe", "TOTP only, optional.", [S.packagist2026]),
];

export function pqcOf(ecosystem: EcosystemId, layer: PqcLayer): PqcFact {
  const fact = PQC.find((p) => p.ecosystem === ecosystem && p.layer === layer);
  if (!fact) throw new Error(`no post-quantum fact for ${ecosystem}/${layer}`);
  return fact;
}
