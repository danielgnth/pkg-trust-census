#!/usr/bin/env bun
/**
 * Archives every source in src/sources/registry.ts under sources/, so the passages the facts
 * quote stay readable and checkable after the page changes or disappears.
 *
 * Each distinct page is fetched once (sources differing only by #fragment share it). HTML is
 * reduced to its main content as Markdown (Readability + Turndown); GitHub blob links are
 * fetched as raw files; JSON and source files are kept as they are. A measurement source is
 * archived by running its command. sources/manifest.json records, per source, what was
 * fetched, when, its HTTP status and the sha256 of the original body. docs/sources.md is
 * regenerated from the manifest.
 *
 *   bun run sources                 # archive sources missing from the manifest
 *   bun run sources --refresh       # re-archive everything
 *   bun run sources --only a,b      # re-archive these ids
 */

import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import ky from "ky";
import PQueue from "p-queue";
import TurndownService from "turndown";
import { USER_AGENT } from "../src/http/client.ts";
import { MANIFEST_PATH, SOURCES_DIR, type ArchiveEntry } from "../src/sources/index.ts";
import { SOURCES, type SourceId } from "../src/sources/registry.ts";
import { ALL_CITES } from "../src/facts/citations.ts";

const { values: args } = parseArgs({ options: { refresh: { type: "boolean" }, only: { type: "string" } } });

const manifest: Partial<Record<SourceId, ArchiveEntry>> = await Bun.file(MANIFEST_PATH).json().catch(() => ({}));
const ids = (Object.keys(SOURCES) as SourceId[]).filter((id) =>
  args.only ? args.only.split(",").includes(id) : args.refresh || !manifest[id],
);

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-" });

/** GitHub renders blobs as an app shell; the raw file is the content. */
function fetchUrl(url: string): string {
  const u = new URL(url);
  u.hash = "";
  const blob = /^\/([^/]+)\/([^/]+)\/blob\/(.+)$/.exec(u.pathname);
  return u.host === "github.com" && blob ? `https://raw.githubusercontent.com/${blob[1]}/${blob[2]}/${blob[3]}` : u.toString();
}

/** Readable, stable file name for a page: host and path, nothing else. */
function archiveName(url: string, ext: string): string {
  const u = new URL(url);
  const slug = `${u.host}${u.pathname}`.replace(/\.(html?|md|json|txt)$/, "").replace(/\.[A-Za-z0-9]+$/, (e) => (e === ext ? "" : e)).replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return join(SOURCES_DIR, "archive", `${slug.slice(0, 120)}${ext}`);
}

interface Converted {
  text: string;
  ext: string;
  title: string | null;
}

function convert(body: string, contentType: string, url: string): Converted {
  const path = new URL(url).pathname;
  if (contentType.includes("json") || /\.json$/.test(path)) {
    try {
      return { text: JSON.stringify(JSON.parse(body), null, 2) + "\n", ext: ".json", title: path.split("/").pop() ?? null };
    } catch {
      // Not JSON after all: fall through.
    }
  }
  if (!contentType.includes("html")) {
    const ext = /\.[A-Za-z0-9]+$/.exec(path)?.[0] ?? ".txt";
    return { text: body, ext, title: path.split("/").pop() ?? null };
  }
  const { document } = parseHTML(body);
  const pageTitle = document.querySelector("title")?.textContent?.trim() ?? null;
  let article: ReturnType<Readability["parse"]> = null;
  try {
    article = new Readability(document.cloneNode(true) as typeof document).parse();
  } catch {
    // Readability gives up on very small pages; the page's own content element is used then.
  }
  for (const el of document.querySelectorAll("script, style, noscript, nav, header, footer, form, aside")) el.remove();
  // Pages without a <body> tag leave linkedom's body empty, hence the fallback to the root.
  const candidates = [document.querySelector("main"), document.querySelector("article"), document.body, document.documentElement];
  const whole = candidates.find((el) => el?.textContent?.trim())?.innerHTML ?? body;
  // Readability sometimes keeps a sidebar instead of the post; then the container is better.
  const textLength = (html: string) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").length;
  const html = article?.content && textLength(article.content) >= 0.5 * textLength(whole) ? article.content : whole;
  return { text: turndown.turndown(html).trim() + "\n", ext: ".md", title: article?.title?.trim() || pageTitle };
}

/** The target of a `<meta http-equiv="refresh">` redirect, which fetch does not follow. */
function metaRefresh(body: string, base: string): string | null {
  const m = /<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["'][^"']*url=['"]?([^"'>\s]+)/i.exec(body);
  return m ? new URL(m[1]!, base).toString() : null;
}

async function archiveUrl(url: string): Promise<Omit<ArchiveEntry, "accessedAt"> & { accessedAt: string }> {
  const fetched = fetchUrl(url);
  const accessedAt = new Date().toISOString();
  const get = (u: string) =>
    ky(u, { headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/json;q=0.9,*/*;q=0.8" }, timeout: 60_000, retry: { limit: 3 } });
  let res = await get(fetched);
  let body = await res.text();
  for (let hops = 0, next = metaRefresh(body, res.url); next && hops < 3; hops++, next = metaRefresh(body, res.url)) {
    res = await get(next);
    body = await res.text();
  }
  const contentType = res.headers.get("content-type") ?? "";
  const { text, ext, title } = convert(body, contentType, fetched);
  const archive = archiveName(fetched, ext);
  await Bun.write(archive, text);
  return { fetched, finalUrl: res.url, status: res.status, contentType, accessedAt, title, sha256: sha256(body), archive };
}

async function archiveCommand(id: SourceId, command: readonly string[], repoPath: string): Promise<ArchiveEntry> {
  const accessedAt = new Date().toISOString();
  const proc = Bun.spawn([...command], { stdout: "pipe", stderr: "inherit" });
  const out = await new Response(proc.stdout).text();
  if ((await proc.exited) !== 0) throw new Error(`${command.join(" ")} failed`);
  const archive = join(SOURCES_DIR, "archive", `${id}.txt`);
  await Bun.write(archive, out);
  return { fetched: command.join(" "), accessedAt, title: repoPath, sha256: sha256(out), archive };
}

// One fetch per distinct page, paced per host.
const queues = new Map<string, PQueue>();
const pages = new Map<string, Promise<ArchiveEntry>>();
const failures: string[] = [];

await Promise.all(
  ids.map(async (id) => {
    const def = SOURCES[id];
    try {
      if (typeof def === "string") {
        const key = fetchUrl(def);
        if (!pages.has(key)) {
          const host = new URL(key).host;
          if (!queues.has(host)) queues.set(host, new PQueue({ concurrency: 1, interval: 1000, intervalCap: 1 }));
          pages.set(key, queues.get(host)!.add(() => archiveUrl(def)));
        }
        manifest[id] = await pages.get(key)!;
      } else {
        manifest[id] = await archiveCommand(id, def.command, def.repoPath);
      }
      console.log(`ok    ${id}  ${manifest[id]!.archive}`);
    } catch (err) {
      failures.push(id);
      console.error(`FAIL  ${id}  ${err instanceof Error ? err.message : String(err)}`);
    }
  }),
);

const sorted = Object.fromEntries((Object.keys(SOURCES) as SourceId[]).filter((id) => manifest[id]).map((id) => [id, manifest[id]]));
await mkdir(SOURCES_DIR, { recursive: true });
await Bun.write(MANIFEST_PATH, JSON.stringify(sorted, null, 2) + "\n");
await Bun.write("docs/sources.md", sourcesMarkdown());
console.log(`\n${ids.length - failures.length}/${ids.length} archived${failures.length ? `; failed: ${failures.join(", ")}` : ""}`);
if (failures.length) process.exit(1);

function sourcesMarkdown(): string {
  const citedBy = new Map<SourceId, number>();
  for (const c of ALL_CITES) citedBy.set(c.source, (citedBy.get(c.source) ?? 0) + 1);
  const rows = (Object.keys(SOURCES) as SourceId[]).map((id) => {
    const def = SOURCES[id];
    const a = manifest[id];
    const url = typeof def === "string" ? def : def.repoPath;
    const link = typeof def === "string" ? url : `../${url}`;
    const title = (a?.title ?? url).replace(/\|/g, "\\|");
    const archive = a ? `[archive](../${a.archive})` : "not archived";
    return `| <a id="${id}"></a>\`${id}\` | [${title}](${link}) | ${a ? a.accessedAt.slice(0, 10) : "–"} | ${archive} | ${citedBy.get(id) ?? 0} |`;
  });
  return [
    "# Sources",
    "",
    "Every source the curated facts cite, generated by `bun run sources` from",
    "[`src/sources/registry.ts`](../src/sources/registry.ts) and [`sources/manifest.json`](../sources/manifest.json).",
    "Each fact quotes the passage it rests on; `bun test` checks every quote against the archived copy.",
    "",
    "| Id | Source | Accessed | Archived copy | Citations |",
    "|---|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
}
