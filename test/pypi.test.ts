import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TMP = mkdtempSync(join(tmpdir(), "pkg-trust-pypi-"));
process.env.PKG_TRUST_DATA_DIR = TMP;

const { PypiAdapter, normalizeName, simpleUrl, jsonUrl, SIMPLE_ACCEPT } = await import(
  "../src/adapters/pypi.ts"
);
const { HttpClient } = await import("../src/http/client.ts");
const { ResponseCache } = await import("../src/http/cache.ts");
const { openDb, closeDb } = await import("../src/db/open.ts");
const { packages } = await import("../src/db/schema.ts");
const { runRank, loadCandidates } = await import("../src/stages/rank.ts");
const { runFetch } = await import("../src/stages/fetch.ts");
import { eq, isNotNull } from "drizzle-orm";
import type { Transport, TransportRequest, TransportResponse } from "../src/http/transport.ts";

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

const CTX = { asOf: new Date("2026-10-01T00:00:00Z") };

/** Records every request so tests can assert on exact URLs and headers. */
class MockTransport implements Transport {
  readonly name = "mock";
  calls: Array<{ url: string; req: TransportRequest }> = [];
  constructor(private routes: Record<string, string>) {}

  async request(url: string, req: TransportRequest): Promise<TransportResponse> {
    this.calls.push({ url, req });
    const body = this.routes[url];
    if (body === undefined) return { status: 404, body: "", headers: new Map() };
    return { status: 200, body, headers: new Map() };
  }
}

const RANKING_URL =
  "https://raw.githubusercontent.com/hugovk/top-pypi-packages/main/top-pypi-packages.json";

const rankingBody = JSON.stringify({
  rows: [
    // Deliberately out of order, with names needing PEP 503 normalization.
    { project: "Typing_Extensions", download_count: 50 },
    { project: "boto3", download_count: 900 },
    { project: "zope.interface", download_count: 10 },
    { project: "requests", download_count: 300 },
  ],
});

describe("normalizeName (PEP 503)", () => {
  test.each([
    ["Typing_Extensions", "typing-extensions"],
    ["zope.interface", "zope-interface"],
    ["ruamel.yaml.clib", "ruamel-yaml-clib"],
    ["Flask", "flask"],
    ["a__b--c..d", "a-b-c-d"],
    ["already-normal", "already-normal"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeName(input)).toBe(expected);
  });

  test("urls use the normalized form so cache keys stay stable", () => {
    expect(simpleUrl("Typing_Extensions")).toBe("https://pypi.org/simple/typing-extensions/");
    expect(jsonUrl("zope.interface")).toBe("https://pypi.org/pypi/zope-interface/json");
    expect(simpleUrl("Typing_Extensions")).toBe(simpleUrl("typing.extensions"));
  });
});

describe("PypiAdapter.rank", () => {
  beforeEach(() => rmSync(join(TMP, "cache"), { recursive: true, force: true }));

  test("sorts by downloads, ranks from 1, and normalizes names", async () => {
    const http = new HttpClient({
      transport: new MockTransport({ [RANKING_URL]: rankingBody }),
      cache: new ResponseCache(),
    });
    const out = await new PypiAdapter().rank(3, http);

    expect(out.map((c) => c.name)).toEqual(["boto3", "requests", "typing-extensions"]);
    expect(out.map((c) => c.rank)).toEqual([1, 2, 3]);
    expect(out[0]!.downloadCount).toBe(900);
    expect(out.every((c) => c.rankFrame === "downloads")).toBe(true);
    expect(out.every((c) => c.dependentCount === null)).toBe(true);
  });

  test("returns everything available when n exceeds the source", async () => {
    const http = new HttpClient({
      transport: new MockTransport({ [RANKING_URL]: rankingBody }),
      cache: new ResponseCache(),
    });
    expect(await new PypiAdapter().rank(999, http)).toHaveLength(4);
  });

  test("an empty ranking source is an error, not an empty sample", async () => {
    const http = new HttpClient({
      transport: new MockTransport({ [RANKING_URL]: JSON.stringify({ rows: [] }) }),
      cache: new ResponseCache(),
    });
    await expect(new PypiAdapter().rank(5, http)).rejects.toThrow(/no rows in PyPI ranking source/);
  });
});

describe("PypiAdapter.fetch", () => {
  beforeEach(() => rmSync(join(TMP, "cache"), { recursive: true, force: true }));

  const candidate = {
    ecosystem: "pypi" as const,
    name: "requests",
    rank: 1,
    rankFrame: "downloads" as const,
    downloadCount: 1,
    dependentCount: null,
  };

  test("requests the simple API with the PEP 691 Accept header, plus the JSON API", async () => {
    const transport = new MockTransport({
      [simpleUrl("requests")]: JSON.stringify({ files: [] }),
      [jsonUrl("requests")]: JSON.stringify({ info: {} }),
    });
    const http = new HttpClient({ transport, cache: new ResponseCache() });
    await new PypiAdapter().fetch(candidate, http, CTX);

    expect(transport.calls.map((c) => c.url).sort()).toEqual(
      [jsonUrl("requests"), simpleUrl("requests")].sort(),
    );
    const simple = transport.calls.find((c) => c.url === simpleUrl("requests"))!;
    // Without this header PyPI serves HTML and `provenance` is unavailable entirely.
    expect(simple.req.headers.Accept).toBe(SIMPLE_ACCEPT);
    expect(simple.req.headers["User-Agent"]).toContain("pkg-trust-census");
  });

  test("re-fetching a cached package makes no further requests", async () => {
    const transport = new MockTransport({
      [simpleUrl("requests")]: JSON.stringify({ files: [] }),
      [jsonUrl("requests")]: JSON.stringify({ info: {} }),
    });
    const cache = new ResponseCache();
    const adapter = new PypiAdapter();

    await adapter.fetch(candidate, new HttpClient({ transport, cache }), CTX);
    expect(transport.calls).toHaveLength(2);

    // Fresh client and fresh cache index, as a re-invoked CLI would have.
    await adapter.fetch(candidate, new HttpClient({ transport, cache: new ResponseCache() }), CTX);
    expect(transport.calls).toHaveLength(2);
  });
});

describe("rank + fetch stages", () => {
  beforeEach(() => rmSync(join(TMP, "cache"), { recursive: true, force: true }));

  function setup() {
    const transport = new MockTransport({
      [RANKING_URL]: rankingBody,
      [simpleUrl("boto3")]: JSON.stringify({ files: [] }),
      [jsonUrl("boto3")]: JSON.stringify({ info: {} }),
      [simpleUrl("requests")]: JSON.stringify({ files: [] }),
      [jsonUrl("requests")]: JSON.stringify({ info: {} }),
    });
    return { transport, db: openDb(":memory:") };
  }

  test("rank persists the sample so fetch can run as a separate invocation", async () => {
    const { transport, db } = setup();
    const http = new HttpClient({ transport, cache: new ResponseCache() });
    await runRank(["pypi"], 2, "snap-1", db, http);

    const loaded = loadCandidates(db, "snap-1", "pypi");
    expect(loaded.map((c) => c.name)).toEqual(["boto3", "requests"]);
    expect(loaded[0]!.rank).toBe(1);
    expect(loaded[0]!.downloadCount).toBe(900);
    closeDb(db);
  });

  test("re-ranking the same snapshot updates rather than duplicating rows", async () => {
    const { transport, db } = setup();
    const http = new HttpClient({ transport, cache: new ResponseCache() });
    await runRank(["pypi"], 2, "snap-1", db, http);
    await runRank(["pypi"], 2, "snap-1", db, http);

    expect(loadCandidates(db, "snap-1", "pypi")).toHaveLength(2);
    closeDb(db);
  });

  test("fetch records a timestamp per package and clears no-longer-current errors", async () => {
    const { transport, db } = setup();
    const http = new HttpClient({ transport, cache: new ResponseCache() });
    await runRank(["pypi"], 2, "snap-1", db, http);
    const [summary] = await runFetch(["pypi"], "snap-1", db, http);

    expect(summary).toMatchObject({ attempted: 2, succeeded: 2, failed: 0 });
    const rows = db
      .select({ ts: packages.fetchTimestamp, err: packages.fetchError })
      .from(packages)
      .where(eq(packages.snapshotId, "snap-1"))
      .all();
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.ts).toBeTruthy();
      expect(r.err).toBeNull();
    }
    closeDb(db);
  });

  test("one failing package is recorded, not fatal to the run", async () => {
    const { db } = setup();
    // boto3 resolves; requests is absent from the routes, and the client is configured to
    // treat repeated failure as an error rather than a cacheable 404.
    const transport: Transport = {
      name: "flaky",
      async request(url) {
        if (url.includes("/requests/")) throw new Error("connection reset");
        return { status: 200, body: "{}", headers: new Map() };
      },
    };
    const http = new HttpClient({
      transport,
      cache: new ResponseCache(),
      maxRetries: 0,
    });
    await runRank(["pypi"], 2, "snap-2", db, new HttpClient({
      transport: new MockTransport({ [RANKING_URL]: rankingBody }),
      cache: new ResponseCache(),
    }));

    const [summary] = await runFetch(["pypi"], "snap-2", db, http);
    expect(summary).toMatchObject({ attempted: 2, succeeded: 1, failed: 1 });

    const failed = db
      .select({ name: packages.packageName, err: packages.fetchError })
      .from(packages)
      .where(isNotNull(packages.fetchError))
      .all();
    expect(failed).toHaveLength(1);
    expect(failed[0]!.name).toBe("requests");
    expect(failed[0]!.err).toContain("connection reset");
    closeDb(db);
  });

  test("fetch without a prior rank does nothing rather than inventing a sample", async () => {
    const { transport, db } = setup();
    const http = new HttpClient({ transport, cache: new ResponseCache() });
    expect(await runFetch(["pypi"], "no-such-snapshot", db, http)).toHaveLength(0);
    closeDb(db);
  });
});
