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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "13 Oct 2026, 09:14 UTC" for an ISO instant; "13 Oct 2026" with `dateOnly`. Always UTC. */
export function humanDate(iso: string, dateOnly = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  if (dateOnly) return day;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${day}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** "Jul 2026" for a `YYYY-MM` month. */
export function humanMonth(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : ym;
}

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
