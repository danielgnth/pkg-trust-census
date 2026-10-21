/**
 * `registry.md` and `registry.csv`: the whole-registry layer (src/bigquery/registry.ts). How
 * common Sigstore attestations are across every package of four registries, by quarter, beside the
 * random sample's estimate for active packages. deps.dev's data, reported on its own page: it is
 * never mixed into the matrix or the score.
 */

import { ECOSYSTEMS, type EcosystemId } from "../types.ts";
import type { StoredQuery } from "../bigquery/client.ts";
import { REGISTRY_SYSTEMS, type RegistryRow } from "../bigquery/registry.ts";
import { outDir, type Aggregate } from "../stages/aggregate.ts";
import { DATASET_NOTES } from "../facts/samples.ts";
import { citeLinks } from "../sources/index.ts";
import { ECOSYSTEM_LABEL, intervalText, pctText } from "./labels.ts";

/** The signal of ours that reads the same mechanism deps.dev records (scripts/check-depsdev.ts). */
const SAME_MECHANISM: Partial<Record<EcosystemId, "artifact_signature" | "transparency_log">> = {
  npm: "artifact_signature",
  pypi: "artifact_signature",
  rubygems: "transparency_log",
  maven: "transparency_log",
};

/** One decimal: across millions of packages, 0.2% is thousands of them. */
const share = (k: number, n: number) => (n ? `${((100 * k) / n).toFixed(1)}% (${k.toLocaleString("en")}/${n.toLocaleString("en")})` : "–");

export function registryMarkdown(q: StoredQuery<RegistryRow>, random: Aggregate | null, quarters: string[], snapshotId: string): string {
  const ecosystems = ECOSYSTEMS.filter((e) => REGISTRY_SYSTEMS[e]);
  const row = (e: EcosystemId, point: string) => q.rows.find((r) => r.system === REGISTRY_SYSTEMS[e] && r.point === point);
  const estimate = (e: EcosystemId) => {
    const c = random?.matrix.find((m) => m.ecosystem === e && m.signal === SAME_MECHANISM[e]);
    return c && c.n ? `${pctText(c.pct)} ${intervalText(c.lo, c.hi)} (n=${c.n})` : "–";
  };
  const gib = (b: number) => `${(b / 1024 ** 3).toFixed(1)} GiB`;

  return [
    `# Whole registry: Sigstore attestations (deps.dev snapshot ${q.depsdevSnapshot?.slice(0, 10)})`,
    "",
    "Every package of four registries, from deps.dev's BigQuery dataset: each package's newest release (pre-releases",
    "excluded), and whether deps.dev records a Sigstore attestation for it. This is deps.dev's data, not this project's",
    "measurement, so it is reported here and nowhere in the matrix or the score. How it agrees with this project's own",
    "reading, release by release, is in the [agreement check](../../../sources/archive/depsDevAgreement.txt).",
    "",
    "## Latest release",
    "",
    "| Platform | Packages | Attested | Verified by deps.dev | Names repo + commit | Active packages: attested | Random sample (active): ours |",
    "|---|---:|---:|---:|---:|---:|---:|",
    ...ecosystems.map((e) => {
      const r = row(e, "snapshot");
      if (!r) return `| ${ECOSYSTEM_LABEL[e]} | – | – | – | – | – | ${estimate(e)} |`;
      return `| ${ECOSYSTEM_LABEL[e]} | ${r.packages.toLocaleString("en")} | ${share(r.attested, r.packages)} | ${share(r.verified, r.packages)} | ${share(r.linked, r.packages)} | ${share(r.active_attested, r.active)} | ${estimate(e)} |`;
    }),
    "",
    "*Active*: newest release within the 36 months before the snapshot, the random sample's population. Its last",
    "column is this project's own measurement of the same mechanism on that sample, with its 95% interval: the whole",
    "registry's figure should fall inside it.",
    "",
    "## Over time (newest release at each quarter's end, all packages)",
    "",
    `| Quarter | ${ecosystems.map((e) => ECOSYSTEM_LABEL[e]).join(" | ")} |`,
    `|---|${ecosystems.map(() => "---:").join("|")}|`,
    ...quarters.map((label) => `| ${label} | ${ecosystems.map((e) => {
      const r = row(e, label);
      return r ? share(r.attested, r.packages) : "–";
    }).join(" | ")} |`),
    "",
    "## Query",
    "",
    `Run ${q.stats.ranAt} against deps.dev's snapshot of ${q.depsdevSnapshot}; ${gib(q.stats.bytesProcessed)} processed`,
    `(job \`${q.stats.jobId}\`). The SQL, its parameters and the result are in [attestations.json](../../bigquery/${snapshotId}/attestations.json).`,
    "",
    "## Method and sources",
    "",
    ...DATASET_NOTES.filter((n) => n.label.startsWith("Whole registry")).map((n) => `- **${n.label.replace("Whole registry: ", "")}**: ${n.note} ${citeLinks(n.sources, outDir(snapshotId))}`),
    "",
  ].join("\n");
}

export function registryCsv(q: StoredQuery<RegistryRow>, csv: (header: string[], rows: unknown[][]) => string): string {
  return csv(
    ["point", "system", "packages", "attested", "verified", "linked", "active", "active_attested", "depsdev_snapshot"],
    q.rows.map((r) => [r.point, r.system, r.packages, r.attested, r.verified, r.linked, r.active, r.active_attested, q.depsdevSnapshot]),
  );
}
