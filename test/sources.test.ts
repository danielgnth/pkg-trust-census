/**
 * Every citation must quote its source verbatim, checked against the archived copy, and every
 * source URL must live in src/sources/registry.ts and nowhere else. Facts cannot hold a bare URL
 * as a source at all: `sources` is typed `Cite[]`.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { ALL_CITES } from "../src/facts/citations.ts";
import { archived, normalize, SOURCES, type SourceId } from "../src/sources/index.ts";

const ids = Object.keys(SOURCES) as SourceId[];
const archives = new Map<string, string>();
function archiveText(id: SourceId): string | null {
  const a = archived(id);
  if (!a) return null;
  if (!archives.has(a.archive)) archives.set(a.archive, normalize(readFileSync(a.archive, "utf8")));
  return archives.get(a.archive)!;
}

describe("sources", () => {
  test("every source is archived", () => {
    expect(ids.filter((id) => !archived(id))).toEqual([]);
  });

  test("every source is cited at least once", () => {
    const cited = new Set(ALL_CITES.map((c) => c.source));
    expect(ids.filter((id) => !cited.has(id))).toEqual([]);
  });

  test("every quote appears in its archived source", () => {
    const missing = ALL_CITES.filter((c) => !archiveText(c.source)?.includes(normalize(c.quote))).map((c) => `${c.source}: ${c.quote}`);
    expect(missing).toEqual([]);
  });

  test("source URLs appear only in the registry", () => {
    // Whole-URL comparison, since registry API endpoints share hosts with some sources. A bare
    // origin (https://proxy.golang.org) is an API root or homepage, not a citation.
    const canonical = (u: string) => u.replace(/[#?].*$/, "").replace(/\/$/, "");
    const isOrigin = (u: string) => new URL(u).pathname.replace(/\/$/, "") === "";
    const urls = new Set(ids.flatMap((id): string[] => { const d = SOURCES[id]; return typeof d === "string" ? [canonical(d)] : []; }));
    const files = ["src", "scripts", "docs", "README.md"].flatMap(walk).filter((f) => !f.endsWith("src/sources/registry.ts") && !f.endsWith("docs/sources.md"));
    const offenders = files.flatMap((f) =>
      [...readFileSync(f, "utf8").matchAll(/https?:\/\/[^\s"'`)<>\]|,;]+/g)].map((m) => canonical(m[0])).filter((u) => urls.has(u) && !isOrigin(u)).map((u) => `${f}: ${u}`),
    );
    expect(offenders).toEqual([]);
  });
});

function walk(path: string): string[] {
  if (statSync(path).isFile()) return [path];
  return readdirSync(path).flatMap((e) => walk(join(path, e)));
}
