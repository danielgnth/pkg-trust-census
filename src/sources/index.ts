/**
 * Citations: a fact names a source by id and quotes the passage it rests on. The quote is
 * checked against the archived copy of the source (test/sources.test.ts), so a claim cannot
 * silently drift from its evidence, and a reader can see the exact words without the page
 * still being online.
 */

import { join, relative } from "node:path";
import manifestJson from "../../sources/manifest.json" with { type: "json" };
import { SOURCES, type SourceId } from "./registry.ts";

export { SOURCES, type SourceId } from "./registry.ts";

export interface Cite {
  source: SourceId;
  /** Verbatim passage from the archived source (whitespace and typography may differ). */
  quote: string;
}

export const cite = (source: SourceId, quote: string): Cite => ({ source, quote });

/** What `bun run sources` recorded when it archived a source. */
export interface ArchiveEntry {
  /** What was requested: the source URL, its raw-file form for GitHub blobs, or the command. */
  fetched: string;
  /** After redirects. */
  finalUrl?: string;
  status?: number;
  contentType?: string;
  /** ISO time the source was accessed. */
  accessedAt: string;
  title: string | null;
  /** sha256 of the response body (or command output) before conversion. */
  sha256: string;
  /** Repo-relative path of the archived text; sources sharing a page share the file. */
  archive: string;
}

export const SOURCES_DIR = "sources";
export const MANIFEST_PATH = join(SOURCES_DIR, "manifest.json");

const manifest = manifestJson as Partial<Record<SourceId, ArchiveEntry>>;

export function archived(id: SourceId): ArchiveEntry | undefined {
  return manifest[id];
}

/** The link a reader follows: the URL, or the script for a measurement. */
export function sourceUrl(id: SourceId): string {
  const def = SOURCES[id];
  return typeof def === "string" ? def : def.repoPath;
}

/** "accessed 2026-10-14", or "not archived" before `bun run sources` has run. */
export function accessedLabel(id: SourceId): string {
  const a = archived(id);
  return a ? `accessed ${a.accessedAt.slice(0, 10)}` : "not archived";
}

/**
 * Folds the differences between a hand-copied quote and the archived Markdown: link syntax,
 * Markdown escapes and emphasis, typographic quotes and dashes, whitespace and case.
 */
export function normalize(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\\([\\`*_{}[\]()#+\-.!|<>~=])/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—‑]/g, "-")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** One entry per cited source, in first-cited order, with every passage quoted from it. */
function bySource(cites: Cite[]): Array<{ id: SourceId; quotes: string[] }> {
  const out = new Map<SourceId, string[]>();
  for (const c of cites) out.set(c.source, [...(out.get(c.source) ?? []), c.quote]);
  return [...out].map(([id, quotes]) => ({ id, quotes }));
}

/**
 * Numbered Markdown links; hovering one shows the quoted passages and the access date. `from` is
 * the directory the Markdown is written to, so a source in this repository links relatively.
 */
export function citeLinks(cites: Cite[], from: string): string {
  return bySource(cites)
    .map(({ id, quotes }, i) => {
      const title = `${quotes.map((q) => `“${q}”`).join(" … ")} (${accessedLabel(id)})`.replace(/"/g, "'");
      const url = sourceUrl(id);
      return `[${i + 1}](${/^https?:/.test(url) ? url : relative(from, url)} "${title}")`;
    })
    .join(" ");
}

/** The cited URLs, space-separated, for CSV columns. */
export function citeUrls(cites: Cite[]): string {
  return bySource(cites)
    .map(({ id }) => sourceUrl(id))
    .join(" ");
}

/** The newest access date among the cited sources: when these facts were last checked. */
export function lastAccessed(cites: Cite[]): string {
  return cites.map((c) => archived(c.source)?.accessedAt.slice(0, 10) ?? "").sort().at(-1) ?? "";
}
