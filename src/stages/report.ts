/**
 * Report stage: renders `aggregate.json` plus the raw tables into the files a reader uses —
 * a paste-ready Markdown matrix, an at-a-glance run summary, CSVs, and SVG charts.
 *
 * Output goes to data/out/{snapshot}/ and is fully regenerable, so it is git-ignored.
 */

import { and, asc, eq } from "drizzle-orm";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { ECOSYSTEMS, SIGNALS } from "../types.ts";
import type { Db } from "../db/open.ts";
import { packageVersions, packages, versionSignals } from "../db/schema.ts";
import { aggregatePath, outDir, type Aggregate } from "./aggregate.ts";
import { adoptionSvg, baselineSvg, matrixSvg, measurable, scoresSvg } from "../report/charts.ts";
import { ECOSYSTEM_LABEL, SIGNAL_LABEL, cellText, pctText } from "../report/labels.ts";
import { availabilityOf } from "../facts/index.ts";
import { BASELINE, BASELINE_PROPERTIES, BASELINE_VERIFIED, baselineOf, type BaselineFact } from "../facts/baseline.ts";

export interface ReportResult {
  dir: string;
  files: string[];
}

export async function runReport(db: Db, snapshotId: string): Promise<ReportResult> {
  const file = Bun.file(aggregatePath(snapshotId));
  if (!(await file.exists())) throw new Error(`no aggregate for ${snapshotId} — run \`aggregate\` first`);
  const agg = (await file.json()) as Aggregate;

  const dir = outDir(snapshotId);
  await mkdir(join(dir, "charts"), { recursive: true });
  const files: Array<[string, string]> = [
    ["matrix.md", matrixMarkdown(agg)],
    ["summary.md", summaryMarkdown(agg)],
    ["matrix.csv", matrixCsv(agg)],
    ["scores.csv", scoresCsv(agg)],
    ["baseline.md", baselineMarkdown(agg, true)],
    ["baseline.csv", baselineCsv()],
    ["charts/baseline.svg", baselineSvg(agg)],
    ["score_series.csv", scoreSeriesCsv(agg)],
    ["charts/scores.svg", scoresSvg(agg)],
    ["timeseries.csv", seriesCsv(agg)],
    ["packages.csv", packagesCsv(db, snapshotId)],
    ["signals.csv", signalsCsv(db, snapshotId)],
    ["charts/matrix.svg", matrixSvg(agg)],
    ...SIGNALS.map((s): [string, string] => [`charts/adoption-${s}.svg`, adoptionSvg(agg, s)]),
  ];

  for (const [name, body] of files) await Bun.write(join(dir, name), body);
  return { dir, files: files.map(([name]) => name) };
}

export function matrixMarkdown(agg: Aggregate): string {
  const ecosystems = ECOSYSTEMS.filter((e) => agg.matrix.some((c) => c.ecosystem === e));
  const header = `| | ${SIGNALS.map((s) => SIGNAL_LABEL[s]).join(" | ")} |`;
  const rule = `|---|${SIGNALS.map(() => "---").join("|")}|`;
  const rows = ecosystems.map((e) => {
    const cells = SIGNALS.map((s) => {
      const c = agg.matrix.find((m) => m.ecosystem === e && m.signal === s);
      return c ? cellText(c) : "";
    });
    return `| **${ECOSYSTEM_LABEL[e]}** | ${cells.join(" | ")} |`;
  });

  return [
    `### Trust-signal adoption among top packages, latest version (snapshot ${agg.snapshotId})`,
    "",
    header,
    rule,
    ...rows,
    "",
    "Percentages are true / all sampled packages with an extracted latest version, so `unknown` counts as not adopted.",
    "`≥` marks an inferred signal, where the figure is a lower bound. *No mechanism*: the ecosystem has no such",
    "feature. *Not exposed*: the feature exists but the registry's public API does not reveal who uses it.",
    "*Mandatory*: required registry-wide by policy.",
    "",
    "Inferred cells, and what they are inferred from:",
    "",
    ...agg.matrix
      .filter((c) => c.availability === "inferred")
      .map((c) => {
        const f = availabilityOf(c.ecosystem, c.signal);
        return `- **${ECOSYSTEM_LABEL[c.ecosystem]} · ${SIGNAL_LABEL[c.signal]}**: ${f.detectionMethod}.${f.notes ? ` ${f.notes}` : ""}`;
      }),
    "",
  ].join("\n");
}

export function summaryMarkdown(agg: Aggregate): string {
  const cov = agg.coverage;
  const sampled = cov.reduce((a, c) => a + c.sampled, 0);
  const extracted = cov.reduce((a, c) => a + c.extracted, 0);
  const failed = sampled - extracted;
  const rate = sampled ? failed / sampled : 0;

  const coverageRows = cov.map(
    (c) =>
      `| ${ECOSYSTEM_LABEL[c.ecosystem]} | ${c.rankFrame} | ${c.sampled} | ${c.fetched} | ${c.fetchErrors} | ${c.extracted} | ${c.extractErrors} |`,
  );

  // Headline: the latest-version figure for every measurable cell, with its 2024Q1 value.
  const first = agg.quarters[0];
  const headlines: string[] = [];
  for (const s of SIGNALS) {
    for (const e of measurable(agg, s)) {
      const c = agg.matrix.find((m) => m.ecosystem === e && m.signal === s)!;
      const then = agg.series.find((p) => p.quarter === first && p.ecosystem === e && p.signal === s);
      headlines.push(
        `| ${SIGNAL_LABEL[s]} | ${ECOSYSTEM_LABEL[e]} | ${c.availability} | ${pctText(c.pct)} | ${c.u} | ${then ? `${pctText(then.pct)} (n=${then.n})` : "–"} |`,
      );
    }
  }

  return [
    `# Run summary — snapshot ${agg.snapshotId}`,
    "",
    `As of ${agg.asOf} · generated ${agg.generatedAt}`,
    "",
    `**${extracted}/${sampled} packages extracted · error rate ${(rate * 100).toFixed(1)}%** ${rate < 0.05 ? "(within the < 5% target)" : "(**above the 5% target** — review errors before using these numbers)"}`,
    "",
    "## Coverage",
    "",
    "| Ecosystem | Ranked by | Sampled | Fetched | Fetch errors | Extracted | Extract errors |",
    "|---|---|---:|---:|---:|---:|---:|",
    ...coverageRows,
    "",
    scoresMarkdown(agg),
    baselineMarkdown(agg, false),
    "## Headline numbers",
    "",
    `Latest version, against the ${first ?? "first"} quarter anchor. Cells with no mechanism or not exposed are omitted; see matrix.md.`,
    "",
    "| Signal | Ecosystem | Availability | Latest | Unknown | " + (first ?? "First quarter") + " |",
    "|---|---|---|---:|---:|---:|",
    ...headlines,
    "",
    matrixMarkdown(agg),
  ].join("\n");
}

export function scoresMarkdown(agg: Aggregate): string {
  const rows = [...agg.scores].sort((a, b) => (b.assuranceLow ?? 0) - (a.assuranceLow ?? 0));
  const first = agg.quarters[0];
  return [
    `### Trust summary per platform (snapshot ${agg.snapshotId})`,
    "",
    `| Platform | Capability | Auditable | Assurance (latest) | Assurance (${first ?? "first quarter"}) |`,
    "|---|---:|---:|---:|---:|",
    ...rows.map((r) => {
      const then = agg.scoreSeries.find((p) => p.quarter === first && p.ecosystem === r.ecosystem);
      const range = (lo: number | null, hi: number | null) =>
        lo == null ? "–" : hi != null && hi - lo >= 0.005 ? `${pctText(lo)}–${pctText(hi)}` : pctText(lo);
      return `| **${ECOSYSTEM_LABEL[r.ecosystem]}** | ${r.offered}/${r.total} | ${r.auditable}/${r.total} | ${range(r.assuranceLow, r.assuranceHigh)} | ${then ? range(then.assuranceLow, then.assuranceHigh) : "–"} |`;
    }),
    "",
    "*Capability*: how many of the seven properties the platform offers at all. *Auditable*: how many of those",
    "the public API lets an outsider check. *Assurance*: the average share of the seven properties a sampled",
    "package's release actually has; a range means some properties are unknown (low end counts them as absent,",
    "high end as present). All properties weigh equally.",
    "",
  ].join("\n");
}

const BASELINE_SYMBOL: Record<BaselineFact["value"], string> = { yes: "✓ yes", partial: "◐ partial", no: "✗ no", "n/a": "– n/a" };

/**
 * The registry baseline: what each ecosystem's default toolchain does against tampering and
 * bad releases. Ecosystem-level and curated, so it is not part of the per-package score.
 */
export function baselineMarkdown(agg: Aggregate, withNotes: boolean): string {
  const ecosystems = ECOSYSTEMS.filter((e) => agg.scores.some((s) => s.ecosystem === e));
  const cell = (b: BaselineFact) => `${BASELINE_SYMBOL[b.value]}${b.since ? ` (since ${b.since})` : ""}`;
  const lines = [
    `### Registry baseline (default toolchain, verified ${BASELINE_VERIFIED})`,
    "",
    `| | ${BASELINE_PROPERTIES.map((p) => p.label).join(" | ")} |`,
    `|---|${BASELINE_PROPERTIES.map(() => "---").join("|")}|`,
    ...ecosystems.map(
      (e) => `| **${ECOSYSTEM_LABEL[e]}** | ${BASELINE_PROPERTIES.map((p) => cell(baselineOf(e, p.id))).join(" | ")} |`,
    ),
    "",
    "What each column asks:",
    "",
    ...BASELINE_PROPERTIES.map((p) => `- **${p.label}**: ${p.question}`),
    "",
    "Protections against tampering and bad releases, complementing the trust score, which measures whether",
    "an outsider can verify who published a release and from what source. Not part of the score: these",
    "describe ecosystem defaults, not the sampled packages. *since* marks a value that changed recently,",
    "so the backfill quarters predate it.",
    "",
  ];
  if (!withNotes) return lines.join("\n");

  lines.push("#### Notes and sources", "");
  for (const p of BASELINE_PROPERTIES) {
    lines.push(`**${p.label}**`, "");
    for (const e of ecosystems) {
      const b = baselineOf(e, p.id);
      const links = b.sources.map((u, i) => `[${i + 1}](${u})`).join(" ");
      lines.push(`- ${ECOSYSTEM_LABEL[e]}: ${b.value}. ${b.note} ${links}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function baselineCsv(): string {
  return csv(
    ["ecosystem", "property", "value", "since", "note", "sources"],
    BASELINE.map((b) => [b.ecosystem, b.property, b.value, b.since ?? null, b.note, b.sources.join(" ")]),
  );
}

function scoresCsv(agg: Aggregate): string {
  return csv(
    ["ecosystem", "offered", "auditable", "total", "capability", "assurance_low", "assurance_high", "n"],
    agg.scores.map((s) => [s.ecosystem, s.offered, s.auditable, s.total, s.capability, s.assuranceLow, s.assuranceHigh, s.n]),
  );
}

function scoreSeriesCsv(agg: Aggregate): string {
  return csv(
    ["quarter", "ecosystem", "assurance_low", "assurance_high", "n"],
    agg.scoreSeries.map((p) => [p.quarter, p.ecosystem, p.assuranceLow, p.assuranceHigh, p.n]),
  );
}

function matrixCsv(agg: Aggregate): string {
  return csv(
    ["ecosystem", "signal", "availability", "mandatory", "n", "true", "false", "unknown", "pct", "pct_known"],
    agg.matrix.map((c) => [c.ecosystem, c.signal, c.availability, c.mandatory, c.n, c.t, c.f, c.u, c.pct, c.pctKnown]),
  );
}

function seriesCsv(agg: Aggregate): string {
  return csv(
    ["quarter", "ecosystem", "signal", "n", "true", "false", "unknown", "pct", "pct_known"],
    agg.series.map((p) => [p.quarter, p.ecosystem, p.signal, p.n, p.t, p.f, p.u, p.pct, p.pctKnown]),
  );
}

function packagesCsv(db: Db, snapshotId: string): string {
  const rows = db
    .select()
    .from(packages)
    .where(eq(packages.snapshotId, snapshotId))
    .orderBy(asc(packages.ecosystem), asc(packages.rank))
    .all();
  return csv(
    [
      "ecosystem", "package", "rank", "rank_frame", "download_count", "dependent_count", "latest_version",
      "latest_publish_date", "maintainer_count", "maintainer_count_source", "repository_url", "fetch_error", "extract_error",
    ],
    rows.map((r) => [
      r.ecosystem, r.packageName, r.rank, r.rankFrame, r.downloadCount, r.dependentCount, r.latestVersion,
      r.latestPublishDate, r.maintainerCount, r.maintainerCountSource, r.repositoryUrl, r.fetchError, r.extractError,
    ]),
  );
}

function signalsCsv(db: Db, snapshotId: string): string {
  const rows = db
    .select({
      ecosystem: versionSignals.ecosystem,
      packageName: versionSignals.packageName,
      version: versionSignals.version,
      publishedAt: packageVersions.publishedAt,
      isLatest: packageVersions.isLatest,
      quarterAnchor: packageVersions.quarterAnchor,
      signal: versionSignals.signalId,
      value: versionSignals.value,
      evidence: versionSignals.evidence,
      source: versionSignals.signalSource,
      rawSha256: packageVersions.rawSha256,
    })
    .from(versionSignals)
    .innerJoin(
      packageVersions,
      and(
        eq(versionSignals.snapshotId, packageVersions.snapshotId),
        eq(versionSignals.ecosystem, packageVersions.ecosystem),
        eq(versionSignals.packageName, packageVersions.packageName),
        eq(versionSignals.version, packageVersions.version),
      ),
    )
    .where(eq(versionSignals.snapshotId, snapshotId))
    .orderBy(asc(versionSignals.ecosystem), asc(versionSignals.packageName), asc(packageVersions.publishedAt))
    .all();
  return csv(
    ["ecosystem", "package", "version", "published_at", "is_latest", "quarter_anchor", "signal", "value", "evidence", "signal_source", "raw_sha256"],
    rows.map((r) => [r.ecosystem, r.packageName, r.version, r.publishedAt, r.isLatest, r.quarterAnchor, r.signal, r.value, r.evidence, r.source, r.rawSha256]),
  );
}

/** RFC 4180: quote fields containing a comma, quote or newline; double embedded quotes. */
export function csv(header: string[], rows: unknown[][]): string {
  const cell = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(4)) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\n") + "\n";
}
