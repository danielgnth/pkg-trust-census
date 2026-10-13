/**
 * Reads the source reference out of a Sigstore (Fulcio) signing certificate.
 *
 * When CI signs with Sigstore, Fulcio embeds the OIDC token's claims in the certificate as
 * X.509 extensions under 1.3.6.1.4.1.57264.1.*: which repository, which commit, which
 * workflow. Those claims come from the CI provider's signed token, not from the uploader,
 * which is why a certificate carrying them counts as a source link (methodology.md).
 *
 * Only the two extensions needed are located, by scanning the DER for their OID bytes.
 * That is sufficient for a machine-generated certificate and avoids an ASN.1 dependency.
 * Certificate *validity* is not checked here — the registry verified the bundle on upload.
 */

/** 1.3.6.1.4.1.57264.1.12 Source Repository URI, .13 Source Repository Digest. */
const SOURCE_REPOSITORY_URI = [0x06, 0x0a, 0x2b, 0x06, 0x01, 0x04, 0x01, 0x83, 0xbf, 0x30, 0x01, 0x0c];
const SOURCE_REPOSITORY_DIGEST = [0x06, 0x0a, 0x2b, 0x06, 0x01, 0x04, 0x01, 0x83, 0xbf, 0x30, 0x01, 0x0d];

export interface SourceRef {
  repository: string | null;
  digest: string;
}

/** @param der the certificate, as base64 DER (the form Sigstore bundles carry it in) */
export function fulcioSourceRef(derBase64: string | null | undefined): SourceRef | null {
  if (!derBase64) return null;
  let der: Uint8Array;
  try {
    der = Uint8Array.from(Buffer.from(derBase64, "base64"));
  } catch {
    return null;
  }
  const digest = extensionString(der, SOURCE_REPOSITORY_DIGEST);
  if (!digest) return null;
  return { repository: extensionString(der, SOURCE_REPOSITORY_URI), digest };
}

/** Value of a v2 Fulcio extension: OID, optional `critical` BOOLEAN, OCTET STRING { UTF8String }. */
function extensionString(der: Uint8Array, oid: number[]): string | null {
  const at = indexOf(der, oid);
  if (at === -1) return null;
  let i = at + oid.length;
  if (der[i] === 0x01) i += 2 + der[i + 1]!; // critical flag
  if (der[i] !== 0x04) return null;
  const outer = readLength(der, i + 1);
  if (!outer) return null;
  i = outer.start;
  if (der[i] !== 0x0c) return null;
  const inner = readLength(der, i + 1);
  if (!inner) return null;
  return new TextDecoder().decode(der.subarray(inner.start, inner.start + inner.length));
}

function readLength(der: Uint8Array, i: number): { length: number; start: number } | null {
  const first = der[i];
  if (first === undefined) return null;
  if (first < 0x80) return { length: first, start: i + 1 };
  const n = first & 0x7f;
  if (n === 0 || n > 3) return null;
  let length = 0;
  for (let k = 1; k <= n; k++) length = (length << 8) | der[i + k]!;
  return { length, start: i + 1 + n };
}

function indexOf(haystack: Uint8Array, needle: number[]): number {
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}
