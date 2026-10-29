/**
 * The random draw: a seeded, order-independent shuffle; the activity rule; and the parsers that
 * read activity straight from a registry's dump or index.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { pack } from "tar-stream";
import { activityWindowStart, DrawInterruptedError, drawActive, newestBefore, shuffled, type DrawSource } from "../src/sample/draw.ts";
import { cratesLatest, getDrawSource, goLatest, isPseudoVersion, rubygemsLatest } from "../src/sample/sources.ts";
import { wilson } from "../src/stages/aggregate.ts";
import { HttpClient } from "../src/http/client.ts";
import { ResponseCache } from "../src/http/cache.ts";

const ASOF = new Date("2026-10-13T09:14:00Z");
const http = new HttpClient({ cache: new ResponseCache(), transport: { name: "none", fetch: () => Promise.reject(new Error("no network in this test")) } });
const ctx = { snapshotId: "snap", asOf: ASOF, dir: "unused", seed: "seed" };

describe("shuffled", () => {
  const names = Array.from({ length: 200 }, (_, i) => `pkg-${i}`);

  test("is a permutation, repeatable for one seed and different for another", () => {
    const a = [...shuffled(names, "seed-1")];
    expect([...a].sort()).toEqual([...names].sort());
    expect([...shuffled(names, "seed-1")]).toEqual(a);
    expect([...shuffled(names, "seed-2")]).not.toEqual(a);
  });

  test("does not depend on the order the list was served in, or on duplicates", () => {
    const reversed = [...names].reverse();
    expect([...shuffled([...reversed, "pkg-3"], "s")]).toEqual([...shuffled(names, "s")]);
  });

  test("a prefix is the prefix of the full shuffle", () => {
    const walk = shuffled(names, "s");
    const first = [walk.next().value, walk.next().value];
    expect(first).toEqual([...shuffled(names, "s")].slice(0, 2));
  });
});

describe("activity", () => {
  test("the window is the 36 months before the snapshot", () => {
    expect(activityWindowStart(ASOF).toISOString()).toBe("2023-10-13T09:14:00.000Z");
  });

  test("a release after the snapshot instant does not count", () => {
    expect(newestBefore(["2025-01-01T00:00:00Z", "2026-12-01T00:00:00Z", null, "junk"], ASOF)).toBe("2025-01-01T00:00:00.000Z");
    expect(newestBefore(["2027-01-01T00:00:00Z"], ASOF)).toBeNull();
  });

  test("Go pseudo-versions are commits, not releases", () => {
    expect(isPseudoVersion("v0.0.0-20240101120000-abcdefabcdef")).toBe(true);
    expect(isPseudoVersion("v1.2.4-0.20240101120000-abcdefabcdef")).toBe(true);
    expect(isPseudoVersion("v1.2.3")).toBe(false);
    expect(isPseudoVersion("v2.0.0-rc.1")).toBe(false);
  });
});

describe("drawActive", () => {
  const dates: Record<string, string | null> = {
    a: "2026-01-01T00:00:00Z",
    b: "2020-01-01T00:00:00Z",
    c: null,
    d: "2025-06-01T00:00:00Z",
    e: "2024-02-01T00:00:00Z",
    gone: null,
  };
  const source: DrawSource = {
    ecosystem: "pypi",
    nameList: async () => ({ names: Object.keys(dates), files: [], method: "test" }),
    activity: async (name) => (name === "gone" ? { latestRelease: null, missing: "no longer on PyPI" } : { latestRelease: dates[name] ?? null }),
  };

  test("accepts active names in shuffled order and records every rejection", async () => {
    const { candidates, record } = await drawActive(source, 2, "seed", http, ctx);
    const order = [...shuffled(Object.keys(dates), "seed")];
    const active = order.filter((n) => ["a", "d", "e"].includes(n)).slice(0, 2);
    expect(candidates.map((c) => c.name)).toEqual(active);
    expect(candidates.map((c) => [c.layer, c.rank, c.rankFrame])).toEqual([["random", 1, "random"], ["random", 2, "random"]]);
    // Exactly the names walked before the second acceptance were checked.
    const walked = order.slice(0, order.indexOf(active[1]!) + 1);
    expect(record.checked).toBe(walked.length);
    expect(record.rejected.map((r) => r.name)).toEqual(walked.filter((n) => !active.includes(n)));
    expect(record).toMatchObject({ seed: "seed", listed: 6, accepted: 2, windowStart: "2023-10-13T09:14:00.000Z" });
    const reasons = Object.fromEntries(record.rejected.map((r) => [r.name, r.reason]));
    if (reasons.b) expect(reasons.b).toBe("no release in the window");
    if (reasons.c) expect(reasons.c).toBe("no release by the snapshot");
    if (reasons.gone) expect(reasons.gone).toBe("no longer on PyPI");
  });

  test("stops at the end of the list when fewer names are active than asked for", async () => {
    const { candidates, record } = await drawActive(source, 10, "seed", http, ctx);
    expect(candidates.map((c) => c.name).sort()).toEqual(["a", "d", "e"]);
    expect(record).toMatchObject({ checked: 6, accepted: 3 });
  });

  test("a failed check stops the draw at that name; a re-run continues from the journal and draws the same sample", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pkg-trust-journal-"));
    const journal = join(dir, "pypi-draw.jsonl");
    const names = Array.from({ length: 40 }, (_, i) => `pkg-${i}`);
    const order = [...shuffled(names, "seed")];
    const failing = order[20]!;
    const calls = new Map<string, number>();
    let fail = true;
    const flaky: DrawSource = {
      ecosystem: "pypi",
      nameList: async () => ({ names, files: [], method: "test" }),
      activity: async (name) => {
        calls.set(name, (calls.get(name) ?? 0) + 1);
        if (fail && name === failing) throw new Error("pypi.org is rate limiting (HTTP 429)");
        return { latestRelease: Number(name.slice(4)) % 3 ? "2025-01-01T00:00:00Z" : "2019-01-01T00:00:00Z" };
      },
    };
    const err = await drawActive(flaky, 20, "seed", http, ctx, undefined, { journal }).catch((e) => e);
    expect(err).toBeInstanceOf(DrawInterruptedError);
    expect(err.message).toStartWith(`pypi: draw stopped at "${failing}" after 20 names checked`);
    // The batch's checks after the failed one are kept too (batches are 16 names: 16..31).
    expect((await Bun.file(journal).text()).trim().split("\n")).toHaveLength(1 + 31);

    fail = false;
    calls.clear();
    const resumed = await drawActive(flaky, 20, "seed", http, ctx, undefined, { journal });
    // Only the failed name and names past the journaled batch are checked again.
    expect(calls.get(failing)).toBe(1);
    expect([...calls.keys()].every((n) => n === failing || order.indexOf(n) >= 32)).toBe(true);

    const uninterrupted = await drawActive(flaky, 20, "seed", http, ctx);
    expect(resumed.candidates).toEqual(uninterrupted.candidates);
    expect(resumed.record).toEqual(uninterrupted.record);
    rmSync(dir, { recursive: true, force: true });
  });

  test("a journal written under another seed is started over", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pkg-trust-journal-"));
    const journal = join(dir, "pypi-draw.jsonl");
    let calls = 0;
    const counting: DrawSource = {
      ...source,
      activity: async (name, h, c) => {
        calls++;
        return source.activity!(name, h, c);
      },
    };
    await drawActive(counting, 2, "seed-1", http, ctx, undefined, { journal });
    const first = calls;
    await drawActive(counting, 2, "seed-1", http, ctx, undefined, { journal });
    expect(calls).toBe(first);
    await drawActive(counting, 2, "seed-2", http, ctx, undefined, { journal });
    expect(calls).toBeGreaterThan(first);
    expect(JSON.parse((await Bun.file(journal).text()).split("\n")[0]!)).toEqual({ seed: "seed-2" });
    rmSync(dir, { recursive: true, force: true });
  });

  test("a name the list marks as gone is recorded as no package, though the list dates it", async () => {
    const listed: DrawSource = {
      ecosystem: "rubygems",
      nameList: async () => ({
        names: ["live", "yanked"],
        latestRelease: new Map([["live", "2025-01-01T00:00:00.000Z"], ["yanked", "2025-02-01T00:00:00.000Z"]]),
        gone: { names: new Set(["yanked"]), reason: "every version yanked or removed (none indexed)" },
        files: [],
        method: "test",
      }),
    };
    const { candidates, record } = await drawActive(listed, 5, "s", http, ctx);
    expect(candidates.map((c) => c.name)).toEqual(["live"]);
    expect(record.rejected).toEqual([{ name: "yanked", reason: "every version yanked or removed (none indexed)", latestRelease: null, missing: true }]);
    expect(record).toMatchObject({ checked: 2, notPackages: 1, accepted: 1 });
  });

  test("uses the list's own dates when it carries them, with the list's reason for a missing one", async () => {
    const listed: DrawSource = {
      ecosystem: "go",
      nameList: async () => ({ names: ["x", "y"], latestRelease: new Map([["x", "2025-01-01T00:00:00.000Z"]]), files: [], method: "test", noRelease: "only pseudo-versions in the window" }),
    };
    const { candidates, record } = await drawActive(listed, 5, "s", http, ctx);
    expect(candidates.map((c) => c.name)).toEqual(["x"]);
    expect(record.rejected).toEqual([{ name: "y", reason: "only pseudo-versions in the window", latestRelease: null }]);
  });
});

describe("dump and index parsers", () => {
  const dir = mkdtempSync(join(tmpdir(), "pkg-trust-sample-"));

  async function tarOf(files: Record<string, string | Uint8Array>): Promise<Uint8Array> {
    const p = pack();
    for (const [name, body] of Object.entries(files)) p.entry({ name }, Buffer.from(body));
    p.finalize();
    const chunks: Buffer[] = [];
    for await (const c of p) chunks.push(c as Buffer);
    return Buffer.concat(chunks);
  }

  test("crates.io: newest versions.created_at per crate, joined on crates.csv", async () => {
    const tar = await tarOf({
      "2026-10-13-020000/data/versions.csv": 'id,crate_id,num,created_at,yanked\n1,10,0.1.0,2021-01-01 00:00:00.1+00,f\n2,10,0.2.0,2025-03-01 12:00:00.123456+00,t\n3,11,1.0.0,2019-05-05 00:00:00+00,f\n',
      "2026-10-13-020000/data/crates.csv": 'id,name,readme\n10,serde-x,"a ""quoted"", multi\nline readme"\n11,old-crate,\n12,empty-crate,\n',
      "2026-10-13-020000/data/version_downloads.csv": "version_id,downloads\n1,5\n",
    });
    const path = join(dir, "crates.tar.gz");
    await Bun.write(path, gzipSync(tar));
    const latest = await cratesLatest(path, ASOF);
    expect(latest.names.sort()).toEqual(["empty-crate", "old-crate", "serde-x"]);
    expect(Object.fromEntries(latest.releases)).toEqual({ "serde-x": "2025-03-01T12:00:00.123Z", "old-crate": "2019-05-05T00:00:00.000Z" });
  });

  test("RubyGems: newest versions.created_at per gem, from the dump's COPY blocks; a gem with no indexed version is gone", async () => {
    const sql = [
      "SET statement_timeout = 0;",
      "COPY public.rubygems (id, name, created_at, updated_at, indexed) FROM stdin;",
      "1\trails\t2009-07-25 18:00:00\t2026-01-01 00:00:00\tt",
      "2\tabandoned\t2012-01-01 00:00:00\t2012-01-01 00:00:00\tt",
      "3\tAlectrion_subpeduncle\t2024-03-01 21:17:54\t2024-03-01 21:17:54\tt",
      "4\tnever-pushed\t2020-01-01 00:00:00\t2020-01-01 00:00:00\tt",
      "\\.",
      "COPY public.versions (id, authors, number, rubygem_id, created_at, indexed) FROM stdin;",
      "7\tsomeone\t8.1.0\t1\t2025-10-01 10:00:00.5\tt",
      "8\tsomeone\t8.0.0\t1\t2024-11-01 10:00:00\tf",
      "9\t\\N\t0.1\t2\t2012-01-01 00:00:00\tt",
      "10\tsomeone\t0.0.1\t3\t2024-03-01 21:17:54.324504\tf",
      "\\.",
      "",
    ].join("\n");
    const tar = await tarOf({ "public_postgresql/databases/PostgreSQL.sql.gz": gzipSync(sql), "public_postgresql/README": "x" });
    const path = join(dir, "rubygems.tar");
    await Bun.write(path, tar);
    const latest = await rubygemsLatest(path, ASOF);
    expect(latest.names.sort()).toEqual(["Alectrion_subpeduncle", "abandoned", "never-pushed", "rails"]);
    // A yanked version still dates its gem; rails, with one version yanked, is not gone.
    expect(Object.fromEntries(latest.releases)).toEqual({
      rails: "2025-10-01T10:00:00.500Z",
      abandoned: "2012-01-01T00:00:00.000Z",
      Alectrion_subpeduncle: "2024-03-01T21:17:54.324Z",
    });
    expect(latest.gone).toEqual(["Alectrion_subpeduncle"]);
  });

  test("Go: every module in the window, dated by its newest tagged version", async () => {
    const path = join(dir, "go-index.jsonl");
    const line = (Path: string, Version: string, Timestamp: string) => JSON.stringify({ Path, Version, Timestamp });
    await Bun.write(path, [
      line("github.com/a/tagged", "v1.0.0", "2024-01-01T00:00:00Z"),
      line("github.com/a/tagged", "v1.1.0-0.20250101000000-abcdefabcdef", "2025-01-01T00:00:00Z"),
      line("github.com/b/pseudo", "v0.0.0-20250101000000-abcdefabcdef", "2025-01-01T00:00:00Z"),
      line("github.com/c/late", "v2.0.0", "2026-12-01T00:00:00Z"),
      "",
    ].join("\n"));
    const latest = await goLatest(path, ASOF);
    expect(latest.names.sort()).toEqual(["github.com/a/tagged", "github.com/b/pseudo", "github.com/c/late"]);
    expect(latest.releases).toEqual([["github.com/a/tagged", "2024-01-01T00:00:00.000Z"]]);
  });

  test("cleanup", () => rmSync(dir, { recursive: true, force: true }));
});

describe("Go index crawl", () => {
  test("pages each month by its cursor, cuts at the snapshot, and repeats nothing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pkg-trust-goindex-"));
    // Two versions a minute over the last four months before the snapshot, plus some after it;
    // several share a timestamp, so a page boundary falls inside a run of equal timestamps.
    const start = Date.parse("2026-06-10T00:00:00Z");
    const entries: Array<{ Path: string; Version: string; Timestamp: string }> = [];
    for (let i = 0; i < 9000; i++) {
      const t = new Date(start + Math.floor(i / 3) * 60_000 * 20).toISOString().replace("Z", "123Z");
      entries.push({ Path: `example.com/m${i % 50}`, Version: i % 7 === 0 ? `v0.0.0-20250101000000-abcdefabcde${i % 10}` : `v1.${i}.0`, Timestamp: t });
    }
    let requests = 0;
    const transport = {
      name: "index",
      async fetch(req: Request) {
        requests++;
        const since = Date.parse(new URL(req.url).searchParams.get("since")!);
        const page = entries.filter((e) => Date.parse(e.Timestamp) >= since).slice(0, 2000);
        return new Response(page.map((e) => JSON.stringify(e)).join("\n") + "\n");
      },
    };
    const client = new HttpClient({ cache: new ResponseCache(), transport, policies: { "index.golang.org": { rps: 1000, concurrency: 4 } } });
    const asOf = new Date("2026-08-20T00:00:00Z");
    const progress: string[] = [];
    const list = await getDrawSource("go")!.nameList(client, { snapshotId: "s", asOf, dir, seed: "s", progress: (m) => progress.push(m) });
    expect(progress.at(-1)).toBe("[go] index.golang.org: 36/36 months crawled, 100% of the window");
    const crawled = (await Bun.file(join(dir, "go-index.jsonl")).text()).split("\n").filter(Boolean).map((l) => JSON.parse(l));
    const expected = entries.filter((e) => Date.parse(e.Timestamp) <= asOf.getTime());
    expect(crawled).toEqual(expected);
    expect(list.names.sort()).toEqual([...new Set(expected.map((e) => e.Path))].sort());
    expect(list.files[0]!.url).toContain("pages of 2000");
    // A second call reads the stored crawl.
    const before = requests;
    await getDrawSource("go")!.nameList(client, { snapshotId: "s", asOf, dir, seed: "s" });
    expect(requests).toBe(before);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("wilson", () => {
  test("matches the intervals the extension plan tabulates", () => {
    const pct = (k: number, n: number) => wilson(k, n)!.map((x) => Math.round(x * 1000) / 10);
    expect(pct(100, 1000)).toEqual([8.3, 12]);
    expect(pct(20, 1000)).toEqual([1.3, 3.1]);
    expect(pct(250, 500)).toEqual([45.6, 54.4]);
    expect(wilson(0, 0)).toBeNull();
    expect(wilson(0, 10)![0]).toBe(0);
    expect(wilson(10, 10)![1]).toBe(1);
  });
});
