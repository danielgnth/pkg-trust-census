/**
 * Static SVG figures for the paper: the maturity heatmap and one adoption-over-time chart
 * per signal. Hand-written SVG, no dependencies, plain hex attributes rather than CSS
 * variables so the files survive conversion to PDF (rsvg, Inkscape) for LaTeX.
 *
 * Light mode only, deliberately: these are print figures. Each mark carries a <title>
 * so a browser shows the exact counts on hover, and the same numbers are in the CSVs.
 */

import { ECOSYSTEMS, SIGNALS, type EcosystemId, type SignalId } from "../types.ts";
import type { Aggregate, MatrixCell, Score } from "../stages/aggregate.ts";
import { ECOSYSTEM_LABEL, SIGNAL_LABEL, humanDate, humanMonth, pctText } from "./labels.ts";
import { BASELINE_PROPERTIES, BASELINE_VERIFIED, baselineOf, type BaselineValue } from "../facts/baseline.ts";
import { SIGSTORE_SIGNAL, bestClient, sigstoreOf, type SigstoreFact } from "../facts/sigstore.ts";
import { PQC_LAYERS, PQC_VERIFIED, pqcOf, type PqcStatus } from "../facts/pqc.ts";

const FONT = "system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const SURFACE = "#fcfcfb";
const INK = "#0b0b0b";
const INK_2 = "#52514e";
const MUTED = "#8a8984";
const GRID = "#e6e5e1";
const NEUTRAL = "#f0efec";

/** Sequential blue, steps 100 → 700. */
const RAMP = ["#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b"];

/**
 * Categorical slots in fixed order, one per ecosystem, so an ecosystem keeps its colour
 * in every chart regardless of which others are present. Validated (light surface):
 * worst adjacent CVD ΔE 9.1, normal-vision ΔE 19.6. Three slots sit below 3:1 contrast,
 * so every chart carries a legend and direct end labels.
 */
const SERIES: Record<EcosystemId, string> = {
  pypi: "#2a78d6",
  npm: "#eb6834",
  crates: "#1baf7a",
  rubygems: "#eda100",
  go: "#e87ba4",
  maven: "#008300",
  packagist: "#4a3aa7",
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function rampColor(p: number): string {
  return RAMP[Math.min(RAMP.length - 1, Math.round(p * (RAMP.length - 1)))]!;
}

/** White text on the darker half of the ramp, ink on the lighter half. */
function inkOn(p: number): string {
  return Math.round(p * (RAMP.length - 1)) >= 6 ? "#ffffff" : INK;
}

const HATCH = `<pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="${NEUTRAL}"/><line x1="0" y1="0" x2="0" y2="6" stroke="#c9c8c2" stroke-width="2"/></pattern>`;

export function matrixSvg(agg: Aggregate): string {
  const ecosystems = ECOSYSTEMS.filter((e) => agg.matrix.some((c) => c.ecosystem === e));
  const cellW = 128;
  const cellH = 50;
  const gap = 2;
  const left = 120;
  const top = 76;
  const legendH = 78;
  const width = left + SIGNALS.length * (cellW + gap) + 32;
  const height = top + ecosystems.length * (cellH + gap) + legendH;
  const parts: string[] = [];

  parts.push(
    `<text x="16" y="24" font-size="15" font-weight="600" fill="${INK}">Trust-signal adoption, latest version</text>`,
    `<text x="16" y="42" font-size="11" fill="${INK_2}">Share of sampled packages whose latest release carries the signal · snapshot ${esc(humanDate(agg.asOf))}</text>`,
  );

  SIGNALS.forEach((s, j) => {
    const x = left + j * (cellW + gap) + cellW / 2;
    parts.push(`<text x="${x}" y="${top - 8}" font-size="11" font-weight="600" fill="${INK_2}" text-anchor="middle">${esc(SIGNAL_LABEL[s])}</text>`);
  });

  ecosystems.forEach((e, i) => {
    const y = top + i * (cellH + gap);
    parts.push(`<text x="${left - 10}" y="${y + cellH / 2 + 4}" font-size="12" fill="${INK}" text-anchor="end">${esc(ECOSYSTEM_LABEL[e])}</text>`);
    SIGNALS.forEach((s, j) => {
      const c = agg.matrix.find((m) => m.ecosystem === e && m.signal === s);
      if (c) parts.push(matrixCell(c, left + j * (cellW + gap), y, cellW, cellH));
    });
  });

  // Legend: the ramp, then the two non-measurable cell styles.
  const ly = top + ecosystems.length * (cellH + gap) + 22;
  const rampW = 180;
  RAMP.forEach((c, k) => {
    parts.push(`<rect x="${left + (k * rampW) / RAMP.length}" y="${ly}" width="${rampW / RAMP.length + 0.5}" height="10" fill="${c}"/>`);
  });
  parts.push(
    `<text x="${left}" y="${ly + 24}" font-size="10" fill="${INK_2}">0%</text>`,
    `<text x="${left + rampW}" y="${ly + 24}" font-size="10" fill="${INK_2}" text-anchor="end">100%</text>`,
    `<rect x="${left + rampW + 28}" y="${ly}" width="14" height="10" fill="${NEUTRAL}"/>`,
    `<text x="${left + rampW + 48}" y="${ly + 9}" font-size="10" fill="${INK_2}">no mechanism</text>`,
    `<rect x="${left + rampW + 136}" y="${ly}" width="14" height="10" fill="url(#hatch)"/>`,
    `<text x="${left + rampW + 156}" y="${ly + 9}" font-size="10" fill="${INK_2}">not exposed by registry</text>`,
    `<text x="${left}" y="${ly + 44}" font-size="10" fill="${MUTED}">≥ marks an inferred signal: unknowns count as not adopted, so the figure is a lower bound.</text>`,
  );

  return svg(width, height, parts.join("\n"), HATCH);
}

function matrixCell(c: MatrixCell, x: number, y: number, w: number, h: number): string {
  const title = `${ECOSYSTEM_LABEL[c.ecosystem]} · ${SIGNAL_LABEL[c.signal]}: ${c.availability}${c.mandatory ? ", mandatory" : ""} · true ${c.t}, false ${c.f}, unknown ${c.u} of ${c.n}`;
  const cx = x + w / 2;
  if (c.availability === "no_mechanism" || c.availability === "not_exposed" || c.n === 0 || c.pct == null) {
    const fill = c.availability === "not_exposed" ? "url(#hatch)" : NEUTRAL;
    const label = c.availability === "no_mechanism" ? "no mechanism" : c.availability === "not_exposed" ? "not exposed" : "no data";
    return `<g><title>${esc(title)}</title><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${fill}"/><text x="${cx}" y="${y + h / 2 + 4}" font-size="11" fill="${INK_2}" text-anchor="middle">${label}</text></g>`;
  }
  const ink = inkOn(c.pct);
  const bound = c.availability === "inferred" && c.u > 0 ? "≥ " : "";
  const sub = `${c.t}/${c.n}${c.mandatory ? " · mandatory" : ""}`;
  return [
    `<g><title>${esc(title)}</title>`,
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${rampColor(c.pct)}"/>`,
    `<text x="${cx}" y="${y + 23}" font-size="14" font-weight="600" fill="${ink}" text-anchor="middle">${bound}${pctText(c.pct)}</text>`,
    `<text x="${cx}" y="${y + 38}" font-size="10" fill="${ink}" text-anchor="middle" opacity="0.85">${esc(sub)}</text>`,
    `</g>`,
  ].join("");
}

/**
 * Baseline values are ordinal, so they take steps of the same sequential blue as the
 * matrix: "yes" darkest, "partial" mid. "No" and "n/a" stay off the ramp, as the matrix's
 * no-mechanism and not-exposed cells do. Every cell also prints its value, so the reading
 * never depends on colour.
 */
const BASELINE_STYLE: Record<BaselineValue, { fill: string; ink: string; label: string }> = {
  yes: { fill: RAMP[9]!, ink: "#ffffff", label: "yes" },
  partial: { fill: RAMP[4]!, ink: INK, label: "partial" },
  no: { fill: NEUTRAL, ink: INK_2, label: "no" },
  "n/a": { fill: "url(#hatch)", ink: INK_2, label: "n/a" },
};

/** Splits a header into at most two lines at the space nearest the middle. */
function twoLines(text: string): string[] {
  if (text.length <= 16) return [text];
  const spaces = [...text.matchAll(/ /g)].map((m) => m.index!);
  if (spaces.length === 0) return [text];
  const cut = spaces.reduce((best, i) => (Math.abs(i - text.length / 2) < Math.abs(best - text.length / 2) ? i : best));
  return [text.slice(0, cut), text.slice(cut + 1)];
}

/**
 * The registry baseline as a grid: ecosystem × property, one categorical value per cell.
 * Ecosystem-level and curated, so the subtitle says so, and the hover title carries the note.
 */
export function baselineSvg(agg: Aggregate): string {
  const ecosystems = ECOSYSTEMS.filter((e) => agg.scores.some((s) => s.ecosystem === e));
  const cellW = 128;
  const cellH = 44;
  const gap = 2;
  const left = 120;
  const top = 94;
  const legendH = 66;
  const width = left + BASELINE_PROPERTIES.length * (cellW + gap) + 32;
  const height = top + ecosystems.length * (cellH + gap) + legendH;
  const parts: string[] = [
    `<text x="16" y="24" font-size="15" font-weight="600" fill="${INK}">Registry baseline: what the default toolchain protects</text>`,
    `<text x="16" y="42" font-size="11" fill="${INK_2}">Ecosystem defaults from primary sources, verified ${esc(humanDate(BASELINE_VERIFIED, true))} · not part of the trust score · snapshot ${esc(humanDate(agg.asOf))}</text>`,
  ];

  BASELINE_PROPERTIES.forEach((p, j) => {
    const x = left + j * (cellW + gap) + cellW / 2;
    const lines = twoLines(p.label);
    lines.forEach((line, k) => {
      const y = top - 10 - (lines.length - 1 - k) * 13;
      parts.push(`<text x="${x}" y="${y}" font-size="11" font-weight="600" fill="${INK_2}" text-anchor="middle"><title>${esc(p.question)}</title>${esc(line)}</text>`);
    });
  });

  ecosystems.forEach((e, i) => {
    const y = top + i * (cellH + gap);
    parts.push(`<text x="${left - 10}" y="${y + cellH / 2 + 4}" font-size="12" fill="${INK}" text-anchor="end">${esc(ECOSYSTEM_LABEL[e])}</text>`);
    BASELINE_PROPERTIES.forEach((p, j) => {
      const b = baselineOf(e, p.id);
      const st = BASELINE_STYLE[b.value];
      const x = left + j * (cellW + gap);
      const cx = x + cellW / 2;
      const since = b.since ? `since ${humanMonth(b.since)}` : null;
      const title = `${ECOSYSTEM_LABEL[e]} · ${p.label}: ${b.value}${since ? ` (${since})` : ""}. ${b.note}`;
      parts.push(
        `<g><title>${esc(title)}</title>`,
        `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="4" fill="${st.fill}"/>`,
        `<text x="${cx}" y="${y + (since ? 20 : 26)}" font-size="13" font-weight="600" fill="${st.ink}" text-anchor="middle">${st.label}</text>`,
        since ? `<text x="${cx}" y="${y + 34}" font-size="10" fill="${st.ink}" text-anchor="middle" opacity="0.85">${esc(since)}</text>` : "",
        `</g>`,
      );
    });
  });

  // Legend: one swatch per value, in reading order.
  const ly = top + ecosystems.length * (cellH + gap) + 22;
  let lx = left;
  for (const v of ["yes", "partial", "no", "n/a"] as const) {
    const st = BASELINE_STYLE[v];
    parts.push(
      // The off-ramp swatches are close to the surface, so they get an outline.
      `<rect x="${lx}" y="${ly}" width="14" height="10" rx="2" fill="${st.fill}"${v === "no" || v === "n/a" ? ` stroke="#c9c8c2" stroke-width="1"` : ""}/>`,
      `<text x="${lx + 20}" y="${ly + 9}" font-size="10" fill="${INK_2}">${st.label}</text>`,
    );
    lx += 34 + st.label.length * 6;
  }
  parts.push(
    `<text x="${left}" y="${ly + 30}" font-size="10" fill="${MUTED}">"since" marks a value that changed recently, so the backfill quarters predate it. Hover a cell for the note; sources in baseline.md.</text>`,
  );

  return svg(width, height, parts.join("\n"), HATCH);
}

/**
 * Sigstore per registry: three policy cells (accepts bundles, registry checks them, the best
 * any install client does) and one bar, the share of sampled latest releases that carry a
 * bundle. Registries without Sigstore show their nearest equivalent in place of the bar.
 * Rows run from earliest adopter to none, so the order reads as a timeline.
 */
export function sigstoreSvg(agg: Aggregate): string {
  const rank = (f: SigstoreFact) => (f.status === "yes" ? 0 : f.status === "planned" ? 1 : 2);
  const ecosystems = ECOSYSTEMS.filter((e) => agg.scores.some((s) => s.ecosystem === e)).sort((a, b) => {
    const fa = sigstoreOf(a);
    const fb = sigstoreOf(b);
    return rank(fa) - rank(fb) || (fa.since ?? "").localeCompare(fb.since ?? "");
  });
  const cellW = 120;
  const cellH = 44;
  const gap = 2;
  const left = 120;
  const top = 94;
  const barX = left + 3 * (cellW + gap) + 22;
  const barW = 240;
  const width = barX + barW + 110;
  const height = top + ecosystems.length * (cellH + gap) + 66;
  const parts: string[] = [
    `<text x="16" y="24" font-size="15" font-weight="600" fill="${INK}">Sigstore across registries</text>`,
    `<text x="16" y="42" font-size="11" fill="${INK_2}">Who accepts Sigstore bundles, who checks them, and how many top packages ship one · snapshot ${esc(humanDate(agg.asOf))}</text>`,
  ];

  const headers = ["Accepts bundles", "Registry checks at upload", "Best install client"];
  headers.forEach((h, j) => {
    const lines = twoLines(h);
    lines.forEach((line, k) => {
      parts.push(`<text x="${left + j * (cellW + gap) + cellW / 2}" y="${top - 10 - (lines.length - 1 - k) * 13}" font-size="11" font-weight="600" fill="${INK_2}" text-anchor="middle">${esc(line)}</text>`);
    });
  });
  parts.push(
    `<text x="${barX}" y="${top - 23}" font-size="11" font-weight="600" fill="${INK_2}">Latest releases with a bundle</text>`,
    `<text x="${barX}" y="${top - 10}" font-size="11" fill="${MUTED}">share of sampled packages</text>`,
  );

  const cell = (x: number, y: number, v: BaselineValue, label: string, sub: string | null, title: string) => {
    const st = BASELINE_STYLE[v];
    return [
      `<g><title>${esc(title)}</title>`,
      `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="4" fill="${st.fill}"/>`,
      `<text x="${x + cellW / 2}" y="${y + (sub ? 20 : 26)}" font-size="13" font-weight="600" fill="${st.ink}" text-anchor="middle">${esc(label)}</text>`,
      sub ? `<text x="${x + cellW / 2}" y="${y + 34}" font-size="10" fill="${st.ink}" text-anchor="middle" opacity="0.85">${esc(sub)}</text>` : "",
      `</g>`,
    ].join("");
  };

  ecosystems.forEach((e, i) => {
    const f = sigstoreOf(e);
    const y = top + i * (cellH + gap);
    const name = ECOSYSTEM_LABEL[e];
    parts.push(`<text x="${left - 10}" y="${y + cellH / 2 + 4}" font-size="12" fill="${INK}" text-anchor="end">${esc(name)}</text>`);

    const accepts: BaselineValue = f.status === "yes" ? "yes" : f.status === "planned" ? "partial" : "no";
    parts.push(cell(left, y, accepts, f.status, f.since ? `since ${humanMonth(f.since)}` : null, `${name}: ${f.signs}`));

    const reg: BaselineValue = f.registryVerifies === "yes" ? "yes" : f.registryVerifies === "n/a" ? "n/a" : "no";
    parts.push(cell(left + cellW + gap, y, reg, f.registryVerifies, null, `${name}: registry verifies bundles at upload: ${f.registryVerifies}`));

    const best = bestClient(f);
    const cv: BaselineValue = best.verifies === "yes" ? "yes" : best.verifies === "opt-in" ? "partial" : best.verifies === "n/a" ? "n/a" : "no";
    const clientTitle = `${name} install clients: ${f.clients.map((c) => `${c.client} ${c.verifies}`).join("; ")}`;
    parts.push(cell(left + 2 * (cellW + gap), y, cv, best.verifies, best.verifies === "opt-in" ? best.client : null, clientTitle));

    const cy = y + cellH / 2;
    const c = agg.matrix.find((m) => m.ecosystem === e && m.signal === SIGSTORE_SIGNAL);
    if (f.status === "yes" && c && c.pct != null) {
      const w = c.pct * barW;
      parts.push(
        `<g><title>${esc(`${name}: ${c.t} of ${c.n} sampled latest releases carry a Sigstore bundle`)}</title>`,
        `<rect x="${barX}" y="${cy - 9}" width="${barW}" height="18" rx="4" fill="${NEUTRAL}"/>`,
        w >= 1 ? `<path d="${barPath(barX, barX + w, cy - 5, 10, true)}" fill="${RAMP[9]}"/>` : "",
        `<text x="${barX + barW + 10}" y="${cy + 4}" font-size="11" fill="${INK}">${pctText(c.pct)} <tspan fill="${INK_2}">(${c.t}/${c.n})</tspan></text>`,
        `</g>`,
      );
    } else {
      parts.push(`<text x="${barX}" y="${cy + 4}" font-size="11" fill="${INK_2}"><title>${esc(f.similar)}</title>instead: ${esc(f.similarShort)}</text>`);
    }
  });

  const ly = top + ecosystems.length * (cellH + gap) + 22;
  let lx = left;
  for (const [v, label] of [["yes", "yes"], ["partial", "opt-in / planned"], ["no", "no"], ["n/a", "n/a"]] as const) {
    const st = BASELINE_STYLE[v];
    parts.push(
      `<rect x="${lx}" y="${ly}" width="14" height="10" rx="2" fill="${st.fill}"${v === "no" || v === "n/a" ? ` stroke="#c9c8c2" stroke-width="1"` : ""}/>`,
      `<text x="${lx + 20}" y="${ly + 9}" font-size="10" fill="${INK_2}">${label}</text>`,
    );
    lx += 34 + label.length * 6;
  }
  parts.push(
    `<text x="${left}" y="${ly + 30}" font-size="10" fill="${MUTED}">"Best install client" is the strongest default or opt-in check among the clients listed in sigstore.md, newer ones included.</text>`,
  );
  return svg(width, height, parts.join("\n"), HATCH);
}

/**
 * Post-quantum status is ordinal too: safe darkest, partial mid, and the two failing states
 * off the ramp. "Weak" (SHA-1, MD5) shares the vulnerable fill but gets a dashed outline,
 * because it fails today rather than only against a quantum computer.
 */
const PQC_STYLE: Record<PqcStatus, { fill: string; ink: string; label: string; dashed?: boolean }> = {
  safe: { fill: RAMP[9]!, ink: "#ffffff", label: "PQ-safe" },
  partial: { fill: RAMP[4]!, ink: INK, label: "partly PQ-safe" },
  vulnerable: { fill: NEUTRAL, ink: INK_2, label: "quantum-vulnerable" },
  weak: { fill: NEUTRAL, ink: INK_2, label: "weak already", dashed: true },
  "n/a": { fill: "url(#hatch)", ink: INK_2, label: "not used" },
};

/**
 * Every cryptographic mechanism in the publish → install chain, per ecosystem, coloured by
 * what a cryptographically relevant quantum computer would do to it. Each cell names the
 * primitive; the hover title carries the reasoning.
 */
export function pqcSvg(agg: Aggregate): string {
  const ecosystems = ECOSYSTEMS.filter((e) => agg.scores.some((s) => s.ecosystem === e));
  const cellW = 136;
  const cellH = 44;
  const gap = 2;
  const left = 120;
  const top = 94;
  const width = left + PQC_LAYERS.length * (cellW + gap) + 32;
  const height = top + ecosystems.length * (cellH + gap) + 92;
  const parts: string[] = [
    `<text x="16" y="24" font-size="15" font-weight="600" fill="${INK}">Post-quantum exposure, publish to install</text>`,
    `<text x="16" y="42" font-size="11" fill="${INK_2}">What a cryptographically relevant quantum computer would break · verified ${esc(humanDate(PQC_VERIFIED, true))}, TLS measured live · snapshot ${esc(humanDate(agg.asOf))}</text>`,
  ];

  PQC_LAYERS.forEach((l, j) => {
    const lines = twoLines(l.label);
    lines.forEach((line, k) => {
      parts.push(`<text x="${left + j * (cellW + gap) + cellW / 2}" y="${top - 10 - (lines.length - 1 - k) * 13}" font-size="11" font-weight="600" fill="${INK_2}" text-anchor="middle"><title>${esc(l.question)}</title>${esc(line)}</text>`);
    });
  });

  ecosystems.forEach((e, i) => {
    const y = top + i * (cellH + gap);
    parts.push(`<text x="${left - 10}" y="${y + cellH / 2 + 4}" font-size="12" fill="${INK}" text-anchor="end">${esc(ECOSYSTEM_LABEL[e])}</text>`);
    PQC_LAYERS.forEach((l, j) => {
      const p = pqcOf(e, l.id);
      const st = PQC_STYLE[p.status];
      const x = left + j * (cellW + gap);
      const cx = x + cellW / 2;
      const outline = st.dashed ? ` stroke="${INK_2}" stroke-width="1.5" stroke-dasharray="4 3"` : "";
      const sub = p.status === "n/a" ? null : st.label;
      parts.push(
        `<g><title>${esc(`${ECOSYSTEM_LABEL[e]} · ${l.label}: ${p.primitive} (${st.label}). ${p.note}`)}</title>`,
        `<rect x="${x + (st.dashed ? 0.75 : 0)}" y="${y + (st.dashed ? 0.75 : 0)}" width="${cellW - (st.dashed ? 1.5 : 0)}" height="${cellH - (st.dashed ? 1.5 : 0)}" rx="4" fill="${st.fill}"${outline}/>`,
        `<text x="${cx}" y="${y + (sub ? 20 : 26)}" font-size="12" font-weight="600" fill="${st.ink}" text-anchor="middle">${esc(p.primitive)}</text>`,
        sub ? `<text x="${cx}" y="${y + 34}" font-size="10" fill="${st.ink}" text-anchor="middle" opacity="0.85">${esc(sub)}</text>` : "",
        `</g>`,
      );
    });
  });

  const ly = top + ecosystems.length * (cellH + gap) + 22;
  let lx = left;
  for (const v of ["safe", "partial", "vulnerable", "weak", "n/a"] as const) {
    const st = PQC_STYLE[v];
    const outline = st.dashed ? ` stroke="${INK_2}" stroke-width="1" stroke-dasharray="3 2"` : v === "vulnerable" || v === "n/a" ? ` stroke="#c9c8c2" stroke-width="1"` : "";
    parts.push(
      `<rect x="${lx}" y="${ly}" width="14" height="10" rx="2" fill="${st.fill}"${outline}/>`,
      `<text x="${lx + 20}" y="${ly + 9}" font-size="10" fill="${INK_2}">${st.label}</text>`,
    );
    lx += 36 + st.label.length * 5.6;
  }
  parts.push(
    `<text x="${left}" y="${ly + 30}" font-size="10" fill="${MUTED}">Hashes and symmetric secrets keep half their strength against a quantum computer (Grover); RSA, ECDSA and EdDSA are broken (Shor).</text>`,
    `<text x="${left}" y="${ly + 44}" font-size="10" fill="${MUTED}">Hybrid TLS (X25519MLKEM768) protects recorded traffic, not server authentication: every certificate is still RSA or ECDSA. Hover a cell for details.</text>`,
  );
  return svg(width, height, parts.join("\n"), HATCH);
}

/** Ecosystems whose availability for this signal yields a measurable series. */
export function measurable(agg: Aggregate, signal: SignalId): EcosystemId[] {
  return ECOSYSTEMS.filter((e) => {
    const c = agg.matrix.find((m) => m.ecosystem === e && m.signal === signal);
    return c && (c.availability === "observable" || c.availability === "inferred");
  });
}

export function adoptionSvg(agg: Aggregate, signal: SignalId): string {
  const ecosystems = measurable(agg, signal);
  const width = 680;
  const height = 376;
  const m = { l: 48, r: 112, t: 84, b: 56 };
  const pw = width - m.l - m.r;
  const ph = height - m.t - m.b;
  const qs = agg.quarters;
  const x = (i: number) => m.l + (qs.length === 1 ? pw / 2 : (i * pw) / (qs.length - 1));
  const y = (p: number) => m.t + ph - p * ph;
  const parts: string[] = [];

  const inferred = ecosystems.filter((e) => agg.matrix.find((c) => c.ecosystem === e && c.signal === signal)?.availability === "inferred");
  parts.push(
    `<text x="16" y="24" font-size="15" font-weight="600" fill="${INK}">${esc(SIGNAL_LABEL[signal])}: adoption by quarter</text>`,
    `<text x="16" y="42" font-size="11" fill="${INK_2}">Share of sampled packages whose installable release at quarter end carried the signal</text>`,
  );

  // Legend row: always present for two or more series.
  let lx = 16;
  for (const e of ecosystems) {
    parts.push(
      `<line x1="${lx}" y1="62" x2="${lx + 16}" y2="62" stroke="${SERIES[e]}" stroke-width="2" stroke-linecap="round"/>`,
      `<text x="${lx + 22}" y="66" font-size="11" fill="${INK_2}">${esc(ECOSYSTEM_LABEL[e])}${inferred.includes(e) ? " (≥)" : ""}</text>`,
    );
    lx += 34 + ECOSYSTEM_LABEL[e].length * 6.6 + (inferred.includes(e) ? 18 : 0);
  }

  for (const p of [0, 0.25, 0.5, 0.75, 1]) {
    parts.push(
      `<line x1="${m.l}" y1="${y(p)}" x2="${m.l + pw}" y2="${y(p)}" stroke="${GRID}" stroke-width="1"/>`,
      `<text x="${m.l - 8}" y="${y(p) + 4}" font-size="10" fill="${MUTED}" text-anchor="end">${p * 100}%</text>`,
    );
  }
  // Label every other quarter when crowded, always including the last.
  const every = qs.length > 8 ? 2 : 1;
  qs.forEach((q, i) => {
    if (i % every === 0 || i === qs.length - 1) {
      parts.push(`<text x="${x(i)}" y="${m.t + ph + 18}" font-size="10" fill="${MUTED}" text-anchor="middle">${q}</text>`);
    }
  });

  if (inferred.length) {
    parts.push(`<text x="16" y="${height - 12}" font-size="10" fill="${MUTED}">(≥) inferred signal: unknowns count as not adopted, so the line is a lower bound.</text>`);
  }

  if (ecosystems.length === 0) {
    parts.push(`<text x="${m.l + pw / 2}" y="${m.t + ph / 2}" font-size="12" fill="${INK_2}" text-anchor="middle">No ecosystem exposes this signal</text>`);
    return svg(width, height, parts.join("\n"));
  }

  const ends: Array<{ e: EcosystemId; y: number; text: string }> = [];
  for (const e of ecosystems) {
    const pts = qs
      .map((q, i) => ({ i, q, pt: agg.series.find((s) => s.quarter === q && s.ecosystem === e && s.signal === signal) }))
      .filter((d) => d.pt && d.pt.pct != null);
    if (pts.length === 0) continue;
    const path = pts.map((d, k) => `${k ? "L" : "M"}${x(d.i).toFixed(1)},${y(d.pt!.pct!).toFixed(1)}`).join(" ");
    parts.push(`<path d="${path}" fill="none" stroke="${SERIES[e]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);
    for (const d of pts) {
      const pt = d.pt!;
      const tip = `${ECOSYSTEM_LABEL[e]} ${d.q}: ${pctText(pt.pct)} (${pt.t}/${pt.n}; ${pt.u} unknown)`;
      // Invisible enlarged hit target; the visible dot only at the series end.
      parts.push(`<circle cx="${x(d.i)}" cy="${y(pt.pct!)}" r="8" fill="transparent"><title>${esc(tip)}</title></circle>`);
    }
    const last = pts.at(-1)!;
    parts.push(`<circle cx="${x(last.i)}" cy="${y(last.pt!.pct!)}" r="4" fill="${SERIES[e]}" stroke="${SURFACE}" stroke-width="2"/>`);
    ends.push({ e, y: y(last.pt!.pct!), text: `${ECOSYSTEM_LABEL[e]} ${pctText(last.pt!.pct)}` });
  }

  // Direct end labels only where they do not collide; the legend carries the rest.
  ends.sort((a, b) => a.y - b.y);
  ends.forEach((lab, k) => {
    const prev = ends[k - 1];
    const next = ends[k + 1];
    const clear = (!prev || lab.y - prev.y >= 13) && (!next || next.y - lab.y >= 13);
    if (clear) parts.push(`<text x="${m.l + pw + 10}" y="${lab.y + 4}" font-size="11" fill="${INK}">${esc(lab.text)}</text>`);
  });

  return svg(width, height, parts.join("\n"));
}

/**
 * Per-platform trust summary on one axis (share of the seven properties). The pale track
 * is capability — the most a package *could* have on that platform. Inside it, the dark
 * bar grows from 0 to the assurance packages are known to reach, and a mid-tone segment
 * continues to what unknowns could add. Both are shares of the same seven properties, so
 * one axis is honest.
 */
export function scoresSvg(agg: Aggregate): string {
  const rows = [...agg.scores].sort((a, b) => (b.assuranceLow ?? 0) - (a.assuranceLow ?? 0) || b.capability - a.capability);
  const left = 120;
  const plotW = 400;
  const rowH = 40;
  const top = 92;
  const width = left + plotW + 210;
  const height = top + rows.length * rowH + 64;
  const x = (p: number) => left + p * plotW;
  const parts: string[] = [
    `<text x="16" y="24" font-size="15" font-weight="600" fill="${INK}">Trust summary per platform</text>`,
    `<text x="16" y="42" font-size="11" fill="${INK_2}">Share of the ${agg.scores[0]?.total ?? 7} trust properties · latest release of each sampled package · snapshot ${esc(humanDate(agg.asOf))}</text>`,
    // Legend
    `<rect x="16" y="58" width="22" height="10" rx="3" fill="${RAMP[1]}"/>`,
    `<text x="44" y="67" font-size="11" fill="${INK_2}">capability (offered by the platform)</text>`,
    `<rect x="250" y="58" width="22" height="10" rx="3" fill="${RAMP[9]}"/>`,
    `<text x="278" y="67" font-size="11" fill="${INK_2}">assurance (known)</text>`,
    `<rect x="392" y="58" width="22" height="10" rx="3" fill="${RAMP[5]}"/>`,
    `<text x="420" y="67" font-size="11" fill="${INK_2}">possible if unknowns hold</text>`,
  ];
  for (const p of [0, 0.25, 0.5, 0.75, 1]) {
    parts.push(
      `<line x1="${x(p)}" y1="${top - 6}" x2="${x(p)}" y2="${top + rows.length * rowH - 10}" stroke="${GRID}" stroke-width="1"/>`,
      `<text x="${x(p)}" y="${top + rows.length * rowH + 6}" font-size="10" fill="${MUTED}" text-anchor="middle">${p * 100}%</text>`,
    );
  }
  rows.forEach((r: Score, i) => {
    const cy = top + i * rowH + 10;
    const lo = r.assuranceLow ?? 0;
    const hi = r.assuranceHigh ?? lo;
    const tip = `${ECOSYSTEM_LABEL[r.ecosystem]}: capability ${r.offered}/${r.total} offered (${r.auditable} auditable); assurance ${pctText(lo)}–${pctText(hi)} over ${r.n} packages`;
    parts.push(
      `<g><title>${esc(tip)}</title>`,
      `<text x="${left - 12}" y="${cy + 4}" font-size="12" fill="${INK}" text-anchor="end">${esc(ECOSYSTEM_LABEL[r.ecosystem])}</text>`,
      `<rect x="${x(0)}" y="${cy - 9}" width="${Math.max(0, x(r.capability) - x(0))}" height="18" rx="4" fill="${RAMP[1]}"/>`,
      ...assuranceBars(x(0), x(lo), x(hi), cy),
      `<text x="${left + plotW + 14}" y="${cy + 4}" font-size="11" fill="${INK}">${pctText(lo)}${hi - lo >= 0.005 ? `–${pctText(hi)}` : ""}</text>`,
      `<text x="${left + plotW + 84}" y="${cy + 4}" font-size="11" fill="${INK_2}">${r.offered}/${r.total} offered</text>`,
      `</g>`,
    );
  });
  parts.push(
    `<text x="16" y="${height - 14}" font-size="10" fill="${MUTED}">Equal weights. Not-exposed properties count as offered but unknown, so they widen the range rather than being guessed.</text>`,
  );
  return svg(width, height, parts.join("\n"));
}

/**
 * Known assurance as a bar from the baseline, then the unknown range as a second segment.
 * Square at the baseline, 4px-rounded at the data end, 2px surface gap between segments.
 */
function assuranceBars(x0: number, xLo: number, xHi: number, cy: number): string[] {
  const h = 10;
  const y = cy - h / 2;
  const gap = 2;
  const hasRange = xHi - xLo >= gap + 2;
  const out: string[] = [];
  if (xLo - x0 >= 1) {
    out.push(`<path d="${barPath(x0, xLo, y, h, !hasRange)}" fill="${RAMP[9]}"/>`);
  }
  if (hasRange) {
    const start = xLo - x0 >= 1 ? xLo + gap : xLo;
    out.push(`<path d="${barPath(start, xHi, y, h, true)}" fill="${RAMP[5]}"/>`);
  }
  return out;
}

/** A horizontal bar, square on the left; the right end rounded when it is the data end. */
function barPath(x1: number, x2: number, y: number, h: number, roundRight: boolean): string {
  const r = roundRight ? Math.min(4, (x2 - x1) / 2, h / 2) : 0;
  const f = (n: number) => n.toFixed(2);
  return [
    `M${f(x1)},${f(y)}`,
    `H${f(x2 - r)}`,
    r ? `Q${f(x2)},${f(y)} ${f(x2)},${f(y + r)}` : "",
    `V${f(y + h - r)}`,
    r ? `Q${f(x2)},${f(y + h)} ${f(x2 - r)},${f(y + h)}` : "",
    `H${f(x1)}`,
    "Z",
  ].join(" ");
}

function svg(width: number, height: number, body: string, defs = ""): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}">`,
    defs ? `<defs>${defs}</defs>` : "",
    `<rect width="${width}" height="${height}" fill="${SURFACE}"/>`,
    body,
    `</svg>`,
    "",
  ].join("\n");
}
