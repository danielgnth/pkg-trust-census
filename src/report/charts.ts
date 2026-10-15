/**
 * Static SVG figures for the paper: the maturity heatmap, the curated fact grids, and one
 * adoption-over-time chart per signal. Drawn with Observable Plot, rendered headlessly via
 * linkedom; `figure` adds the title, legend and notes around one or more Plot panels.
 * Colours are plain hex attributes rather than CSS variables so the files survive conversion
 * to PDF (rsvg, Inkscape) for LaTeX.
 *
 * Light mode only, deliberately: these are print figures. Each mark carries a <title>
 * so a browser shows the exact counts on hover, and the same numbers are in the CSVs.
 */

import * as Plot from "@observablehq/plot";
import { parseHTML } from "linkedom";
import { ECOSYSTEMS, SIGNALS, type EcosystemId, type SignalId } from "../types.ts";
import { CATEGORIES, type Aggregate, type MatrixCell, type SeriesPoint } from "../stages/aggregate.ts";
import { CATEGORY_LABEL, ECOSYSTEM_LABEL, NO_UPLOAD, PUBLISH_CREDENTIAL, SIGNAL_LABEL, WITHDRAWAL_BLIND, WITHDRAWAL_LABEL, humanDate, humanMonth, pctSmall, pctText, pointsText } from "./labels.ts";
import { BASELINE_PROPERTIES, BASELINE_VERIFIED, baselineOf, type BaselineProperty, type BaselineValue } from "../facts/baseline.ts";
import { POLICIES_VERIFIED, POLICY_PROPERTIES, policyOf, type PolicyProperty } from "../facts/policies.ts";
import { SIGSTORE_SIGNAL, bestClient, sigstoreOf, type SigstoreFact } from "../facts/sigstore.ts";
import { PQC_LAYERS, PQC_VERIFIED, pqcOf, type PqcStatus } from "../facts/pqc.ts";

const FONT = "system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const SURFACE = "#fcfcfb";
const INK = "#0b0b0b";
const INK_2 = "#52514e";
const MUTED = "#8a8984";
const GRID = "#e6e5e1";
const NEUTRAL = "#f0efec";
const OUTLINE = "#c9c8c2";
const HATCH_FILL = "url(#hatch)";

/** Sequential blue, steps 100 → 700. */
const RAMP = ["#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b"] as const;

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

const HATCH_WEAK = `<pattern id="hatch-weak" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="${RAMP[3]}"/><line x1="0" y1="0" x2="0" y2="6" stroke="${RAMP[9]}" stroke-width="2"/></pattern>`;
const HATCH = `<pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="${NEUTRAL}"/><line x1="0" y1="0" x2="0" y2="6" stroke="${OUTLINE}" stroke-width="2"/></pattern>`;

const { document } = parseHTML("<!doctype html><html><body></body></html>");
/** Plot's typings expect the browser DOM, which this headless build does not include. */
const doc = document as never;
type Rendered = { outerHTML: string; getAttribute(name: string): string | null };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---------------------------------------------------------------------------------------
// Frame: Plot draws the data; the frame adds what Plot renders as HTML (titles, swatches).

interface Panel {
  svg: string;
  width: number;
  height: number;
}

/** Renders a Plot. Fills and strokes are literal colours (identity scale) unless overridden. */
function plot(options: Plot.PlotOptions): Panel {
  const el = Plot.plot({
    document: doc,
    color: { type: "identity" },
    style: { color: INK, background: "transparent", fontFamily: FONT },
    ...options,
  }) as unknown as Rendered;
  return { svg: el.outerHTML, width: Number(el.getAttribute("width")), height: Number(el.getAttribute("height")) };
}

interface Swatch {
  label: string;
  fill: string;
  /** Pale fills get an outline so they do not vanish into the surface. */
  outline?: boolean;
  dashed?: boolean;
  /** Draw a line sample (series colour) instead of a filled box. */
  line?: boolean;
}

function swatches(items: Swatch[], x0: number, y: number, size = 11): string {
  let x = x0;
  return items
    .map((s) => {
      const mark = s.line
        ? `<line x1="${x}" y1="${y + 5}" x2="${x + 16}" y2="${y + 5}" stroke="${s.fill}" stroke-width="2" stroke-linecap="round"/>`
        : `<rect x="${x}" y="${y}" width="14" height="10" rx="2" fill="${s.fill}"${s.dashed ? ` stroke="${INK_2}" stroke-width="1" stroke-dasharray="3 2"` : s.outline ? ` stroke="${OUTLINE}" stroke-width="1"` : ""}/>`;
      const text = `<text x="${x + 22}" y="${y + 9}" font-size="${size}" fill="${INK_2}">${esc(s.label)}</text>`;
      x += 38 + s.label.length * size * 0.5;
      return mark + text;
    })
    .join("");
}

/**
 * Title, subtitle and an optional legend row above the panels, notes below. Panels sit side
 * by side at their `x` offset.
 */
function figure(o: {
  title: string;
  subtitle: string;
  legend?: Array<Swatch | Panel>;
  panels: Array<Panel & { x?: number }>;
  notes?: string[];
}): string {
  const top = o.legend ? 80 : 56;
  const body = Math.max(...o.panels.map((p) => p.height));
  const notes = o.notes ?? [];
  const width = Math.max(...o.panels.map((p) => (p.x ?? 0) + p.width));
  const height = top + body + (notes.length ? 16 + notes.length * 14 : 0) + 8;

  const legend: string[] = [];
  let lx = 16;
  for (const item of o.legend ?? []) {
    if ("svg" in item) {
      legend.push(`<g transform="translate(${lx},54)">${item.svg}</g>`);
      lx += item.width + 16;
    } else {
      legend.push(swatches([item], lx, 58));
      lx += 38 + item.label.length * 11 * 0.5;
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}" color="${INK}">`,
    `<defs>${HATCH}${HATCH_WEAK}</defs>`,
    `<rect width="${width}" height="${height}" fill="${SURFACE}"/>`,
    `<text x="16" y="24" font-size="15" font-weight="600" fill="${INK}">${esc(o.title)}</text>`,
    `<text x="16" y="42" font-size="11" fill="${INK_2}">${esc(o.subtitle)}</text>`,
    ...legend,
    ...o.panels.map((p) => `<g transform="translate(${p.x ?? 0},${top})">${p.svg}</g>`),
    ...notes.map((n, i) => `<text x="16" y="${top + body + 20 + i * 14}" font-size="10" fill="${MUTED}">${esc(n)}</text>`),
    `</svg>`,
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------------------
// Grids: ecosystem × column, one rounded cell each, printing its value so the reading never
// depends on colour.

interface GridColumn {
  id: string;
  label: string;
  /** Hover text on the column header. */
  question?: string;
  /** Columns sharing a group get one header spanning them. */
  group?: string;
}

interface GridCell {
  column: string;
  row: string;
  fill: string;
  ink: string;
  label: string;
  sub?: string | null;
  title: string;
  dashed?: boolean;
  /** A state rather than a value ("no mechanism"): small regular type. */
  quiet?: boolean;
}

const CELL_GAP = 2;

function grid(o: { columns: readonly GridColumn[]; rows: string[]; cells: GridCell[]; cellW: number; cellH: number; labelSize?: number }): Panel {
  const grouped = o.columns.some((c) => c.group);
  const marginTop = grouped ? 64 : 44;
  const marginLeft = 120;
  const question = new Map(o.columns.map((c) => [c.id, c.question]));
  const label = new Map(o.columns.map((c) => [c.id, c.label]));
  const withSub = o.cells.filter((c) => c.sub);
  const plain = o.cells.filter((c) => !c.sub && !c.quiet);

  return plot({
    width: marginLeft + o.columns.length * (o.cellW + CELL_GAP) + 16,
    height: marginTop + o.rows.length * (o.cellH + CELL_GAP),
    marginTop,
    marginLeft,
    marginRight: 16,
    marginBottom: 0,
    x: { domain: o.columns.map((c) => c.id), padding: 0, axis: null },
    y: { domain: o.rows, padding: 0, axis: null },
    marks: [
      Plot.axisX({
        anchor: "top",
        tickSize: 0,
        tickPadding: 10,
        tickFormat: (id: string) => label.get(id),
        lineWidth: o.cellW / 7,
        fontSize: 11,
        fontWeight: 600,
        fill: INK_2,
        label: null,
        title: (id: string) => question.get(id) ?? null,
      }),
      Plot.axisY({ tickSize: 0, tickPadding: 10, fontSize: 12, fill: INK, label: null }),
      grouped ? groupHeaders(o.columns, marginTop) : null,
      Plot.cell(o.cells, { x: "column", y: "row", fill: "fill", inset: CELL_GAP / 2, rx: 4, title: "title" }),
      Plot.cell(o.cells.filter((c) => c.dashed), { x: "column", y: "row", fill: "none", stroke: INK_2, strokeWidth: 1.5, strokeDasharray: "4 3", inset: CELL_GAP / 2 + 0.75, rx: 4 }),
      Plot.text(plain, { x: "column", y: "row", text: "label", fill: "ink", fontSize: o.labelSize ?? 13, fontWeight: 600 }),
      Plot.text(o.cells.filter((c) => c.quiet), { x: "column", y: "row", text: "label", fill: "ink", fontSize: 11 }),
      Plot.text(withSub, { x: "column", y: "row", text: "label", fill: "ink", fontSize: o.labelSize ?? 13, fontWeight: 600, dy: -6 }),
      Plot.text(withSub, { x: "column", y: "row", text: "sub", fill: "ink", fontSize: 10, fillOpacity: 0.85, dy: 9 }),
    ],
  });
}

/** One label and rule above each run of columns sharing a group. */
function groupHeaders(columns: readonly GridColumn[], marginTop: number): Plot.RenderFunction {
  return (_index, scales) => {
    const x = scales.x!;
    const step = (x as unknown as { bandwidth(): number }).bandwidth?.() ?? 0;
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    let j = 0;
    while (j < columns.length) {
      let k = j;
      while (k + 1 < columns.length && columns[k + 1]!.group === columns[j]!.group) k++;
      const group = columns[j]!.group;
      if (group) {
        const x1 = x(columns[j]!.id)! + CELL_GAP / 2;
        const x2 = x(columns[k]!.id)! + step - CELL_GAP / 2;
        g.innerHTML += `<text x="${(x1 + x2) / 2}" y="${marginTop - 46}" font-size="11" font-weight="600" fill="${INK}" text-anchor="middle">${esc(group)}</text><line x1="${x1}" y1="${marginTop - 38}" x2="${x2}" y2="${marginTop - 38}" stroke="${GRID}" stroke-width="1.5"/>`;
      }
      j = k + 1;
    }
    return g as never;
  };
}

function present(agg: Aggregate): EcosystemId[] {
  return ECOSYSTEMS.filter((e) => agg.scores.some((s) => s.ecosystem === e));
}

// ---------------------------------------------------------------------------------------
// Maturity matrix

export function matrixSvg(agg: Aggregate): string {
  const ecosystems = ECOSYSTEMS.filter((e) => agg.matrix.some((c) => c.ecosystem === e));
  const step = (p: number) => Math.min(RAMP.length - 1, Math.floor(p * RAMP.length));
  const cells: GridCell[] = agg.matrix
    .filter((c) => ecosystems.includes(c.ecosystem))
    .map((c) => {
      const base = { column: c.signal, row: ECOSYSTEM_LABEL[c.ecosystem] };
      const title = `${ECOSYSTEM_LABEL[c.ecosystem]} · ${SIGNAL_LABEL[c.signal]}: ${c.availability}${c.mandatory ? ", mandatory" : ""} · true ${c.t}, false ${c.f}, unknown ${c.u} of ${c.n}`;
      if (c.availability === "no_mechanism" || c.availability === "not_exposed" || c.n === 0 || c.pct == null) {
        const label = c.availability === "no_mechanism" ? "no mechanism" : c.availability === "not_exposed" ? "not exposed" : "no data";
        return { ...base, fill: c.availability === "not_exposed" ? HATCH_FILL : NEUTRAL, ink: INK_2, label, title, quiet: true };
      }
      const bound = c.availability === "inferred" && c.u > 0 ? "≥ " : "";
      return {
        ...base,
        fill: RAMP[step(c.pct)]!,
        // White text on the darker half of the ramp, ink on the lighter half.
        ink: step(c.pct) >= 6 ? "#ffffff" : INK,
        label: `${bound}${pctText(c.pct)}`,
        sub: `${c.t}/${c.n}${c.mandatory ? " · mandatory" : ""}`,
        title,
      };
    });
  const ramp = plot({
    width: 196,
    height: 30,
    margin: 0,
    marginBottom: 16,
    x: { domain: RAMP.map((_, i) => i), padding: 0, axis: null },
    marks: [
      Plot.cell(RAMP, { x: (_, i) => i, fill: (c) => c }),
      Plot.text(["0%"], { frameAnchor: "bottom-left", dy: 13, fontSize: 10, fill: INK_2 }),
      Plot.text(["100%"], { frameAnchor: "bottom-right", dy: 13, fontSize: 10, fill: INK_2 }),
    ],
  });
  return figure({
    title: "Trust-signal adoption, latest version",
    subtitle: `Share of sampled packages whose latest release carries the signal · snapshot ${humanDate(agg.asOf)}`,
    legend: [
      ramp,
      { label: "no mechanism", fill: NEUTRAL, outline: true },
      { label: "not exposed by registry", fill: HATCH_FILL, outline: true },
    ],
    panels: [grid({ columns: SIGNALS.map((s) => ({ id: s, label: SIGNAL_LABEL[s] })), rows: ecosystems.map((e) => ECOSYSTEM_LABEL[e]), cells, cellW: 128, cellH: 50, labelSize: 14 })],
    notes: ["≥ marks an inferred signal: unknowns count as not adopted, so the figure is a lower bound."],
  });
}

// ---------------------------------------------------------------------------------------
// Curated fact grids

/**
 * Ordinal yes/partial/no/n/a values take steps of the matrix's sequential blue: "yes"
 * darkest, "partial" mid. "No" and "n/a" stay off the ramp, as the matrix's no-mechanism
 * and not-exposed cells do.
 */
const VALUE_STYLE: Record<BaselineValue, { fill: string; ink: string }> = {
  yes: { fill: RAMP[9]!, ink: "#ffffff" },
  partial: { fill: RAMP[4]!, ink: INK },
  no: { fill: NEUTRAL, ink: INK_2 },
  "n/a": { fill: HATCH_FILL, ink: INK_2 },
};

const valueSwatch = (v: BaselineValue, label: string = v): Swatch => ({ label, fill: VALUE_STYLE[v].fill, outline: v === "no" || v === "n/a" });

function factGridSvg(o: {
  agg: Aggregate;
  title: string;
  subtitle: string;
  columns: readonly GridColumn[];
  cell: (e: EcosystemId, column: string) => { value: BaselineValue; since?: string; note: string };
  note: string;
}): string {
  const ecosystems = present(o.agg);
  const cells: GridCell[] = ecosystems.flatMap((e) =>
    o.columns.map((c) => {
      const b = o.cell(e, c.id);
      const since = b.since ? `since ${humanMonth(b.since)}` : null;
      return {
        column: c.id,
        row: ECOSYSTEM_LABEL[e],
        ...VALUE_STYLE[b.value],
        label: b.value,
        sub: since,
        title: `${ECOSYSTEM_LABEL[e]} · ${c.label}: ${b.value}${since ? ` (${since})` : ""}. ${b.note}`,
      };
    }),
  );
  return figure({
    title: o.title,
    subtitle: o.subtitle,
    legend: (["yes", "partial", "no", "n/a"] as const).map((v) => valueSwatch(v)),
    panels: [grid({ columns: o.columns, rows: ecosystems.map((e) => ECOSYSTEM_LABEL[e]), cells, cellW: 128, cellH: 44 })],
    notes: [o.note],
  });
}

/**
 * The registry baseline as a grid: ecosystem × property, one categorical value per cell.
 * Ecosystem-level and curated, so the subtitle says so, and the hover title carries the note.
 */
export function baselineSvg(agg: Aggregate): string {
  return factGridSvg({
    agg,
    title: "Registry baseline: what the default toolchain protects",
    subtitle: `Ecosystem defaults from primary sources, verified ${humanDate(BASELINE_VERIFIED, true)} · not part of the trust score · snapshot ${humanDate(agg.asOf)}`,
    columns: BASELINE_PROPERTIES,
    cell: (e, id) => baselineOf(e, id as BaselineProperty),
    note: '"since" marks a value that changed recently, so the backfill quarters predate it. Hover a cell for the note; sources in baseline.md.',
  });
}

/** Governance (what keeps malicious names out) and containment (what happens after). */
export function policiesSvg(agg: Aggregate): string {
  return factGridSvg({
    agg,
    title: "Registry governance and incident containment",
    subtitle: `Registry rules from primary sources and registry code, verified ${humanDate(POLICIES_VERIFIED, true)} · not part of the trust score · snapshot ${humanDate(agg.asOf)}`,
    columns: POLICY_PROPERTIES.map((p) => ({ ...p, group: p.group === "governance" ? "Governance: keeping malicious packages out" : "Containment: after a bad release" })),
    cell: (e, id) => policyOf(e, id as PolicyProperty),
    note: '"since" marks a recent change. Hover a cell for the rule and its source; full notes and links in policies.md.',
  });
}

// ---------------------------------------------------------------------------------------
// Horizontal bars: a pale 0–100% track with the share drawn inside it.

const TRACK = 18;
const BAR = 10;

/** Track and share bar per row, centred in a band of height `rowH`. */
function shareBars<T>(rows: T[], o: { y: (d: T) => string; share: (d: T) => number; title: (d: T) => string; rowH: number }): Plot.Markish[] {
  const inset = (h: number) => (o.rowH - CELL_GAP - h) / 2;
  return [
    Plot.barX(rows, { x1: 0, x2: 1, y: o.y, fill: NEUTRAL, rx: 4, insetTop: inset(TRACK), insetBottom: inset(TRACK), title: o.title }),
    Plot.barX(rows.filter((d) => o.share(d) > 0), {
      x1: 0,
      x2: (d: T) => Math.max(o.share(d), 0.006),
      y: o.y,
      fill: RAMP[9],
      rx2: 4,
      insetTop: inset(BAR),
      insetBottom: inset(BAR),
      title: o.title,
    }),
  ];
}

/**
 * Sigstore per registry: three policy cells (accepts bundles, registry checks them, the best
 * any install client does) and one bar, the share of sampled latest releases that carry a
 * bundle. Registries without Sigstore show their nearest equivalent in place of the bar.
 * Rows run from earliest adopter to none, so the order reads as a timeline.
 */
export function sigstoreSvg(agg: Aggregate): string {
  const rank = (f: SigstoreFact) => (f.status === "yes" ? 0 : f.status === "planned" ? 1 : 2);
  const ecosystems = present(agg).sort((a, b) => {
    const fa = sigstoreOf(a);
    const fb = sigstoreOf(b);
    return rank(fa) - rank(fb) || (fa.since ?? "").localeCompare(fb.since ?? "");
  });
  const rows = ecosystems.map((e) => ECOSYSTEM_LABEL[e]);
  const cellH = 44;

  const cells: GridCell[] = ecosystems.flatMap((e) => {
    const f = sigstoreOf(e);
    const name = ECOSYSTEM_LABEL[e];
    const best = bestClient(f);
    const accepts: BaselineValue = f.status === "yes" ? "yes" : f.status === "planned" ? "partial" : "no";
    const reg: BaselineValue = f.registryVerifies === "yes" ? "yes" : f.registryVerifies === "n/a" ? "n/a" : "no";
    const cv: BaselineValue = best.verifies === "yes" ? "yes" : best.verifies === "opt-in" ? "partial" : best.verifies === "n/a" ? "n/a" : "no";
    return [
      { column: "accepts", row: name, ...VALUE_STYLE[accepts], label: f.status, sub: f.since ? `since ${humanMonth(f.since)}` : null, title: `${name}: ${f.signs}` },
      { column: "registry", row: name, ...VALUE_STYLE[reg], label: f.registryVerifies, title: `${name}: registry verifies bundles at upload: ${f.registryVerifies}` },
      {
        column: "client",
        row: name,
        ...VALUE_STYLE[cv],
        label: best.verifies,
        sub: best.verifies === "opt-in" ? best.client : null,
        title: `${name} install clients: ${f.clients.map((c) => `${c.client} ${c.verifies}`).join("; ")}`,
      },
    ];
  });
  const left = grid({
    columns: [
      { id: "accepts", label: "Accepts bundles" },
      { id: "registry", label: "Registry checks at upload" },
      { id: "client", label: "Best install client" },
    ],
    rows,
    cells,
    cellW: 120,
    cellH,
  });

  type Row = { name: string; f: SigstoreFact; t: number; n: number; pct: number | null };
  const data: Row[] = ecosystems.map((e) => {
    const c = agg.matrix.find((m) => m.ecosystem === e && m.signal === SIGSTORE_SIGNAL);
    return { name: ECOSYSTEM_LABEL[e], f: sigstoreOf(e), t: c?.t ?? 0, n: c?.n ?? 0, pct: c?.pct ?? null };
  });
  const measured = data.filter((d) => d.f.status === "yes" && d.pct != null);
  const instead = data.filter((d) => !measured.includes(d));
  const right = plot({
    width: 22 + 240 + 110,
    height: 44 + rows.length * (cellH + CELL_GAP),
    marginTop: 44,
    marginLeft: 22,
    marginRight: 110,
    marginBottom: 0,
    x: { domain: [0, 1], axis: null },
    y: { domain: rows, padding: 0, axis: null },
    marks: [
      Plot.text(["Latest releases with a bundle"], { frameAnchor: "top-left", dy: -23, fontSize: 11, fontWeight: 600, fill: INK_2 }),
      Plot.text(["share of sampled packages"], { frameAnchor: "top-left", dy: -10, fontSize: 11, fill: MUTED }),
      ...shareBars(measured, {
        y: (d) => d.name,
        share: (d) => d.pct!,
        title: (d) => `${d.name}: ${d.t} of ${d.n} sampled latest releases carry a Sigstore bundle`,
        rowH: cellH + CELL_GAP,
      }),
      Plot.text(measured, { x: 1, y: "name", dx: 10, textAnchor: "start", fontSize: 11, text: (d: Row) => `${pctText(d.pct)} (${d.t}/${d.n})` }),
      Plot.text(instead, { x: 0, y: "name", textAnchor: "start", fontSize: 11, fill: INK_2, text: (d: Row) => `instead: ${d.f.similarShort}`, title: (d: Row) => d.f.similar }),
    ],
  });

  return figure({
    title: "Sigstore across registries",
    subtitle: `Who accepts Sigstore bundles, who checks them, and how many top packages ship one · snapshot ${humanDate(agg.asOf)}`,
    legend: [valueSwatch("yes"), valueSwatch("partial", "opt-in / planned"), valueSwatch("no"), valueSwatch("n/a")],
    panels: [left, { ...right, x: left.width }],
    notes: ['"Best install client" is the strongest default or opt-in check among the clients listed in sigstore.md, newer ones included.'],
  });
}

/**
 * Post-quantum status is ordinal too: safe darkest, partial mid, and the two failing states
 * off the ramp. "Weak" (SHA-1, MD5) shares the vulnerable fill but gets a dashed outline,
 * because it fails today rather than only against a quantum computer.
 */
const PQC_STYLE: Record<PqcStatus, { fill: string; ink: string; label: string }> = {
  safe: { fill: RAMP[9]!, ink: "#ffffff", label: "PQ-safe" },
  partial: { fill: RAMP[4]!, ink: INK, label: "partly PQ-safe" },
  vulnerable: { fill: NEUTRAL, ink: INK_2, label: "quantum-vulnerable" },
  weak: { fill: NEUTRAL, ink: INK_2, label: "weak already" },
  "n/a": { fill: HATCH_FILL, ink: INK_2, label: "not used" },
};

/**
 * Every cryptographic mechanism in the publish → install chain, per ecosystem, coloured by
 * what a cryptographically relevant quantum computer would do to it. Each cell names the
 * primitive; the hover title carries the reasoning.
 */
export function pqcSvg(agg: Aggregate): string {
  const ecosystems = present(agg);
  const cells: GridCell[] = ecosystems.flatMap((e) =>
    PQC_LAYERS.map((l) => {
      const p = pqcOf(e, l.id);
      const st = PQC_STYLE[p.status];
      return {
        column: l.id,
        row: ECOSYSTEM_LABEL[e],
        fill: st.fill,
        ink: st.ink,
        label: p.primitive,
        sub: p.status === "n/a" ? null : st.label,
        dashed: p.status === "weak",
        title: `${ECOSYSTEM_LABEL[e]} · ${l.label}: ${p.primitive} (${st.label}). ${p.note}`,
      };
    }),
  );
  return figure({
    title: "Post-quantum exposure, publish to install",
    subtitle: `What a cryptographically relevant quantum computer would break · verified ${humanDate(PQC_VERIFIED, true)}, TLS measured live · snapshot ${humanDate(agg.asOf)}`,
    legend: (["safe", "partial", "vulnerable", "weak", "n/a"] as const).map((s) => ({
      label: PQC_STYLE[s].label,
      fill: PQC_STYLE[s].fill,
      outline: s === "vulnerable" || s === "n/a",
      dashed: s === "weak",
    })),
    panels: [grid({ columns: PQC_LAYERS, rows: ecosystems.map((e) => ECOSYSTEM_LABEL[e]), cells, cellW: 136, cellH: 44, labelSize: 12 })],
    notes: [
      "Hashes and symmetric secrets keep half their strength against a quantum computer (Grover); RSA, ECDSA and EdDSA are broken (Shor).",
      "Hybrid TLS (X25519MLKEM768) protects recorded traffic, not server authentication: every certificate is still RSA or ECDSA. Hover a cell for details.",
    ],
  });
}

/**
 * How the latest releases were published: trusted publishing (OIDC), an account credential,
 * or unknown, as one 100% bar per ecosystem. Parts of a whole, so a stacked bar; the three
 * parts take two ramp steps and the hatch, in reading order from strongest to unknown.
 */
export function publishAuthSvg(agg: Aggregate): string {
  const SEG = [
    { key: "t", label: "trusted publishing (OIDC)", fill: RAMP[9]! },
    { key: "f", label: "account credential", fill: RAMP[3]! },
    { key: "u", label: "unknown", fill: HATCH_FILL },
  ] as const;
  const cells = ECOSYSTEMS.flatMap((e) => agg.matrix.filter((c) => c.ecosystem === e && c.signal === "identity_publish"));
  const rows = cells.map((c) => ECOSYSTEM_LABEL[c.ecosystem]);
  const uploads = cells.filter((c) => !NO_UPLOAD.has(c.ecosystem) && c.n > 0);
  const segments = uploads.flatMap((c) =>
    SEG.filter((s) => c[s.key] > 0).map((s) => ({
      row: ECOSYSTEM_LABEL[c.ecosystem],
      share: c[s.key] / c.n,
      fill: s.fill,
      title: `${ECOSYSTEM_LABEL[c.ecosystem]}: ${c[s.key]} of ${c.n} ${s.label}${s.key === "f" ? ` (${PUBLISH_CREDENTIAL[c.ecosystem]})` : ""}`,
    })),
  );
  const share = (k: number, n: number) => `${Math.round((k / n) * 100)}%`;
  const rowH = 38;

  const panel = plot({
    width: 120 + 420 + 290,
    height: rows.length * rowH,
    marginTop: 0,
    marginLeft: 120,
    marginRight: 290,
    marginBottom: 0,
    x: { domain: [0, 1], axis: null },
    y: { domain: rows, padding: 0, axis: null },
    marks: [
      Plot.axisY({ tickSize: 0, tickPadding: 12, fontSize: 12, fill: INK, label: null }),
      Plot.barX(segments, Plot.stackX({ x: "share", y: "row", fill: "fill", title: "title", rx: 3, insetRight: 1, insetLeft: 1, insetTop: (rowH - 18) / 2, insetBottom: (rowH - 18) / 2 })),
      Plot.text(uploads, {
        x: 1,
        y: (c: MatrixCell) => ECOSYSTEM_LABEL[c.ecosystem],
        dx: 12,
        textAnchor: "start",
        fontSize: 11,
        text: (c: MatrixCell) => `${c.availability === "inferred" && c.u > 0 ? "≥ " : ""}${share(c.t, c.n)} OIDC · ${share(c.f, c.n)} credential${c.u ? ` · ${share(c.u, c.n)} unknown` : ""}`,
      }),
      Plot.text(cells.filter((c) => !uploads.includes(c)), { x: 0, y: (c: MatrixCell) => ECOSYSTEM_LABEL[c.ecosystem], textAnchor: "start", fontSize: 11, fill: INK_2, text: () => "no upload: a release is a VCS tag" }),
    ],
  });
  return figure({
    title: "How the latest releases were published",
    subtitle: `Share of sampled packages by upload authentication · snapshot ${humanDate(agg.asOf)}`,
    legend: SEG.map((s) => ({ label: s.label, fill: s.fill, outline: s.key === "u" })),
    panels: [panel],
    notes: ["Maven has no OIDC path, so every upload uses a token. PyPI shows trusted publishing only through attestations, so credential uploads stay unknown."],
  });
}

const QUARTILES = [0, 0.25, 0.5, 0.75, 1];

/**
 * How often the containment tools were used: per ecosystem and mechanism, the share of
 * sampled packages that withdrew at least one version in the window. One bar per row on a
 * single 0–100% axis; registries that expose no withdrawals get a text row saying why.
 */
export function withdrawalsSvg(agg: Aggregate): string {
  const cells = agg.withdrawals ?? [];
  type Row = { label: string; cell?: (typeof cells)[number]; blind?: string };
  const rows: Row[] = present(agg).flatMap((e): Row[] => {
    const mine = cells.filter((c) => c.ecosystem === e);
    return mine.length
      ? mine.map((c) => ({ label: `${ECOSYSTEM_LABEL[e]} · ${WITHDRAWAL_LABEL[c.kind]}`, cell: c }))
      : [{ label: ECOSYSTEM_LABEL[e], blind: WITHDRAWAL_BLIND[e] ?? "no withdrawal data" }];
  });
  const bars = rows.filter((r) => r.cell);
  const rowH = 34;
  const shareOf = (r: Row) => (r.cell!.packages ? r.cell!.packagesWithdrawing / r.cell!.packages : 0);
  const detail = (r: Row) => {
    const c = r.cell!;
    const versions = c.versionsInWindow ? ` · ${pctSmall(c.withdrawnVersions / c.versionsInWindow)} of ${c.versionsInWindow} versions` : "";
    return `(${c.packagesWithdrawing}/${c.packages}) · ${c.withdrawnVersions} versions${versions}`;
  };

  const panel = plot({
    width: 236 + 320 + 300,
    height: 24 + rows.length * rowH,
    marginTop: 24,
    marginLeft: 236,
    marginRight: 300,
    marginBottom: 0,
    x: { domain: [0, 1], axis: null },
    y: { domain: rows.map((r) => r.label), padding: 0, axis: null },
    marks: [
      Plot.axisX({ anchor: "top", ticks: QUARTILES, tickFormat: "%", tickSize: 0, fontSize: 10, fill: MUTED, label: null }),
      Plot.axisY({ tickSize: 0, tickPadding: 12, fontSize: 12, fill: INK, label: null }),
      // Gridlines only behind bar rows, so they never cross a text row.
      Plot.ruleX(bars.flatMap((r) => QUARTILES.map((p) => ({ x: p, y: r.label }))), { x: "x", y: "y", stroke: GRID }),
      ...shareBars(bars, { y: (r) => r.label, share: shareOf, title: (r) => `${r.label}: ${r.cell!.packagesWithdrawing} of ${r.cell!.packages} packages, ${r.cell!.withdrawnVersions} versions`, rowH }),
      Plot.text(bars, { x: 1, y: "label", dx: 12, textAnchor: "start", fontSize: 11, text: (r: Row) => `${pctText(shareOf(r))} ${detail(r)}` }),
      Plot.text(rows.filter((r) => r.blind), { x: 0, y: "label", textAnchor: "start", fontSize: 11, fill: INK_2, text: "blind" }),
    ],
  });
  return figure({
    title: "Withdrawn versions: how often containment is used",
    subtitle: `Share of sampled packages that withdrew at least one version published since ${humanDate(agg.withdrawalWindowStart ?? agg.asOf, true)} · snapshot ${humanDate(agg.asOf)}`,
    panels: [panel],
    notes: ["Go retractions are undated, so they are counted over each module's whole history. Deprecation only warns; the version still installs."],
  });
}

/**
 * Known advisories, two ways. Left: the share of latest releases with an advisory published
 * by the snapshot. Right: for the release a default install resolved at the end of the first
 * quarter, whether an advisory existed then and whether one exists now; the gap is what was
 * installed before anyone knew. Two states of one measure, so two steps of one ramp.
 */
export function advisoriesSvg(agg: Aggregate): string {
  const adv = agg.advisories;
  const first = agg.quarters[0];
  const rows = adv.exposure.filter((c) => c.checked > 0);
  const labels = rows.map((c) => ECOSYSTEM_LABEL[c.ecosystem]);
  const rowH = 34;
  type Row = (typeof rows)[number];
  const share = (c: Row) => c.affected / c.checked;

  const left = plot({
    width: 120 + 220 + 250,
    height: 64 + rows.length * rowH,
    marginTop: 64,
    marginLeft: 120,
    marginRight: 250,
    marginBottom: 0,
    x: { domain: [0, 1], axis: null },
    y: { domain: labels, padding: 0, axis: null },
    marks: [
      Plot.text(["Latest release"], { frameAnchor: "top-left", dy: -50, fontSize: 11, fontWeight: 600, fill: INK_2 }),
      Plot.text(["with an advisory published by the snapshot"], { frameAnchor: "top-left", dy: -37, fontSize: 11, fill: MUTED }),
      Plot.axisX({ anchor: "top", ticks: QUARTILES, tickFormat: "%", tickSize: 0, fontSize: 10, fill: MUTED, label: null }),
      Plot.axisY({ tickSize: 0, tickPadding: 12, fontSize: 12, fill: INK, label: null }),
      ...shareBars(rows, {
        y: (c) => ECOSYSTEM_LABEL[c.ecosystem],
        share,
        title: (c) => `${ECOSYSTEM_LABEL[c.ecosystem]}: ${c.affected} of ${c.checked} latest releases have a known advisory (${c.vulnerabilities} vulnerabilities, ${c.malicious} malware reports)`,
        rowH,
      }),
      Plot.text(rows, {
        x: 1,
        y: (c: Row) => ECOSYSTEM_LABEL[c.ecosystem],
        dx: 12,
        textAnchor: "start",
        fontSize: 11,
        text: (c: Row) => `${pctText(share(c))} (${c.affected}/${c.checked}) · ${c.vulnerabilities} vuln.${c.malicious ? ` · ${c.malicious} malware` : ""}`,
      }),
    ],
  });

  type Point = { label: string; then: number; now: number; p: (typeof adv.series)[number] };
  const points: Point[] = adv.series
    .filter((p) => p.quarter === first && p.n > 0)
    .map((p) => ({ label: ECOSYSTEM_LABEL[p.ecosystem], then: p.knownThen / p.n, now: p.knownNow / p.n, p }))
    .filter((d) => labels.includes(d.label));
  const tip = (d: Point) => `${d.label}, release chosen at the end of ${first}: ${d.p.knownThen} of ${d.p.n} had an advisory then, ${d.p.knownNow} have one now`;
  const right = plot({
    width: 24 + 220 + 120,
    height: 64 + rows.length * rowH,
    marginTop: 64,
    marginLeft: 24,
    marginRight: 120,
    marginBottom: 0,
    x: { domain: [0, 1], axis: null },
    // No bar mark here, so without an explicit band scale Plot would infer a point scale and the rows would not line up with the left panel.
    y: { type: "band", domain: labels, padding: 0, axis: null },
    marks: [
      Plot.text([`Release chosen at the end of ${first}`], { frameAnchor: "top-left", dy: -50, fontSize: 11, fontWeight: 600, fill: INK_2 }),
      Plot.text(["with an advisory: known then → known now"], { frameAnchor: "top-left", dy: -37, fontSize: 11, fill: MUTED }),
      Plot.axisX({ anchor: "top", ticks: QUARTILES, tickFormat: "%", tickSize: 0, fontSize: 10, fill: MUTED, label: null }),
      Plot.ruleX(labels.flatMap((y) => QUARTILES.map((x) => ({ x, y }))), { x: "x", y: "y", stroke: GRID }),
      Plot.link(points, { x1: "then", x2: "now", y1: "label", y2: "label", stroke: RAMP[6], strokeWidth: 2 }),
      Plot.dot(points, { x: "then", y: "label", r: 5, fill: RAMP[3], stroke: SURFACE, strokeWidth: 2, title: tip }),
      Plot.dot(points, { x: "now", y: "label", r: 5, fill: RAMP[10], stroke: SURFACE, strokeWidth: 2, title: tip }),
      Plot.text(points, { x: 1, y: "label", dx: 12, textAnchor: "start", fontSize: 11, text: (d: Point) => `${pctText(d.then)} → ${pctText(d.now)}` }),
    ],
  });

  const malware = adv.malicious.length;
  return figure({
    title: "Known advisories (OSV)",
    subtitle: `Sampled packages whose release is listed in an advisory, counting each vulnerability once across databases · snapshot ${humanDate(agg.asOf)}`,
    legend: [
      { label: `known at the end of ${first}`, fill: RAMP[3]!, outline: true },
      { label: "known at the snapshot", fill: RAMP[10]! },
    ],
    panels: [left, { ...right, x: left.width }],
    notes: [
      `OSV queried ${adv.queriedFrom ? humanDate(adv.queriedFrom, true) : "–"}. Known = first published in any database by that time; withdrawn records are left out.`,
      `${malware} sampled or withdrawn release${malware === 1 ? " carries" : "s carry"} a malware report; advisories.md lists each, with the hours from release to report.`,
    ],
  });
}

// ---------------------------------------------------------------------------------------
// Adoption over time

/** Ecosystems whose availability for this signal yields a measurable series. */
export function measurable(agg: Aggregate, signal: SignalId): EcosystemId[] {
  return ECOSYSTEMS.filter((e) => {
    const c = agg.matrix.find((m) => m.ecosystem === e && m.signal === signal);
    return c && (c.availability === "observable" || c.availability === "inferred");
  });
}

export function adoptionSvg(agg: Aggregate, signal: SignalId): string {
  const ecosystems = measurable(agg, signal);
  const inferred = ecosystems.filter((e) => agg.matrix.find((c) => c.ecosystem === e && c.signal === signal)?.availability === "inferred");
  const qs = agg.quarters;
  const points = agg.series.filter((s) => s.signal === signal && ecosystems.includes(s.ecosystem) && s.pct != null && qs.includes(s.quarter));
  const lasts = ecosystems.flatMap((e) => points.filter((p) => p.ecosystem === e).sort((a, b) => qs.indexOf(a.quarter) - qs.indexOf(b.quarter)).slice(-1));
  const height = 260;

  // Direct end labels only where they do not collide; the legend carries the rest.
  const px = (p: number) => (1 - p) * height;
  const sorted = [...lasts].sort((a, b) => b.pct! - a.pct!);
  const labelled = sorted.filter((d, k) => {
    const prev = sorted[k - 1];
    const next = sorted[k + 1];
    return (!prev || px(d.pct!) - px(prev.pct!) >= 13) && (!next || px(next.pct!) - px(d.pct!) >= 13);
  });

  // Label every other quarter when crowded, always including the last.
  const every = qs.length > 8 ? 2 : 1;
  const ticks = qs.filter((_, i) => i % every === 0 || i === qs.length - 1);

  const panel = plot({
    width: 680,
    height: 8 + height + 28,
    marginTop: 8,
    marginLeft: 48,
    marginRight: 112,
    marginBottom: 28,
    x: { type: "point", domain: qs, padding: 0, axis: null },
    y: { domain: [0, 1], axis: null },
    color: { domain: ECOSYSTEMS, range: ECOSYSTEMS.map((e) => SERIES[e]) },
    marks: [
      Plot.gridY(QUARTILES, { stroke: GRID, strokeOpacity: 1 }),
      Plot.axisY({ ticks: QUARTILES, tickFormat: "%", tickSize: 0, tickPadding: 8, fontSize: 10, fill: MUTED, label: null }),
      Plot.axisX({ ticks, tickSize: 0, tickPadding: 8, fontSize: 10, fill: MUTED, label: null }),
      ecosystems.length === 0 ? Plot.text(["No ecosystem exposes this signal"], { frameAnchor: "middle", fontSize: 12, fill: INK_2 }) : null,
      Plot.line(points, { x: "quarter", y: "pct", stroke: "ecosystem", strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      // Invisible enlarged hit targets; the visible dot only at the series end.
      Plot.dot(points, { x: "quarter", y: "pct", r: 8, fill: "transparent", title: (p: SeriesPoint) => `${ECOSYSTEM_LABEL[p.ecosystem]} ${p.quarter}: ${pctText(p.pct)} (${p.t}/${p.n}; ${p.u} unknown)` }),
      Plot.dot(lasts, { x: "quarter", y: "pct", r: 4, fill: "ecosystem", stroke: SURFACE, strokeWidth: 2 }),
      Plot.text(labelled, { x: "quarter", y: "pct", dx: 10, textAnchor: "start", fontSize: 11, fill: INK, text: (p: SeriesPoint) => `${ECOSYSTEM_LABEL[p.ecosystem]} ${pctText(p.pct)}` }),
    ],
  });
  return figure({
    title: `${SIGNAL_LABEL[signal]}: adoption by quarter`,
    subtitle: "Share of sampled packages whose installable release at quarter end carried the signal",
    legend: ecosystems.map((e) => ({ label: `${ECOSYSTEM_LABEL[e]}${inferred.includes(e) ? " (≥)" : ""}`, fill: SERIES[e], line: true })),
    panels: [panel],
    notes: inferred.length ? ["(≥) inferred signal: unknowns count as not adopted, so the line is a lower bound."] : [],
  });
}

// ---------------------------------------------------------------------------------------
// Trust summary

const STRONG = RAMP[9];
const WEAK = RAMP[3];
const SCORE_ROW = 50;
const SCORE_HEADER = 62;
const SCORE_BAR = 12;
const SCORE_BAR_W = 160;
/** Bar sits in the upper part of the row, its formula below it; offsets from the row centre. */
const BAR_TOP = 9;
const BAR_DY = BAR_TOP + SCORE_BAR / 2 - SCORE_ROW / 2;
const FORMULA_DY = BAR_DY + 17;

/** "½" for a half, else the number. */
const half = (k: number) => (k === 0.5 ? "½" : String(k));

/**
 * The trust summary, drawn as its own calculation. One panel per category: the bar splits
 * the sampled packages by the level their release reached, and the line under it is the
 * arithmetic, in package counts, that gives the category value. The last panel averages
 * the three category values into the score.
 */
export function scoresSvg(agg: Aggregate): string {
  const rows = [...agg.scores]
    .sort((a, b) => (b.assuranceLow ?? 0) - (a.assuranceLow ?? 0) || b.capability - a.capability)
    .map((r) => ({ ...r, name: ECOSYSTEM_LABEL[r.ecosystem] }));
  const names = rows.map((r) => r.name);
  const range = (lo: number | null, hi: number | null) =>
    lo == null ? "–" : hi != null && hi - lo >= 0.005 ? `${Math.round(lo * 100)}–${pctText(hi)}` : pctText(lo);

  const frame = (marginLeft: number, marginRight: number, header: string[]) => ({
    width: marginLeft + SCORE_BAR_W + marginRight,
    height: SCORE_HEADER + rows.length * SCORE_ROW,
    marginTop: SCORE_HEADER,
    marginLeft,
    marginRight,
    marginBottom: 0,
    x: { domain: [0, 1], axis: null },
    y: { domain: names, padding: 0, axis: null },
    header: header.map((text, i) =>
      Plot.text([text], { frameAnchor: "top-left", dy: -SCORE_HEADER + 10 + i * 15, textAnchor: "start", fontSize: i ? 10.5 : 12, fontWeight: i ? 400 : 600, fill: i ? INK_2 : INK }),
    ),
  });
  const bar = { y: "name", insetTop: BAR_TOP, insetBottom: SCORE_ROW - BAR_TOP - SCORE_BAR } as const;

  const categoryPanels = CATEGORIES.map((cat, i) => {
    const [strong, weak] = cat.levels;
    const f = frame(i === 0 ? 120 : 0, 92, [CATEGORY_LABEL[cat.id], `${SIGNAL_LABEL[strong.signal]} = ${half(strong.points)}`, `${SIGNAL_LABEL[weak.signal]} = ${half(weak.points)}`]);
    const cells = rows.map((r) => ({ name: r.name, n: r.n, ecosystem: r.ecosystem, ...r.categories[i]! }));
    const offered = cells.filter((c) => c.capability > 0);
    const where = (c: (typeof cells)[number]) => `${ECOSYSTEM_LABEL[c.ecosystem]} · ${CATEGORY_LABEL[cat.id]}`;

    // Strong, weak, weak-but-maybe-strong, unknown: consecutive segments of the packages.
    const segments = offered.flatMap((c) => {
      const parts = [
        { k: c.counts.strong, fill: STRONG, what: `strong (${SIGNAL_LABEL[strong.signal]})` },
        { k: c.counts.weak, fill: WEAK, what: `weak (${SIGNAL_LABEL[weak.signal]})` },
        { k: c.counts.weakOrStrong, fill: "url(#hatch-weak)", what: `weak, strong unknown` },
        { k: c.counts.unknown, fill: HATCH_FILL, what: "no known level, a signal unknown" },
      ];
      let x = 0;
      return parts.filter((p) => p.k > 0).map((p) => {
        const x1 = x;
        x += p.k / c.n;
        return { name: c.name, x1, x2: x, fill: p.fill, title: `${where(c)}: ${p.k} of ${c.n} packages ${p.what}` };
      });
    });
    const formula = (c: (typeof cells)[number]) => {
      const weakCount = c.counts.weak + c.counts.weakOrStrong;
      const terms = c.capability === 1 ? `${c.counts.strong} × 1 + ${weakCount} × ½` : `${weakCount} × ½`;
      const unknown = c.counts.weakOrStrong + c.counts.unknown;
      return `(${terms}) ÷ ${c.n}${unknown ? ` · ${unknown} unknown` : ""}${c.capability < 1 ? " · no strong level" : ""}`;
    };

    return plot({
      ...f,
      marks: [
        ...f.header,
        i === 0 ? Plot.axisY({ tickSize: 0, tickPadding: 12, fontSize: 12, fill: INK, label: null, dy: BAR_DY }) : null,
        Plot.barX(offered, { ...bar, x1: 0, x2: 1, fill: NEUTRAL, rx: 3, title: (c) => `${where(c)}: ${c.counts.none} of ${c.n} packages at no level` }),
        Plot.barX(segments, { ...bar, x1: "x1", x2: "x2", fill: "fill", insetRight: 1, insetLeft: 1, title: "title" }),
        Plot.text(offered, { y: "name", x: 1, dx: 10, dy: BAR_DY, textAnchor: "start", fontSize: 12, fontWeight: 600, text: (c) => range(c.assuranceLow, c.assuranceHigh) }),
        Plot.text(offered, { y: "name", x: 0, dy: FORMULA_DY, textAnchor: "start", fontSize: 10, fill: INK_2, text: formula }),
        Plot.text(cells.filter((c) => c.capability === 0), { y: "name", x: 0, dy: BAR_DY, textAnchor: "start", fontSize: 11, fill: MUTED, text: () => "no mechanism (0)" }),
      ],
    });
  });

  const f = frame(0, 92, ["Score", `Mean of the ${CATEGORIES.length} categories`, "Capability: points the platform offers"]);
  const scorePanel = plot({
    ...f,
    marks: [
      ...f.header,
      Plot.barX(rows, { ...bar, x1: 0, x2: 1, fill: NEUTRAL, rx: 3 }),
      Plot.barX(rows.filter((r) => (r.assuranceLow ?? 0) > 0), { ...bar, x1: 0, x2: "assuranceLow", fill: STRONG, insetRight: 1, title: (r) => `${r.name}: score ${range(r.assuranceLow, r.assuranceHigh)}` }),
      Plot.barX(rows.filter((r) => (r.assuranceHigh ?? 0) - (r.assuranceLow ?? 0) >= 0.005), { ...bar, x1: "assuranceLow", x2: "assuranceHigh", fill: HATCH_FILL, insetLeft: 1, title: (r) => `${r.name}: up to ${pctText(r.assuranceHigh)} if unknown signals hold` }),
      Plot.text(rows, { y: "name", x: 1, dx: 10, dy: BAR_DY, textAnchor: "start", fontSize: 13, fontWeight: 700, text: (r) => range(r.assuranceLow, r.assuranceHigh) }),
      Plot.text(rows, {
        y: "name", x: 0, dy: FORMULA_DY, textAnchor: "start", fontSize: 10, fill: INK_2,
        text: (r: (typeof rows)[number]) => `(${r.categories.map((c) => Math.round((c.assuranceLow ?? 0) * 100)).join(" + ")}) ÷ ${CATEGORIES.length} · capability ${pointsText(r.capability)}`,
      }),
    ],
  });

  const GAP = 20;
  let x = 0;
  const panels = [...categoryPanels, scorePanel].map((p, i) => {
    const placed = { ...p, x: x + (i === 0 ? 0 : GAP) };
    x = placed.x + p.width;
    return placed;
  });
  return figure({
    title: "Trust summary per platform",
    subtitle: `Latest release of each sampled package (n = ${rows[0]?.n ?? 0} per platform) · snapshot ${humanDate(agg.asOf)}`,
    legend: [
      { label: "strong level: 1 point", fill: STRONG },
      { label: "weak level: ½ point", fill: WEAK },
      { label: "weak, strong unknown", fill: "url(#hatch-weak)" },
      { label: "unknown", fill: HATCH_FILL },
      { label: "neither: 0", fill: NEUTRAL, outline: true },
    ],
    panels,
    notes: [
      "Each category: a release earns 1 point for the strong signal, ½ for only the weak one, 0 for neither. The category value is the mean over",
      "packages, (strong × 1 + weak × ½) ÷ n; the score is the mean of the three category values. Ranges: the upper end counts unknown signals as",
      "present. Transparency log is not scored, because every Sigstore signature is logged. ½ is a convention (docs/methodology.md).",
    ],
  });
}
