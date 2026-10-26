/**
 * Removing personal data from what this project publishes: the response cache (src/publish/),
 * test fixtures (scripts/capture-fixtures.ts) and archived sources (scripts/archive-sources.ts).
 *
 * The method is field-level: each adapter lists the response fields that name people
 * (`PERSONAL_DATA`), and their values are replaced with placeholders of the same type, so an
 * array keeps its length (a maintainer count survives) and an object keeps the keys a signal
 * reads (npm's `_npmUser.trustedPublisher`). An email pattern runs over everything on top, as
 * a safety net, and `residue` reports any listed field or address a redaction left behind.
 */

import type { EcosystemId } from "../types.ts";

/** Email-shaped text; `isPersonalEmail` then drops the technical look-alikes. */
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/** Addresses that name no one: git remotes, no-reply senders, reserved example domains. */
const NOT_PERSONAL = /^(git|[^@]*no-?reply[^@]*)@|@(example\.(com|org|net|invalid)|users\.noreply\.github\.com)$/i;

export const PLACEHOLDER = "redacted";
export const PLACEHOLDER_EMAIL = "redacted@example.invalid";

/** A version after an `@` (`repo@v3.1.0.rc`, a purl) looks like an address but is not one. */
export function isPersonalEmail(match: string): boolean {
  const domain = match.slice(match.indexOf("@") + 1);
  return !/^v?\d+(\.\d+)*\./i.test(domain) && !NOT_PERSONAL.test(match);
}

export function redactEmails(text: string): string {
  return text.replace(EMAIL, (m) => (isPersonalEmail(m) ? PLACEHOLDER_EMAIL : m));
}

export function personalEmails(text: string): string[] {
  return [...text.matchAll(EMAIL)].map((m) => m[0]).filter((m) => isPersonalEmail(m) && m !== PLACEHOLDER_EMAIL);
}

/**
 * Where people are named in one kind of response. `paths` are dot-separated, `*` matching any
 * key or array index. A path's value becomes a placeholder of the same type, except that keys in
 * `keep` stay as they are; a path in `empty` becomes an empty object or array (npm's star list,
 * whose keys are the usernames).
 */
export interface PersonalData {
  ecosystem: EcosystemId | "any";
  /** The endpoint, as a reader would name it. */
  endpoint: string;
  matches: (url: string) => boolean;
  paths?: string[];
  keep?: string[];
  empty?: string[];
  /** For responses that are not JSON: rewrites the text. */
  text?: (body: string) => string;
  /** For responses that are not JSON: what `text` should have removed, if still present. */
  textResidue?: (body: string) => string[];
}

/** A placeholder with `value`'s shape: strings become "redacted", numbers 0; arrays keep their length. */
export function placeholder(value: unknown, keep: ReadonlySet<string> = new Set()): unknown {
  if (typeof value === "string") return value.includes("@") ? PLACEHOLDER_EMAIL : PLACEHOLDER;
  if (typeof value === "number") return 0;
  if (Array.isArray(value)) return value.map((v) => placeholder(v, keep));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, keep.has(k) ? v : placeholder(v, keep)]));
  }
  return value;
}

function isPlaceholder(value: unknown, keep: ReadonlySet<string>): boolean {
  if (typeof value === "string") return value === PLACEHOLDER || value === PLACEHOLDER_EMAIL;
  if (typeof value === "number") return value === 0;
  if (Array.isArray(value)) return value.every((v) => isPlaceholder(v, keep));
  if (value && typeof value === "object") return Object.entries(value).every(([k, v]) => keep.has(k) || isPlaceholder(v, keep));
  return true;
}

/** Calls `visit` with the parent and key of every value at `path`. */
function at(root: unknown, path: string, visit: (parent: Record<string, unknown>, key: string) => void): void {
  const steps = path.split(".");
  const walk = (node: unknown, i: number): void => {
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    const step = steps[i]!;
    const keys = step === "*" ? Object.keys(obj) : step in obj ? [step] : [];
    for (const k of keys) {
      if (i === steps.length - 1) visit(obj, k);
      else walk(obj[k], i + 1);
    }
  };
  walk(root, 0);
}

/**
 * Sigstore bundles carry the signer's certificate as base64 DER. A CI identity names a
 * workflow; one signed by a person names their email, which no text pattern sees inside the
 * base64. Such a certificate is blanked: what this project reads from certificates (the source
 * repository and commit) is never in a personal one.
 */
function blankPersonalCertificates(node: unknown): void {
  if (!node || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node)) {
    if (typeof v === "string" && (k === "rawBytes" || k === "certificate") && v.length > 200) {
      const der = Buffer.from(v, "base64").toString("latin1");
      if (personalEmails(der).length) (node as Record<string, unknown>)[k] = "";
    } else if (v && typeof v === "object") blankPersonalCertificates(v);
  }
}

/** The redacted body, or the body unchanged when no spec applies and it holds no address. */
export function redactBody(url: string, body: string, specs: readonly PersonalData[]): string {
  const mine = specs.filter((s) => s.matches(url));
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    let text = body;
    for (const s of mine) if (s.text) text = s.text(text);
    return redactEmails(text);
  }
  for (const s of mine) {
    const keep = new Set(s.keep ?? []);
    for (const p of s.paths ?? []) at(json, p, (parent, key) => void (parent[key] = placeholder(parent[key], keep)));
    for (const p of s.empty ?? []) at(json, p, (parent, key) => void (parent[key] = Array.isArray(parent[key]) ? [] : {}));
  }
  blankPersonalCertificates(json);
  return redactEmails(JSON.stringify(json));
}

/** What a redacted body still names: listed fields with real values, and addresses. */
export function residue(url: string, body: string, specs: readonly PersonalData[]): string[] {
  const mine = specs.filter((s) => s.matches(url));
  const found = personalEmails(body).map((e) => `address ${e}`);
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    for (const s of mine) found.push(...(s.textResidue?.(body) ?? []));
    return found;
  }
  for (const s of mine) {
    const keep = new Set(s.keep ?? []);
    for (const p of s.paths ?? []) at(json, p, (parent, key) => void (isPlaceholder(parent[key], keep) || found.push(`field ${p}`)));
    for (const p of s.empty ?? []) at(json, p, (parent, key) => void (Object.keys(parent[key] ?? {}).length && found.push(`field ${p}`)));
  }
  return found;
}
