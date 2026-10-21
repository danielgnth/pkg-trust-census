/**
 * Publish stage: a snapshot's response cache, redacted, as a GitHub release
 * (docs/development.md, Publishing the cache).
 *
 * Nothing that names a person leaves this machine. Every cached response is redacted
 * field by field (`PERSONAL_DATA` in each adapter) with an email pattern on top, and three checks
 * must pass before anything is packed:
 *
 *  - no listed field and no address survives in any redacted response (`residue`);
 *  - `extract` over the redacted cache produces exactly the versions and signals it produces over
 *    the original, so the published cache supports every published number;
 *  - the manifests carry no address either.
 *
 * The release holds one archive per registry, the redacted manifest (what was published: paths
 * relative to the archive root, each record's sha256 of the redacted body and `originalSha256` of
 * the body as fetched) and the original manifest (what was fetched), whose sha256 the committed
 * `requests.json` records.
 */

import { and, eq } from "drizzle-orm";
import { createReadStream } from "node:fs";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { createGzip } from "node:zlib";
import { pack } from "tar-stream";
import { ECOSYSTEMS, type EcosystemId } from "../types.ts";
import { dataDir, manifestPath, ResponseCache } from "../http/cache.ts";
import { sha256File } from "../http/client.ts";
import { openDb, closeDb, type Db } from "../db/open.ts";
import { packageVersions, packages, sampleMembers, snapshots, versionSignals } from "../db/schema.ts";
import { runExtract } from "../stages/extract.ts";
import { personalEmails, redactBody, residue, type PersonalData } from "./redact.ts";
import { PERSONAL_DATA as NPM } from "../adapters/npm.ts";
import { PERSONAL_DATA as PYPI } from "../adapters/pypi.ts";
import { PERSONAL_DATA as CRATES } from "../adapters/crates.ts";
import { PERSONAL_DATA as RUBYGEMS } from "../adapters/rubygems.ts";
import { PERSONAL_DATA as GO } from "../adapters/go.ts";
import { PERSONAL_DATA as MAVEN } from "../adapters/maven.ts";
import { PERSONAL_DATA as PACKAGIST } from "../adapters/packagist.ts";
import { PERSONAL_DATA as ECOSYSTEMS_MS } from "../adapters/ecosystems.ts";
import { PERSONAL_DATA as OSV } from "../advisories/osv.ts";

export const ALL_PERSONAL_DATA: readonly PersonalData[] = [...NPM, ...PYPI, ...CRATES, ...RUBYGEMS, ...GO, ...MAVEN, ...PACKAGIST, ...ECOSYSTEMS_MS, ...OSV];

/** GitHub refuses release assets of 2 GiB or more. */
const MAX_ASSET = 2 * 1024 ** 3;

export interface PublishResult {
  dir: string;
  tag: string;
  entries: number;
  /** Responses whose body redaction changed. */
  redacted: number;
  /** Manifest records whose payload is not on disk (superseded or deleted), left out of the release. */
  missing: string[];
  /** Rows compared by the survival check. */
  compared: { versions: number; signals: number };
  assets: Array<{ name: string; path: string; bytes: number; sha256: string }>;
  uploaded: boolean;
}

export function publishDir(snapshotId: string): string {
  return join(dataDir(), "publish", snapshotId);
}

/** The raw URL of a cache key ("HEAD {url}", "POST {url} {sha256}"). */
const rawUrl = (key: string) => key.replace(/^(HEAD|POST) /, "").split(" ")[0]!;

export async function runPublish(
  db: Db,
  snapshotId: string,
  opts: { upload?: boolean; onProgress?: (message: string) => void } = {},
): Promise<PublishResult> {
  const say = opts.onProgress ?? (() => {});
  const source = new ResponseCache(snapshotId);
  const entries = await source.entries();
  if (entries.length === 0) throw new Error(`no cached responses for ${snapshotId} (${manifestPath(snapshotId)})`);

  const dir = publishDir(snapshotId);
  await rm(dir, { recursive: true, force: true });
  const staged = ResponseCache.at(join(dir, "cache"));

  const missing: string[] = [];
  const problems: string[] = [];
  let redacted = 0;
  for (const [i, entry] of entries.entries()) {
    const hit = await source.get(entry.url);
    if (!hit) {
      missing.push(entry.url);
      continue;
    }
    const url = rawUrl(entry.url);
    const body = redactBody(url, hit.body, ALL_PERSONAL_DATA);
    if (body !== hit.body) redacted++;
    for (const r of residue(url, body, ALL_PERSONAL_DATA)) problems.push(`${entry.url}: ${r}`);
    await staged.put({
      url: entry.url,
      body,
      httpStatus: entry.httpStatus,
      ecosystem: entry.ecosystem,
      package: entry.package,
      requestBody: entry.requestBody,
      fetchedAt: entry.fetchedAt,
      originalSha256: entry.sha256,
    });
    if (i % 1000 === 0) say(`redacted ${i}/${entries.length}`);
  }
  await staged.flush();
  if (problems.length) throw new Error(`redaction left personal data in ${problems.length} places, e.g.\n${problems.slice(0, 10).join("\n")}`);

  say("checking that the redacted cache yields the same signals");
  const compared = await sameSignals(db, snapshotId, source, ResponseCache.at(join(dir, "cache")));

  // The original manifest is published as it is, so its sha256 matches `requests.json`.
  const original = join(dir, "manifest.original.jsonl");
  await Bun.write(original, Bun.file(manifestPath(snapshotId)));
  const redactedManifest = join(dir, "cache", "manifest.jsonl");
  for (const path of [original, redactedManifest]) {
    const found = personalEmails(await Bun.file(path).text());
    if (found.length) throw new Error(`${path} names ${found.length} addresses, e.g. ${found[0]}`);
  }

  say("packing one archive per registry");
  const assets: PublishResult["assets"] = [];
  for (const eco of ECOSYSTEMS) {
    const root = join(dir, "cache", eco);
    if (!(await stat(root).catch(() => null))) continue;
    const path = join(dir, `cache-${eco}.tar.gz`);
    await tarGz(join(dir, "cache"), root, path);
    assets.push(await asset(`cache-${eco}.tar.gz`, path));
  }
  await Bun.write(join(dir, "manifest.jsonl"), Bun.file(redactedManifest));
  assets.push(await asset("manifest.jsonl", join(dir, "manifest.jsonl")), await asset("manifest.original.jsonl", original));
  const tooBig = assets.filter((a) => a.bytes >= MAX_ASSET);
  if (tooBig.length) throw new Error(`release assets over 2 GiB: ${tooBig.map((a) => a.name).join(", ")}`);

  const tag = `cache-${snapshotId}`;
  const notes = join(dir, "NOTES.md");
  await Bun.write(notes, releaseNotes(snapshotId, entries.length, redacted, missing, compared, assets));
  if (opts.upload) await upload(tag, snapshotId, notes, assets);
  return { dir, tag, entries: entries.length, redacted, missing, compared, assets, uploaded: Boolean(opts.upload) };
}

/**
 * Extracts the snapshot twice into scratch databases, once from each cache, and requires the
 * same versions and the same signals, evidence and rules. Only the responses' sha256 may differ.
 */
async function sameSignals(db: Db, snapshotId: string, original: ResponseCache, redacted: ResponseCache): Promise<{ versions: number; signals: number }> {
  const build = async (cache: ResponseCache) => {
    const scratch = openDb(":memory:");
    scratch.insert(snapshots).values(db.select().from(snapshots).where(eq(snapshots.snapshotId, snapshotId)).all()).run();
    const pkgs = db.select({ snapshotId: packages.snapshotId, ecosystem: packages.ecosystem, packageName: packages.packageName }).from(packages).where(eq(packages.snapshotId, snapshotId)).all();
    const members = db.select().from(sampleMembers).where(eq(sampleMembers.snapshotId, snapshotId)).all();
    for (const p of pkgs) scratch.insert(packages).values(p).run();
    for (const m of members) scratch.insert(sampleMembers).values(m).run();
    const present = ECOSYSTEMS.filter((e) => members.some((m) => m.ecosystem === e));
    await runExtract(present as EcosystemId[], snapshotId, scratch, cache);
    const versions = scratch.select().from(packageVersions).where(eq(packageVersions.snapshotId, snapshotId)).all();
    const signals = scratch.select().from(versionSignals).where(eq(versionSignals.snapshotId, snapshotId)).all();
    const derived = scratch
      .select({ e: packages.ecosystem, n: packages.packageName, v: packages.latestVersion, d: packages.latestPublishDate, m: packages.maintainerCount, r: packages.repositoryUrl, x: packages.extractError })
      .from(packages)
      .where(and(eq(packages.snapshotId, snapshotId)))
      .all();
    closeDb(scratch);
    return {
      versions: new Map(versions.map((v) => [`${v.ecosystem}/${v.packageName}@${v.version}`, JSON.stringify([v.publishedAt, v.isLatest, v.quarterAnchor, v.purl])])),
      signals: new Map(signals.map((s) => [`${s.ecosystem}/${s.packageName}@${s.version} ${s.signalId}`, JSON.stringify([s.value, s.evidence, s.signalSource, s.responses.map((r) => r.url)])])),
      packages: new Map(derived.map((p) => [`${p.e}/${p.n}`, JSON.stringify([p.v, p.d, p.m, p.r, p.x])])),
    };
  };
  const [a, b] = [await build(original), await build(redacted)];
  const differ: string[] = [];
  for (const table of ["versions", "signals", "packages"] as const) {
    const keys = new Set([...a[table].keys(), ...b[table].keys()]);
    for (const k of keys) if (a[table].get(k) !== b[table].get(k)) differ.push(`${table} ${k}: ${a[table].get(k) ?? "absent"} → ${b[table].get(k) ?? "absent"}`);
  }
  if (differ.length) throw new Error(`the redacted cache changes ${differ.length} rows, e.g.\n${differ.slice(0, 10).join("\n")}`);
  return { versions: a.versions.size, signals: a.signals.size };
}

async function files(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await files(p)));
    else out.push(p);
  }
  return out.sort();
}

/** `src` packed with paths relative to `base` (`{eco}/…`), as the published manifest names them. */
async function tarGz(base: string, src: string, dest: string): Promise<void> {
  const tar = pack();
  const sink = Bun.file(dest).writer();
  const done = (async () => {
    for await (const chunk of tar.pipe(createGzip())) sink.write(chunk as Uint8Array);
    await sink.end();
  })();
  for (const f of await files(src)) {
    const size = (await stat(f)).size;
    await new Promise<void>((resolve, reject) => {
      const entry = tar.entry({ name: relative(base, f), size }, (err) => (err ? reject(err) : resolve()));
      createReadStream(f).pipe(entry);
    });
  }
  tar.finalize();
  await done;
}

async function asset(name: string, path: string): Promise<PublishResult["assets"][number]> {
  return { name, path, bytes: Bun.file(path).size, sha256: await sha256File(path) };
}

function releaseNotes(
  snapshotId: string,
  entries: number,
  redacted: number,
  missing: string[],
  compared: { versions: number; signals: number },
  assets: PublishResult["assets"],
): string {
  return [
    `Every registry response snapshot ${snapshotId} was computed from, with personal data removed.`,
    "",
    `- ${entries} responses; ${redacted} changed by redaction (fields that name people, and email addresses).`,
    `- \`extract\` over this cache yields the same ${compared.versions} versions and ${compared.signals} signals as over the original.`,
    "- `manifest.original.jsonl` is the record of what was fetched (its sha256 is in the snapshot's `requests.json`);",
    "  `manifest.jsonl` is the record of what is published, each entry with the sha256 of the redacted body and",
    "  `originalSha256` of the body as fetched.",
    ...(missing.length ? [`- ${missing.length} manifest records have no stored payload and are not included.`] : []),
    "",
    "To rebuild the snapshot: unpack every archive into one folder beside `manifest.jsonl`, then run",
    `\`bun run cli extract --snapshot ${snapshotId} --cache <folder>\`.`,
    "",
    "| Asset | Bytes | sha256 |",
    "|---|---:|---|",
    ...assets.map((a) => `| ${a.name} | ${a.bytes} | \`${a.sha256}\` |`),
    "",
  ].join("\n");
}

/** Creates the release, or adds to it. Runs only when asked (`publish --upload`). */
async function upload(tag: string, snapshotId: string, notes: string, assets: PublishResult["assets"]): Promise<void> {
  const run = async (args: string[]) => {
    const proc = Bun.spawn(["gh", ...args], { stdout: "inherit", stderr: "pipe" });
    const err = await new Response(proc.stderr).text();
    return { code: await proc.exited, err };
  };
  const exists = (await run(["release", "view", tag])).code === 0;
  const paths = assets.map((a) => a.path);
  const res = exists
    ? await run(["release", "upload", tag, ...paths, "--clobber"])
    : await run(["release", "create", tag, ...paths, "--title", `Response cache, snapshot ${snapshotId}`, "--notes-file", notes]);
  if (res.code !== 0) throw new Error(`gh release failed: ${res.err.trim()}`);
}
