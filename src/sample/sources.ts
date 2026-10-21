/**
 * Where each registry's random draw gets its name list, and how it checks activity
 * (docs/registries.md, "Random sample"). First-party wherever the registry publishes a list:
 *
 *   PyPI       Simple API root (every project)          activity: the project's Simple API page
 *   crates.io  daily database dump                      activity: from the dump
 *   RubyGems   weekly PostgreSQL dump                   activity: from the dump
 *   Go         module index, over the activity window   activity: from the index
 *   Packagist  packages/list.json                       activity: the package's p2 metadata
 *   npm        deps.dev BigQuery                        activity: the packument
 *   Maven      deps.dev BigQuery                        activity: maven-metadata.xml
 *
 * The activity checks request what the adapters request where they can (PyPI's Simple page,
 * npm's packument, Maven's metadata), so an accepted package's first `fetch` request is a cache hit.
 */

import { createReadStream } from "node:fs";
import { appendFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { parse } from "csv-parse";
import { extract } from "tar-stream";
import type { EcosystemId } from "../types.ts";
import { sha256File, type BulkFile, type HttpClient } from "../http/client.ts";
import { SIMPLE_ACCEPT, groupByVersion, normalizeName, simpleUrl, type SimpleIndex } from "../adapters/pypi.ts";
import { packumentUrl, type Packument } from "../adapters/npm.ts";
import { artifactBase } from "../adapters/maven.ts";
import { activityWindowStart, newestBefore, type DrawContext, type DrawSource, type NameList } from "./draw.ts";
import { bigqueryNames } from "../bigquery/names.ts";
import validateNpmName from "validate-npm-package-name";

/** Cache key for the draw's own requests (p2 metadata), beside the adapters' per-package keys. */
const DRAW_KEY = "_draw";

const pypi: DrawSource = {
  ecosystem: "pypi",
  async nameList(http, ctx) {
    const file = await http.download("https://pypi.org/simple/", join(ctx.dir, "pypi-simple.json"), { headers: { Accept: SIMPLE_ACCEPT } });
    const index = (await Bun.file(file.path!).json()) as { projects: Array<{ name: string }> };
    return {
      names: index.projects.map((p) => normalizeName(p.name)),
      files: [publicFile(file)],
      method: "every project in the Simple API root (PEP 691 JSON)",
    };
  },
  async activity(name, http, ctx) {
    const { data } = await http.getJson<SimpleIndex>(simpleUrl(name), { ecosystem: "pypi", package: name, headers: { Accept: SIMPLE_ACCEPT } });
    if (!data) return { latestRelease: null, missing: "no longer on PyPI" };
    // A release's date is its earliest file, as in the adapter; yanked files still count.
    return { latestRelease: newestBefore(groupByVersion(name, data).map((v) => v.publishedAt), ctx.asOf) };
  },
};

const npm: DrawSource = {
  ecosystem: "npm",
  nameList: (http, ctx) => bigqueryNames("npm", ctx),
  async activity(name, http, ctx) {
    // deps.dev also lists names npm never accepted (paths of bundled dependencies); they are not packages.
    if (!validateNpmName(name).validForOldPackages) return { latestRelease: null, missing: "not a valid npm package name" };
    const { data } = await http.getJson<Packument>(packumentUrl(name), {
      ecosystem: "npm",
      package: name,
      headers: { Accept: "application/json" },
      acceptStatuses: [400, 405],
    });
    if (!data) return { latestRelease: null, missing: "not on npm" };
    // `time` keeps unpublished versions too; only versions still listed are releases.
    return { latestRelease: newestBefore(Object.keys(data.versions ?? {}).map((v) => data.time?.[v]), ctx.asOf) };
  },
};

const maven: DrawSource = {
  ecosystem: "maven",
  nameList: (http, ctx) => bigqueryNames("maven", ctx),
  async activity(name, http, ctx) {
    if (!/^[^:\s/]+:[^:\s/]+$/.test(name)) return { latestRelease: null, missing: "not a Maven groupId:artifactId" };
    const res = await http.get(`${artifactBase(name)}/maven-metadata.xml`, { ecosystem: "maven", package: name });
    if (res.status !== 200) return { latestRelease: null, missing: `no maven-metadata.xml (HTTP ${res.status})` };
    // Rewritten on every deployment; Central allows no other change to a published artifact.
    const m = /<lastUpdated>\s*(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*<\/lastUpdated>/.exec(res.body);
    return { latestRelease: m ? newestBefore([`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`], ctx.asOf) : null };
  },
};

const packagist: DrawSource = {
  ecosystem: "packagist",
  async nameList(http, ctx) {
    const file = await http.download("https://packagist.org/packages/list.json", join(ctx.dir, "packagist-list.json"));
    const list = (await Bun.file(file.path!).json()) as { packageNames: string[] };
    return { names: list.packageNames, files: [publicFile(file)], method: "packages/list.json: every package name" };
  },
  async activity(name, http, ctx) {
    // p2 serves tagged releases only (branches are in `~dev.json`), each with its `time`.
    const { data } = await http.getJson<{ packages?: Record<string, Array<{ time?: string }>> }>(
      `https://repo.packagist.org/p2/${name}.json`,
      { ecosystem: "packagist", package: DRAW_KEY },
    );
    if (!data) return { latestRelease: null };
    return { latestRelease: newestBefore((data.packages?.[name] ?? []).map((v) => v.time), ctx.asOf) };
  },
};

const crates: DrawSource = {
  ecosystem: "crates",
  async nameList(http, ctx) {
    const file = await http.download("https://static.crates.io/db-dump.tar.gz", join(ctx.dir, "crates-db-dump.tar.gz"));
    const latest = await derived(file, `latest-${ctx.asOf.toISOString()}`, () => cratesLatest(file.path!, ctx.asOf));
    return {
      names: latest.names,
      latestRelease: new Map(latest.releases),
      files: [publicFile(file)],
      method: "crates.io database dump: crates.csv, and versions.csv created_at",
    };
  },
};

const rubygems: DrawSource = {
  ecosystem: "rubygems",
  async nameList(http, ctx) {
    const key = await rubygemsDumpKey(http, ctx.asOf);
    const file = await http.download(`${RUBYGEMS_DUMPS}/${key}`, join(ctx.dir, "rubygems-public_postgresql.tar"));
    const latest = await derived(file, `latest-${ctx.asOf.toISOString()}`, () => rubygemsLatest(file.path!, ctx.asOf));
    return {
      names: latest.names,
      latestRelease: new Map(latest.releases),
      files: [publicFile(file)],
      method: "RubyGems.org weekly PostgreSQL dump: rubygems, and versions.created_at",
    };
  },
};

const go: DrawSource = {
  ecosystem: "go",
  async nameList(http, ctx) {
    const file = await crawlGoIndex(http, ctx);
    const latest = await derived(file, "latest", () => goLatest(file.path!, ctx.asOf));
    return {
      names: latest.names,
      latestRelease: new Map(latest.releases),
      files: [publicFile(file)],
      method: "index.golang.org over the activity window; a pseudo-version is not a release",
      noRelease: "only pseudo-versions in the window",
    };
  },
};

const SOURCES: Partial<Record<EcosystemId, DrawSource>> = { pypi, npm, crates, rubygems, go, maven, packagist };

export function getDrawSource(id: EcosystemId): DrawSource | null {
  return SOURCES[id] ?? null;
}

/** The record keeps what was fetched and its checksum, not where it lies on this machine. */
function publicFile({ path: _path, ...file }: BulkFile): BulkFile {
  return file;
}

/**
 * Parsing a multi-gigabyte dump takes minutes; its result is stored next to it, keyed by the
 * dump's checksum, so a restarted draw reads it back instead.
 */
async function derived<T>(file: BulkFile, name: string, build: () => Promise<T>): Promise<T> {
  const path = `${file.path}.${name.replace(/[^A-Za-z0-9.-]+/g, "_")}.json`;
  const stored = Bun.file(path);
  if (await stored.exists()) {
    const { sha256, value } = (await stored.json()) as { sha256: string; value: T };
    if (sha256 === file.sha256) return value;
  }
  const value = await build();
  await Bun.write(path, JSON.stringify({ sha256: file.sha256, value }));
  return value;
}

interface Latest {
  names: string[];
  /** [name, newest release at or before the snapshot]; names without one are absent. */
  releases: Array<[string, string]>;
}

/** Newest `created_at` per crate from the dump's `crates.csv` and `versions.csv`, read in one pass. */
export async function cratesLatest(path: string, asOf: Date): Promise<Latest> {
  const names = new Map<string, string>();
  const newest = new Map<string, string>();
  const tar = extract();
  createReadStream(path).pipe(createGunzip()).pipe(tar);
  for await (const entry of tar) {
    const file = entry.header.name;
    if (file.endsWith("/data/crates.csv")) {
      for await (const row of entry.pipe(parse({ columns: true }))) names.set(row.id, row.name);
    } else if (file.endsWith("/data/versions.csv")) {
      for await (const row of entry.pipe(parse({ columns: true }))) {
        const t = newestBefore([newest.get(row.crate_id), pgTime(row.created_at)], asOf);
        if (t) newest.set(row.crate_id, t);
      }
    } else {
      entry.resume();
    }
  }
  if (names.size === 0) throw new Error(`no crates.csv in ${path}`);
  return {
    names: [...names.values()],
    releases: [...newest].flatMap(([id, t]): Array<[string, string]> => (names.has(id) ? [[names.get(id)!, t]] : [])),
  };
}

const RUBYGEMS_DUMPS = "https://s3-us-west-2.amazonaws.com/rubygems-dumps";

/** The newest weekly dump taken at or before the snapshot (keys carry the dump's date). */
async function rubygemsDumpKey(http: HttpClient, asOf: Date): Promise<string> {
  const keys: string[] = [];
  let token: string | null = null;
  do {
    const url: string = `${RUBYGEMS_DUMPS}/?list-type=2&prefix=production/public_postgresql/${token ? `&continuation-token=${encodeURIComponent(token)}` : ""}`;
    const xml: string = await (await http.request(url)).text();
    keys.push(...[...xml.matchAll(/<Key>([^<]+public_postgresql\.tar)<\/Key>/g)].map((m) => m[1]!));
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? (/<NextContinuationToken>([^<]+)</.exec(xml)?.[1] ?? null) : null;
  } while (token);
  const dated = keys
    .map((key) => ({ key, at: /(\d{4})\.(\d{2})\.(\d{2})\.(\d{2})\.(\d{2})\.(\d{2})/.exec(key) }))
    .filter((k) => k.at)
    .map((k) => ({ key: k.key, at: Date.parse(`${k.at![1]}-${k.at![2]}-${k.at![3]}T${k.at![4]}:${k.at![5]}:${k.at![6]}Z`) }))
    .filter((k) => k.at <= asOf.getTime())
    .sort((a, b) => b.at - a.at);
  if (!dated[0]) throw new Error("no RubyGems PostgreSQL dump taken before the snapshot");
  return dated[0].key;
}

/** Newest `versions.created_at` per gem, from the `COPY` blocks of the dump's SQL. */
export async function rubygemsLatest(path: string, asOf: Date): Promise<Latest> {
  const names = new Map<string, string>();
  const newest = new Map<string, string>();
  const tar = extract();
  createReadStream(path).pipe(tar);
  for await (const entry of tar) {
    if (!entry.header.name.endsWith(".sql.gz")) {
      entry.resume();
      continue;
    }
    let block: { table: string; columns: string[] } | null = null;
    for await (const line of createInterface({ input: entry.pipe(createGunzip()), crlfDelay: Infinity })) {
      if (!block) {
        const copy = /^COPY public\.(rubygems|versions) \(([^)]+)\) FROM stdin;$/.exec(line);
        if (copy) block = { table: copy[1]!, columns: copy[2]!.split(",").map((c) => c.trim()) };
        continue;
      }
      if (line === "\\.") {
        block = null;
        continue;
      }
      // COPY text format: tab-separated, tabs inside values escaped, \N for null.
      const cells = line.split("\t");
      const col = (name: string) => cells[block!.columns.indexOf(name)];
      if (block.table === "rubygems") names.set(col("id")!, col("name")!);
      else {
        const id = col("rubygem_id")!;
        const t = newestBefore([newest.get(id), pgTime(col("created_at"))], asOf);
        if (t) newest.set(id, t);
      }
    }
  }
  if (names.size === 0) throw new Error(`no rubygems table in ${path}`);
  return {
    names: [...names.values()],
    releases: [...newest].flatMap(([id, t]): Array<[string, string]> => (names.has(id) ? [[names.get(id)!, t]] : [])),
  };
}

/**
 * PostgreSQL's `2024-03-01 12:00:00.123456`, with or without a `+00` offset, as ISO 8601. A
 * timestamp without a zone is UTC in both dumps (the registries' servers run in UTC).
 */
export function pgTime(t: string | undefined): string | null {
  if (!t || t === "\\N") return null;
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)(Z|[+-]\d{2}(?::?\d{2})?)?$/.exec(t.trim());
  if (!m) return null;
  const zone = !m[3] || m[3] === "Z" ? "Z" : m[3].length === 3 ? `${m[3]}:00` : m[3].replace(/^([+-]\d{2})(\d{2})$/, "$1:$2");
  return `${m[1]}T${m[2]}${zone}`;
}

const GO_INDEX = "https://index.golang.org/index";
const GO_PAGE = 2000;

/**
 * Every module version the proxy first cached in the activity window, as JSON lines. The index
 * is append-only and ordered by time, so the window is one reproducible slice of it.
 *
 * The index pages by `since`, so pages within a stretch of time follow one another; the window is
 * split into months, crawled side by side (the host's queue bounds how many at once), and joined in
 * order. Each month appends its pages to its own file and records its cursor, so an interrupted
 * crawl resumes every month where it stopped.
 */
async function crawlGoIndex(http: HttpClient, ctx: DrawContext): Promise<BulkFile> {
  const since = activityWindowStart(ctx.asOf);
  // Not a single request: the index pages through `since`, and the crawl stops at the snapshot.
  const url = `${GO_INDEX}?since=${since.toISOString()} (pages of ${GO_PAGE}, cut at ${ctx.asOf.toISOString()})`;
  const path = join(ctx.dir, "go-index.jsonl");
  const sidecar = Bun.file(`${path}.json`);
  if (await sidecar.exists()) {
    const known = (await sidecar.json()) as BulkFile;
    if (known.url === url && (await sha256File(path)) === known.sha256) return known;
  }
  const parts = join(ctx.dir, "go-index");
  await mkdir(parts, { recursive: true });

  const months: Array<{ from: Date; to: Date; last: boolean }> = [];
  for (let from = since; from < ctx.asOf; ) {
    const next = new Date(from);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const last = next >= ctx.asOf;
    months.push({ from, to: last ? ctx.asOf : next, last });
    from = next;
  }
  const fetchedAt = new Date().toISOString();
  const files = months.map((_, i) => join(parts, `${String(i).padStart(2, "0")}.jsonl`));
  await Promise.all(months.map((m, i) => crawlGoMonth(http, m.from, m.to, m.last, files[i]!)));

  const sink = Bun.file(path).writer();
  for (const f of files) for await (const chunk of Bun.file(f).stream()) sink.write(chunk);
  await sink.end();
  const file: BulkFile = { url, sha256: await sha256File(path), bytes: Bun.file(path).size, fetchedAt, path };
  await Bun.write(sidecar, JSON.stringify(file, null, 2) + "\n");
  await rm(parts, { recursive: true, force: true });
  return file;
}

interface IndexEntry {
  Path: string;
  Version: string;
  Timestamp: string;
}

/** One month of the index, [from, to) (the last month includes `to`, the snapshot instant). */
async function crawlGoMonth(http: HttpClient, from: Date, to: Date, inclusive: boolean, file: string): Promise<void> {
  const cursorFile = Bun.file(`${file}.cursor`);
  // `atCursor`: versions already written at the cursor's timestamp, which the next page repeats.
  let state = (await cursorFile.exists())
    ? ((await cursorFile.json()) as { cursor: string; atCursor: string[]; done: boolean })
    : { cursor: from.toISOString(), atCursor: [] as string[], done: false };
  const end = to.getTime();
  while (!state.done) {
    const body = await (await http.request(`${GO_INDEX}?since=${state.cursor}&limit=${GO_PAGE}`)).text();
    const page = body.split("\n").filter(Boolean).map((l) => JSON.parse(l) as IndexEntry);
    let done = page.length < GO_PAGE;
    let cursor = state.cursor;
    let atCursor = new Set(state.atCursor);
    const lines: string[] = [];
    for (const e of page) {
      const t = Date.parse(e.Timestamp);
      if (t > end || (t === end && !inclusive)) {
        done = true;
        break;
      }
      const key = `${e.Path}@${e.Version}`;
      if (e.Timestamp === state.cursor && state.atCursor.includes(key)) continue;
      if (e.Timestamp !== cursor) {
        cursor = e.Timestamp;
        atCursor = new Set();
      }
      atCursor.add(key);
      lines.push(JSON.stringify({ Path: e.Path, Version: e.Version, Timestamp: e.Timestamp }) + "\n");
    }
    if (!done && cursor === state.cursor && lines.length === 0) throw new Error(`index.golang.org: more than ${GO_PAGE} versions at ${cursor}; cannot page past them`);
    if (lines.length) await appendFile(file, lines.join(""));
    state = { cursor, atCursor: [...atCursor], done };
    await Bun.write(cursorFile, JSON.stringify(state));
  }
  if (!(await Bun.file(file).exists())) await Bun.write(file, "");
}

/** golang.org/x/mod/module's pseudo-version pattern: a commit, not a tag. */
const PSEUDO = /^v[0-9]+\.(0\.0-|\d+\.\d+-([^+]*\.)?0\.)\d{14}-[A-Za-z0-9]+(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;

export function isPseudoVersion(v: string): boolean {
  return PSEUDO.test(v);
}

/** Every module in the crawled window, with its newest tagged version's index time. */
export async function goLatest(path: string, asOf: Date): Promise<Latest> {
  const modules = new Set<string>();
  const newest = new Map<string, string>();
  for await (const line of createInterface({ input: createReadStream(path), crlfDelay: Infinity })) {
    if (!line) continue;
    const e = JSON.parse(line) as { Path: string; Version: string; Timestamp: string };
    modules.add(e.Path);
    if (isPseudoVersion(e.Version)) continue;
    const t = newestBefore([newest.get(e.Path), e.Timestamp], asOf);
    if (t) newest.set(e.Path, t);
  }
  return { names: [...modules], releases: [...newest] };
}
