/**
 * The comparison of a snapshot's two samples (docs/methodology.md, Sample): what the most-used
 * packages do against what a typical active package does, every share with its 95% interval.
 * Written to the snapshot's folder as `layers.md` and `layers.csv` when both layers exist, with
 * the random draw's record (`random/draw.json`) beside the random layer's report.
 */

import { and, eq } from "drizzle-orm";
import { join } from "node:path";
import { ECOSYSTEMS, SIGNALS, type EcosystemId } from "../types.ts";
import type { Db } from "../db/open.ts";
import { sampleMembers } from "../db/schema.ts";
import { wilson, type Aggregate, type MatrixCell } from "../stages/aggregate.ts";
import { rankingPath } from "../stages/rank.ts";
import type { DrawRecord } from "../sample/draw.ts";
import { ECOSYSTEM_LABEL, SIGNAL_LABEL, intervalText, pctText } from "./labels.ts";
import { citeLinks } from "../sources/index.ts";
import { SAMPLE_NOTES } from "../facts/samples.ts";
import { outDir } from "../stages/aggregate.ts";

export interface Overlap {
  ecosystem: EcosystemId;
  top: number;
  random: number;
  both: number;
}

export function overlap(db: Db, snapshotId: string): Overlap[] {
  const rows = db.select().from(sampleMembers).where(eq(sampleMembers.snapshotId, snapshotId)).all();
  return ECOSYSTEMS.flatMap((ecosystem) => {
    const of = (layer: string) => new Set(rows.filter((r) => r.ecosystem === ecosystem && r.layer === layer).map((r) => r.packageName));
    const top = of("top");
    const random = of("random");
    if (top.size === 0 && random.size === 0) return [];
    return [{ ecosystem, top: top.size, random: random.size, both: [...random].filter((n) => top.has(n)).length }];
  });
}

/** The draw records the rank stage wrote, for the registries that have one. */
export async function drawRecords(db: Db, snapshotId: string): Promise<DrawRecord[]> {
  const ecosystems = new Set(
    db
      .selectDistinct({ ecosystem: sampleMembers.ecosystem })
      .from(sampleMembers)
      .where(and(eq(sampleMembers.snapshotId, snapshotId), eq(sampleMembers.layer, "random")))
      .all()
      .map((r) => r.ecosystem),
  );
  const out: DrawRecord[] = [];
  for (const e of ECOSYSTEMS.filter((x) => ecosystems.has(x))) {
    const f = Bun.file(rankingPath(e, snapshotId, "random"));
    if (await f.exists()) out.push(((await f.json()) as { draw: DrawRecord }).draw);
  }
  return out;
}

const cell = (c: MatrixCell | undefined) => {
  if (!c || c.n === 0) return "–";
  const bound = c.availability === "inferred" && c.u > 0 ? "≥ " : "";
  return `${bound}${pctText(c.pct)} ${intervalText(c.lo, c.hi)} (n=${c.n})`;
};

/** Cells whose adoption the registry reveals; the others have no share to compare. */
const measured = (agg: Aggregate) => agg.matrix.filter((c) => c.availability === "observable" || c.availability === "inferred");

export function layersMarkdown(top: Aggregate, random: Aggregate, overlaps: Overlap[], draws: DrawRecord[]): string {
  const randomCells = new Map(random.matrix.map((c) => [`${c.ecosystem}/${c.signal}`, c]));
  const rows = measured(top)
    .filter((c) => randomCells.has(`${c.ecosystem}/${c.signal}`))
    .sort((a, b) => SIGNALS.indexOf(a.signal) - SIGNALS.indexOf(b.signal) || ECOSYSTEMS.indexOf(a.ecosystem) - ECOSYSTEMS.indexOf(b.ecosystem))
    .map((c) => `| ${SIGNAL_LABEL[c.signal]} | ${ECOSYSTEM_LABEL[c.ecosystem]} | ${cell(c)} | ${cell(randomCells.get(`${c.ecosystem}/${c.signal}`))} |`);

  const score = (agg: Aggregate, e: EcosystemId) => {
    const s = agg.scores.find((x) => x.ecosystem === e);
    if (!s || s.assuranceLow == null) return "–";
    const hi = s.assuranceHigh != null && s.assuranceHigh - s.assuranceLow >= 0.005 ? `–${pctText(s.assuranceHigh)}` : "";
    return `${pctText(s.assuranceLow)}${hi} (n=${s.n})`;
  };
  const scored = ECOSYSTEMS.filter((e) => top.scores.some((s) => s.ecosystem === e) && random.scores.some((s) => s.ecosystem === e));

  return [
    `# Top and random samples — snapshot ${top.snapshotId}`,
    "",
    "The top sample answers what the most-used packages do; the random sample, drawn uniformly from each registry's",
    "*active* packages (a release in the 36 months before the snapshot), what a typical active package does. Both are",
    "measured by the same pipeline, so their shares compare directly. Brackets are 95% Wilson intervals. With",
    "7 registries × 7 signals × 2 samples, no per-cell significance test is made: where the intervals do not overlap,",
    "the difference is larger than sampling error. `≥` marks an inferred share, a lower bound an interval cannot repair.",
    "",
    "Full reports: [top sample](README.md) · [random sample](random/README.md).",
    "",
    "## Latest release, per signal",
    "",
    "| Signal | Platform | Top | Random |",
    "|---|---|---:|---:|",
    ...rows,
    "",
    "## Trust summary (assurance, latest release)",
    "",
    "| Platform | Top | Random |",
    "|---|---:|---:|",
    ...scored.map((e) => `| ${ECOSYSTEM_LABEL[e]} | ${score(top, e)} | ${score(random, e)} |`),
    "",
    "## Overlap",
    "",
    "A package drawn into both samples is measured once and counted in each.",
    "",
    "| Platform | Top | Random | In both |",
    "|---|---:|---:|---:|",
    ...overlaps.map((o) => `| ${ECOSYSTEM_LABEL[o.ecosystem]} | ${o.top} | ${o.random} | ${o.both} |`),
    "",
    "## The draw",
    "",
    "Names were shuffled with the seed and checked in order until the sample was full. The share of checked packages",
    "that were active estimates how much of each registry is active; names that turned out to be no package (gone,",
    "or not a valid name) are left out of it. The full record, every rejected name included, is",
    "[random/draw.json](random/draw.json).",
    "",
    "| Platform | Name list | Names listed | Checked | Not packages | Active | Active share | Seed |",
    "|---|---|---:|---:|---:|---:|---:|---|",
    ...draws.map((d) => {
      const packages = d.checked - (d.notPackages ?? 0);
      const [lo, hi] = wilson(d.accepted, packages) ?? [null, null];
      return `| ${ECOSYSTEM_LABEL[d.ecosystem]} | ${d.method} | ${d.listed} | ${d.checked} | ${d.notPackages ?? 0} | ${d.accepted} | ${packages ? pctText(d.accepted / packages) : "–"} ${intervalText(lo, hi)} | \`${d.seed}\` |`;
    }),
    "",
    "Quarter anchors of the random sample describe *today's* active packages in the past, not the registry as it was",
    "then: packages that stopped publishing before the window are not in the population. Spam packages are part of",
    "the population and stay in the sample.",
    "",
    "## Method and sources",
    "",
    ...SAMPLE_NOTES.filter((n) => !n.ecosystem || draws.some((d) => d.ecosystem === n.ecosystem)).map(
      (n) => `- **${n.label}**: ${n.note} ${citeLinks(n.sources, outDir(top.snapshotId))}`,
    ),
    "",
  ].join("\n");
}

export function layersCsv(top: Aggregate, random: Aggregate, csv: (header: string[], rows: unknown[][]) => string): string {
  const randomCells = new Map(random.matrix.map((c) => [`${c.ecosystem}/${c.signal}`, c]));
  return csv(
    ["ecosystem", "signal", "availability", "top_n", "top_true", "top_pct", "top_lo", "top_hi", "random_n", "random_true", "random_pct", "random_lo", "random_hi"],
    top.matrix.map((c) => {
      const r = randomCells.get(`${c.ecosystem}/${c.signal}`);
      return [c.ecosystem, c.signal, c.availability, c.n, c.t, c.pct, c.lo, c.hi, r?.n ?? null, r?.t ?? null, r?.pct ?? null, r?.lo ?? null, r?.hi ?? null];
    }),
  );
}

export function drawJson(snapshotId: string, draws: DrawRecord[]): string {
  return JSON.stringify({ snapshot_id: snapshotId, draws }, null, 2) + "\n";
}

export const LAYERS_FILES = { markdown: "layers.md", csv: "layers.csv", draw: join("random", "draw.json") };
