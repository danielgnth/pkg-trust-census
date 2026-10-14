/**
 * Report stage: renders `aggregate.json` plus the raw tables into the files a reader uses —
 * a paste-ready Markdown matrix, an at-a-glance run summary, CSVs, and SVG charts.
 *
 * Output goes to data/out/{snapshot}/ and is fully regenerable, so it is git-ignored.
 */

import { citeLinks, citeUrls } from "../sources/index.ts";
import { stringify } from "csv-stringify/sync";
import { and, asc, eq } from "drizzle-orm";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { ECOSYSTEMS, SIGNALS } from "../types.ts";
import type { Db } from "../db/open.ts";
import { packageVersions, packageWithdrawals, packages, versionSignals } from "../db/schema.ts";
import { CATEGORIES, aggregatePath, outDir, type Aggregate, type Score } from "./aggregate.ts";
import { adoptionSvg, baselineSvg, matrixSvg, measurable, policiesSvg, pqcSvg, publishAuthSvg, scoresSvg, sigstoreSvg, withdrawalsSvg } from "../report/charts.ts";
import { CATEGORY_LABEL, ECOSYSTEM_LABEL, NO_UPLOAD, PUBLISH_CREDENTIAL, SHARED_MECHANISM, SIGNAL_LABEL, WITHDRAWAL_BLIND, WITHDRAWAL_LABEL, cellText, pctSmall, pctText, pointsText } from "../report/labels.ts";
import { availabilityOf } from "../facts/index.ts";
import { BASELINE, BASELINE_PROPERTIES, BASELINE_VERIFIED, baselineOf, type BaselineFact } from "../facts/baseline.ts";
import { SIGSTORE, SIGSTORE_SIGNAL, bestClient, sigstoreOf, type SigstoreFact } from "../facts/sigstore.ts";
import { PQC, PQC_LAYERS, PQC_VERIFIED, pqcOf, type PqcStatus } from "../facts/pqc.ts";
import { POLICIES, POLICIES_VERIFIED, POLICY_PROPERTIES, policyOf } from "../facts/policies.ts";

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
    ["policies.md", policiesMarkdown(agg, true)],
    ["policies.csv", policiesCsv()],
    ["charts/policies.svg", policiesSvg(agg)],
    ["withdrawals.csv", withdrawalsCsv(db, snapshotId)],
    ["charts/withdrawals.svg", withdrawalsSvg(agg)],
    ["sigstore.md", sigstoreMarkdown(agg, true)],
    ["sigstore.csv", sigstoreCsv()],
    ["charts/sigstore.svg", sigstoreSvg(agg)],
    ["pqc.md", pqcMarkdown(agg, true)],
    ["pqc.csv", pqcCsv()],
    ["charts/pqc.svg", pqcSvg(agg)],
    ["score_series.csv", scoreSeriesCsv(agg)],
    ["charts/scores.svg", scoresSvg(agg)],
    ["timeseries.csv", seriesCsv(agg)],
    ["packages.csv", packagesCsv(db, snapshotId)],
    ["signals.csv", signalsCsv(db, snapshotId)],
    ["charts/matrix.svg", matrixSvg(agg)],
    ["charts/publish-auth.svg", publishAuthSvg(agg)],
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
    "Columns read from one mechanism move together and are not independent evidence. The trust score therefore",
    "groups signals into categories and counts each category once:",
    "",
    ...SHARED_MECHANISM.filter((g) => agg.matrix.some((c) => c.ecosystem === g.ecosystem)).map(
      (g) => `- **${ECOSYSTEM_LABEL[g.ecosystem]}**: ${g.signals.map((s) => SIGNAL_LABEL[s]).join(", ")} are ${g.signals.length === 2 ? "both" : "all"} read from ${g.mechanism}.`,
    ),
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
    publishAuthMarkdown(agg),
    baselineMarkdown(agg, false),
    policiesMarkdown(agg, false),
    withdrawalsMarkdown(agg),
    sigstoreMarkdown(agg, false),
    pqcMarkdown(agg, false),
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

/**
 * Trusted publishing against everything else: the identity signal's three values read as
 * OIDC, account credential and unknown, with what "credential" means per registry.
 */
export function publishAuthMarkdown(agg: Aggregate): string {
  const rows = ECOSYSTEMS.flatMap((e) => {
    const c = agg.matrix.find((m) => m.ecosystem === e && m.signal === "identity_publish");
    if (!c) return [];
    if (NO_UPLOAD.has(e)) return [`| **${ECOSYSTEM_LABEL[e]}** | – | – | – | ${PUBLISH_CREDENTIAL[e]} |`];
    const share = (k: number) => (c.n ? `${pctText(k / c.n)} (${k})` : "–");
    const bound = c.availability === "inferred" && c.u > 0 ? "≥ " : "";
    return [`| **${ECOSYSTEM_LABEL[e]}** | ${bound}${share(c.t)} | ${share(c.f)} | ${share(c.u)} | ${PUBLISH_CREDENTIAL[e]} |`];
  });
  return [
    `### How the latest releases were published (snapshot ${agg.snapshotId})`,
    "",
    "| Platform | Trusted publishing (OIDC) | Account credential | Unknown | Credential used otherwise |",
    "|---|---:|---:|---:|---|",
    ...rows,
    "",
    "No registry reveals whether a credential was long-lived, so \"account credential\" covers expiring tokens too",
    "(npm write tokens expire after at most 90 days since 2025-11).",
    "",
  ].join("\n");
}

export function scoresMarkdown(agg: Aggregate): string {
  const rows = [...agg.scores].sort((a, b) => (b.assuranceLow ?? 0) - (a.assuranceLow ?? 0));
  const first = agg.quarters[0];
  const range = (lo: number | null, hi: number | null) =>
    lo == null ? "–" : hi != null && hi - lo >= 0.005 ? `${pctText(lo)}–${pctText(hi)}` : pctText(lo);
  const level = (c: Score["categories"][number]) =>
    c.capability === 0 ? "— no mechanism" : range(c.assuranceLow, c.assuranceHigh);
  return [
    `### Trust summary per platform (snapshot ${agg.snapshotId})`,
    "",
    `| Platform | Capability | Auditable | Assurance (latest) | Assurance (${first ?? "first quarter"}) | ${CATEGORIES.map((c) => CATEGORY_LABEL[c.id]).join(" | ")} |`,
    `|---|---:|---:|---:|---:|${CATEGORIES.map(() => "---:").join("|")}|`,
    ...rows.map((r) => {
      const then = agg.scoreSeries.find((p) => p.quarter === first && p.ecosystem === r.ecosystem);
      return `| **${ECOSYSTEM_LABEL[r.ecosystem]}** | ${pointsText(r.capability)} | ${pointsText(r.auditable)} | ${range(r.assuranceLow, r.assuranceHigh)} | ${then ? range(then.assuranceLow, then.assuranceHigh) : "–"} | ${r.categories.map(level).join(" | ")} |`;
    }),
    "",
    "Three categories, each answered by the strongest signal a release has: 1 point for the strong level, ½ for",
    "the weak one. *Publisher authentication*: identity-bound publish (1) or enforced MFA (½). *Artifact",
    "authenticity*: publisher signature (1) or registry signature (½). *Source provenance*: SLSA provenance (1)",
    "or source link (½). Transparency log is reported in the matrix but not scored, because every Sigstore",
    "signature is logged and would count twice.",
    "",
    "*Capability*: the points the platform offers at all. *Auditable*: those the public API lets an outsider",
    "check. *Assurance*: the average share of the points a sampled package's release actually has; a range",
    "means some signals are unknown (low end counts them as absent, high end as present).",
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
      const links = citeLinks(b.sources);
      lines.push(`- ${ECOSYSTEM_LABEL[e]}: ${b.value}. ${b.note} ${links}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

const SIGSTORE_STATUS: Record<SigstoreFact["status"], string> = { yes: "✓ yes", planned: "◐ planned", no: "✗ no" };

/**
 * Which registries accept Sigstore bundles, who checks them, and the nearest equivalent
 * where there is none. Ecosystem-level and curated, like the baseline.
 */
export function sigstoreMarkdown(agg: Aggregate, withNotes: boolean): string {
  const ecosystems = ECOSYSTEMS.filter((e) => agg.scores.some((s) => s.ecosystem === e));
  const using = SIGSTORE.filter((s) => s.status === "yes" && ecosystems.includes(s.ecosystem));
  const lines = [
    `### Sigstore across registries (verified ${BASELINE_VERIFIED})`,
    "",
    `${using.length} of ${ecosystems.length} registries accept Sigstore bundles (${using.map((s) => ECOSYSTEM_LABEL[s.ecosystem]).join(", ")}), all logged in the`,
    "public Rekor instance. In the trust matrix each bundle counts as a publisher signature and a transparency-log entry.",
    "",
    "| | Sigstore | Since | Latest releases with a bundle | Registry verifies on upload | Best install client | Nearest equivalent |",
    "|---|---|---|---:|---|---|---|",
    ...ecosystems.map((e) => {
      const f = sigstoreOf(e);
      const c = agg.matrix.find((m) => m.ecosystem === e && m.signal === SIGSTORE_SIGNAL);
      const share = f.status === "yes" && c ? `${pctText(c.pct)} (${c.t}/${c.n})` : "–";
      const best = bestClient(f);
      const client = best.verifies === "n/a" ? "n/a" : `${best.verifies} (${best.client})`;
      return `| **${ECOSYSTEM_LABEL[e]}** | ${SIGSTORE_STATUS[f.status]} | ${f.since ?? "–"} | ${share} | ${f.registryVerifies} | ${client} | ${f.similar} |`;
    }),
    "",
    "No install client checks Sigstore bundles by default, including newer ones (uv, pnpm, Yarn, Bun, Gradle).",
    "The only check is npm's opt-in `npm audit signatures`, run after install.",
    "",
  ];
  if (!withNotes) return lines.join("\n");

  lines.push("#### What is signed, and sources", "");
  for (const e of ecosystems) {
    const f = sigstoreOf(e);
    const links = citeLinks(f.sources);
    lines.push(`- **${ECOSYSTEM_LABEL[e]}**: ${f.signs} ${links}`);
  }
  lines.push("", "#### Install clients", "", "| Ecosystem | Client | Checks bundles | Note |", "|---|---|---|---|");
  for (const e of ecosystems) {
    for (const c of sigstoreOf(e).clients) {
      lines.push(`| ${ECOSYSTEM_LABEL[e]} | ${c.client} | ${c.verifies} | ${c.note} ${citeLinks(c.sources)} |`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

const PQC_SYMBOL: Record<PqcStatus, string> = { safe: "✓", partial: "◐", vulnerable: "✗", weak: "⚠", "n/a": "–" };

/**
 * Post-quantum exposure per ecosystem and layer: which primitive each mechanism rests on,
 * and whether a cryptographically relevant quantum computer would break it.
 */
export function pqcMarkdown(agg: Aggregate, withNotes: boolean): string {
  const ecosystems = ECOSYSTEMS.filter((e) => agg.scores.some((s) => s.ecosystem === e));
  const lines = [
    `### Post-quantum exposure (verified ${PQC_VERIFIED}, TLS measured live)`,
    "",
    `| | ${PQC_LAYERS.map((l) => l.label).join(" | ")} |`,
    `|---|${PQC_LAYERS.map(() => "---").join("|")}|`,
    ...ecosystems.map((e) => `| **${ECOSYSTEM_LABEL[e]}** | ${PQC_LAYERS.map((l) => {
      const p = pqcOf(e, l.id);
      return p.status === "n/a" ? "–" : `${PQC_SYMBOL[p.status]} ${p.primitive}`;
    }).join(" | ")} |`),
    "",
    "✓ post-quantum safe (hash ≥ 256 bits or symmetric secret) · ◐ partly (hash-chained log with classical",
    "checkpoint signatures, hybrid TLS with classical certificates, TOTP beside WebAuthn) · ✗ broken by a quantum",
    "computer (RSA, ECDSA, EdDSA) · ⚠ weak already (SHA-1, MD5) · – not used.",
    "",
    "Every signature in every ecosystem is classical, Sigstore included (its ML-DSA instance is targeted for",
    "mid-2027). What is already post-quantum safe is the hashing: lockfile and index hashes everywhere except",
    "Maven (SHA-1) and Packagist (git SHA-1), and the Merkle trees under Rekor and sum.golang.org.",
    "",
  ];
  if (!withNotes) return lines.join("\n");

  lines.push("#### Notes and sources", "");
  for (const l of PQC_LAYERS) {
    lines.push(`**${l.label}**: ${l.question}`, "");
    for (const e of ecosystems) {
      const p = pqcOf(e, l.id);
      const links = citeLinks(p.sources);
      lines.push(`- ${ECOSYSTEM_LABEL[e]}: ${p.primitive} (${p.status}). ${p.note} ${links}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function pqcCsv(): string {
  return csv(
    ["ecosystem", "layer", "primitive", "status", "note", "sources"],
    PQC.map((p) => [p.ecosystem, p.layer, p.primitive, p.status, p.note, citeUrls(p.sources)]),
  );
}

function sigstoreCsv(): string {
  return csv(
    ["ecosystem", "status", "since", "registry_verifies", "best_client", "best_client_verifies", "clients", "signs", "similar", "sources"],
    SIGSTORE.map((s) => {
      const best = bestClient(s);
      const clients = s.clients.map((c) => `${c.client}: ${c.verifies}`).join("; ");
      return [s.ecosystem, s.status, s.since ?? null, s.registryVerifies, best.client, best.verifies, clients, s.signs, s.similar, citeUrls(s.sources)];
    }),
  );
}

/**
 * Governance (keeping malicious packages out) and containment (what happens after a bad
 * release), as registry rules. Ecosystem-level and curated, like the baseline.
 */
export function policiesMarkdown(agg: Aggregate, withNotes: boolean): string {
  const ecosystems = ECOSYSTEMS.filter((e) => agg.scores.some((s) => s.ecosystem === e));
  const cell = (b: { value: BaselineFact["value"]; since?: string }) => `${BASELINE_SYMBOL[b.value]}${b.since ? ` (since ${b.since})` : ""}`;
  const lines = [
    `### Registry governance and containment (verified ${POLICIES_VERIFIED})`,
    "",
    `| | ${POLICY_PROPERTIES.map((p) => p.label).join(" | ")} |`,
    `|---|${POLICY_PROPERTIES.map(() => "---").join("|")}|`,
    ...ecosystems.map((e) => `| **${ECOSYSTEM_LABEL[e]}** | ${POLICY_PROPERTIES.map((p) => cell(policyOf(e, p.id))).join(" | ")} |`),
    "",
    "What each column asks:",
    "",
    ...POLICY_PROPERTIES.map((p) => `- **${p.label}** (${p.group}): ${p.question}`),
    "",
  ];
  if (!withNotes) return lines.join("\n");

  lines.push("#### Notes and sources", "");
  for (const p of POLICY_PROPERTIES) {
    lines.push(`**${p.label}**`, "");
    for (const e of ecosystems) {
      const b = policyOf(e, p.id);
      const links = citeLinks(b.sources);
      lines.push(`- ${ECOSYSTEM_LABEL[e]}: ${b.value}${b.since ? ` (since ${b.since})` : ""}. ${b.note} ${links}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** How often each withdrawal mechanism was used in the sample. */
export function withdrawalsMarkdown(agg: Aggregate): string {
  const ecosystems = ECOSYSTEMS.filter((e) => agg.scores.some((s) => s.ecosystem === e));
  const cells = agg.withdrawals ?? [];
  const rows = ecosystems.flatMap((e) => {
    const mine = cells.filter((c) => c.ecosystem === e);
    if (!mine.length) return [`| **${ECOSYSTEM_LABEL[e]}** | – | – | – | ${WITHDRAWAL_BLIND[e] ?? "no withdrawal data"} |`];
    return mine.map((c) => {
      const share = c.packages ? `${pctText(c.packagesWithdrawing / c.packages)} (${c.packagesWithdrawing}/${c.packages})` : "–";
      const versions = c.versionsInWindow ? `${pctSmall(c.withdrawnVersions / c.versionsInWindow)} (${c.withdrawnVersions}/${c.versionsInWindow})` : `${c.withdrawnVersions}`;
      return `| **${ECOSYSTEM_LABEL[e]}** | ${WITHDRAWAL_LABEL[c.kind]} | ${share} | ${versions} | |`;
    });
  });
  const since = (agg.withdrawalWindowStart ?? agg.asOf).slice(0, 10);
  return [
    `### Withdrawn versions since ${since} (snapshot ${agg.snapshotId})`,
    "",
    "| Platform | Mechanism | Packages withdrawing ≥ 1 version | Withdrawn versions | Why no data |",
    "|---|---|---:|---:|---|",
    ...rows,
    "",
    "Counted over versions published in the window; Go's retractions are undated and counted over each module's",
    "history. Per-package rows, with the version numbers, are in `withdrawals.csv`.",
    "",
  ].join("\n");
}

function withdrawalsCsv(db: Db, snapshotId: string): string {
  const rows = db
    .select()
    .from(packageWithdrawals)
    .where(eq(packageWithdrawals.snapshotId, snapshotId))
    .orderBy(asc(packageWithdrawals.ecosystem), asc(packageWithdrawals.packageName), asc(packageWithdrawals.kind))
    .all();
  return csv(
    ["ecosystem", "package", "kind", "versions_in_window", "withdrawn_count", "withdrawn_versions"],
    rows.map((r) => [r.ecosystem, r.packageName, r.kind, r.versionsInWindow, r.withdrawnCount, r.withdrawnVersions]),
  );
}

function policiesCsv(): string {
  return csv(
    ["ecosystem", "property", "group", "value", "since", "note", "sources"],
    POLICIES.map((b) => [b.ecosystem, b.property, POLICY_PROPERTIES.find((p) => p.id === b.property)!.group, b.value, b.since ?? null, b.note, citeUrls(b.sources)]),
  );
}

function baselineCsv(): string {
  return csv(
    ["ecosystem", "property", "value", "since", "note", "sources"],
    BASELINE.map((b) => [b.ecosystem, b.property, b.value, b.since ?? null, b.note, citeUrls(b.sources)]),
  );
}

function scoresCsv(agg: Aggregate): string {
  return csv(
    ["ecosystem", "capability", "auditable", "assurance_low", "assurance_high", "n", ...CATEGORIES.flatMap((c) => [`${c.id}_low`, `${c.id}_high`])],
    agg.scores.map((s) => [
      s.ecosystem, s.capability, s.auditable, s.assuranceLow, s.assuranceHigh, s.n,
      ...s.categories.flatMap((c) => [c.assuranceLow, c.assuranceHigh]),
    ]),
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
      responses: versionSignals.responses,
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
    // A value can rest on several responses (Maven's `.asc` and `.sigstore.json`); they are space-separated, in the same order.
    ["ecosystem", "package", "version", "published_at", "is_latest", "quarter_anchor", "signal", "value", "evidence", "signal_source", "response_urls", "response_sha256s"],
    rows.map((r) => [
      r.ecosystem, r.packageName, r.version, r.publishedAt, r.isLatest, r.quarterAnchor, r.signal, r.value, r.evidence, r.source,
      r.responses.map((x) => x.url).join(" "),
      r.responses.map((x) => x.sha256).join(" "),
    ]),
  );
}

/** RFC 4180 CSV. Non-integers keep four decimals; booleans stay `true`/`false`. */
export function csv(header: string[], rows: unknown[][]): string {
  return stringify([header, ...rows], {
    cast: {
      number: (v) => (Number.isInteger(v) ? String(v) : v.toFixed(4)),
      boolean: (v) => String(v),
    },
  });
}
