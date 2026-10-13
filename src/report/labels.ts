import type { EcosystemId, SignalId } from "../types.ts";
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

export function pctText(p: number | null): string {
  return p == null ? "–" : `${Math.round(p * 100)}%`;
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
