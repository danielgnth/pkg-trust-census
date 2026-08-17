/**
 * Quarter-anchor selection for the backfill.
 *
 * Because crates.io reports `trustpub_data` per version and PyPI/npm expose attestations
 * per version, adoption-over-time is derivable from a single snapshot rather than from
 * repeated crawls. An anchor is the version a consumer would actually have installed at
 * that moment: the newest release published at or before the quarter boundary.
 */

export const BACKFILL_START = "2024-01-01T00:00:00Z";

export interface VersionLike {
  version: string;
  publishedAt: string | null;
}

/** Quarter boundaries from BACKFILL_START up to `until`, as "YYYYQn" -> boundary instant. */
export function quarterBoundaries(until: Date = new Date()): Array<{ label: string; at: Date }> {
  const out: Array<{ label: string; at: Date }> = [];
  const start = new Date(BACKFILL_START);
  let year = start.getUTCFullYear();
  let q = 1;

  while (true) {
    // Boundary is the *end* of the quarter: the state of the world as that quarter closed.
    const at = new Date(Date.UTC(year, q * 3, 1));
    if (at > until) break;
    out.push({ label: `${year}Q${q}`, at });
    if (++q > 4) {
      q = 1;
      year++;
    }
  }
  return out;
}

/**
 * Maps each quarter to the newest version published at or before its boundary.
 *
 * A version may anchor several consecutive quarters (a package that went a year without a
 * release), and quarters before the package's first release get no anchor at all — that
 * absence is recorded as "did not yet exist", not as a missing measurement.
 */
export function selectQuarterAnchors<T extends VersionLike>(
  versions: T[],
  until: Date = new Date(),
): Map<string, T> {
  const dated = versions
    .filter((v): v is T & { publishedAt: string } => Boolean(v.publishedAt))
    .map((v) => ({ v, t: Date.parse(v.publishedAt) }))
    .filter(({ t }) => Number.isFinite(t))
    .sort((a, b) => a.t - b.t);

  const anchors = new Map<string, T>();
  if (dated.length === 0) return anchors;

  for (const { label, at } of quarterBoundaries(until)) {
    const cutoff = at.getTime();
    let chosen: T | null = null;
    for (const { v, t } of dated) {
      if (t <= cutoff) chosen = v;
      else break;
    }
    if (chosen) anchors.set(label, chosen);
  }
  return anchors;
}

/**
 * Inverse view: version -> the quarters it anchors, joined for the `quarter_anchor` column.
 * One row per version means a version anchoring several quarters records all of them.
 */
export function anchorLabelsByVersion<T extends VersionLike>(
  anchors: Map<string, T>,
): Map<string, string> {
  const byVersion = new Map<string, string[]>();
  for (const [label, v] of anchors) {
    const list = byVersion.get(v.version) ?? [];
    list.push(label);
    byVersion.set(v.version, list);
  }
  return new Map([...byVersion].map(([k, v]) => [k, v.sort().join(",")]));
}
