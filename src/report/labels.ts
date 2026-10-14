import type { EcosystemId, SignalId, WithdrawalKind } from "../types.ts";
import type { MatrixCell } from "../stages/aggregate.ts";

export const SIGNAL_LABEL: Record<SignalId, string> = {
  identity_publish: "Identity-bound publish",
  artifact_signature: "Publisher signature",
  registry_integrity: "Registry integrity",
  build_provenance: "SLSA provenance",
  source_link: "Source link",
  transparency_log: "Transparency log",
  mfa_enforced: "MFA enforced",
};

export const ECOSYSTEM_LABEL: Record<EcosystemId, string> = {
  pypi: "PyPI",
  npm: "npm",
  crates: "crates.io",
  rubygems: "RubyGems",
  go: "Go",
  maven: "Maven Central",
  packagist: "Packagist",
};

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

/** "13 Oct 2026, 09:14 UTC" for an ISO instant; "13 Oct 2026" with `dateOnly`. Always UTC. */
export function humanDate(iso: string, dateOnly = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return dateOnly ? DAY.format(d) : `${DAY.format(d)}, ${TIME.format(d)} UTC`;
}

/** "Jul 2026" for a `YYYY-MM` month. */
export function humanMonth(ym: string): string {
  return /^\d{4}-\d{2}$/.test(ym) ? MONTH.format(new Date(`${ym}-01T00:00:00Z`)) : ym;
}

/**
 * How each ecosystem's uploads authenticate, as far as its identity signal tells: `true` is
 * trusted publishing, `false` an account credential (API token or login session), and
 * `unknown` either. Go and Packagist have no upload at all: a release is a VCS tag.
 */
export const NO_UPLOAD: ReadonlySet<EcosystemId> = new Set(["go", "packagist"]);

export const PUBLISH_CREDENTIAL: Record<EcosystemId, string> = {
  npm: "granular token or login session",
  pypi: "API token (not distinguishable from trusted publishing without attestations)",
  crates: "API token",
  rubygems: "user API key",
  maven: "Portal user token (no OIDC path exists)",
  go: "none: releases are VCS tags",
  packagist: "none: releases are VCS tags",
};

/** Why a registry has no withdrawal counts, for registries that expose none. */
export const WITHDRAWAL_BLIND: Partial<Record<EcosystemId, string>> = {
  rubygems: "yanked versions vanish from every API, so yanks cannot be counted",
  maven: "nothing can be withdrawn",
  packagist: "soft-deleted versions are not in the public API",
};

export const WITHDRAWAL_LABEL: Record<WithdrawalKind, string> = {
  yanked: "yanked",
  unpublished: "unpublished",
  deprecated: "deprecated (still installs)",
  retracted: "retracted (all time)",
};

export function pctText(p: number | null): string {
  return p == null ? "–" : `${Math.round(p * 100)}%`;
}

/** Like `pctText`, but a small non-zero share reads "<1%" instead of rounding to 0%. */
export function pctSmall(p: number): string {
  return p > 0 && p < 0.005 ? "<1%" : pctText(p);
}

/**
 * One matrix cell as text. Cells the registry cannot report on never show a percentage,
 * so "no mechanism" and "not exposed" stay visibly different from "0%".
 * An inferred signal with unknowns is a lower bound, marked "≥".
 */
export function cellText(c: MatrixCell): string {
  if (c.availability === "no_mechanism") return "— no mechanism";
  if (c.availability === "not_exposed") return "n/a — not exposed";
  if (c.n === 0) return "no data";
  const bound = c.availability === "inferred" && c.u > 0 ? "≥ " : "";
  const mandatory = c.mandatory ? " · mandatory" : "";
  return `${bound}${pctText(c.pct)} (${c.t}/${c.n})${mandatory}`;
}
