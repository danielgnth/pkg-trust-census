import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The cache resolves its root at import time, so point it at a temp dir first.
const TMP = mkdtempSync(join(tmpdir(), "pkg-trust-test-"));
process.env.PKG_TRUST_DATA_DIR = TMP;

const { ResponseCache, slug, sha256 } = await import("../src/http/cache.ts");
const { HttpClient } = await import("../src/http/client.ts");

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

/** Minimal origin so tests exercise the real fetch path without touching the network. */
function serve(handler: (req: Request) => Response | Promise<Response>) {
  return Bun.serve({ port: 0, fetch: handler });
}

describe("slug", () => {
  test("keeps names browsable but filesystem-safe", () => {
    expect(slug("requests")).toMatch(/^requests-[0-9a-f]{8}$/);
    expect(slug("@types/node")).not.toContain("/");
    expect(slug("github.com/BurntSushi/toml")).not.toContain("/");
    expect(slug("com.google.guava:guava")).not.toContain(":");
  });

  test("does not collide between names that clean to the same string", () => {
    // Without the hash suffix these would both become "a_b".
    expect(slug("a/b")).not.toBe(slug("a_b"));
  });

  test("bounds very long Go module paths", () => {
    const long = "github.com/" + "x".repeat(500);
    expect(slug(long).length).toBeLessThanOrEqual(89);
  });
});

describe("ResponseCache", () => {
  beforeEach(() => rmSync(join(TMP, "cache"), { recursive: true, force: true }));

  test("round-trips a body and records it in the manifest", async () => {
    const cache = new ResponseCache();
    const body = JSON.stringify({ hello: "world" });
    const entry = await cache.put({
      url: "https://example.test/a",
      body,
      httpStatus: 200,
      ecosystem: "pypi",
      package: "requests",
    });
    await cache.flush();

    expect(entry.sha256).toBe(sha256(body));
    expect(entry.bytes).toBe(body.length);

    const hit = await cache.get("https://example.test/a");
    expect(hit?.body).toBe(body);

    const manifest = await Bun.file(join(TMP, "cache", "manifest.jsonl")).text();
    expect(manifest.trim().split("\n")).toHaveLength(1);
    expect(JSON.parse(manifest)).toMatchObject({ url: "https://example.test/a", httpStatus: 200 });
  });

  test("misses on an unknown url", async () => {
    const cache = new ResponseCache();
    expect(await cache.get("https://example.test/never")).toBeNull();
  });

  test("survives a truncated final manifest line from an interrupted run", async () => {
    const cache = new ResponseCache();
    await cache.put({
      url: "https://example.test/a",
      body: "{}",
      httpStatus: 200,
      ecosystem: "pypi",
      package: "p",
    });
    await cache.flush();
    const path = join(TMP, "cache", "manifest.jsonl");
    await Bun.write(path, (await Bun.file(path).text()) + '{"url":"https://exam');

    const reloaded = new ResponseCache();
    expect((await reloaded.get("https://example.test/a"))?.body).toBe("{}");
  });

  test("treats a corrupt payload as a miss rather than serving bad data", async () => {
    const cache = new ResponseCache();
    const entry = await cache.put({
      url: "https://example.test/c",
      body: '{"real":true}',
      httpStatus: 200,
      ecosystem: "npm",
      package: "x",
    });
    await cache.flush();
    // Valid gzip, wrong content — so this tests the sha256 check, not the gunzip catch.
    await Bun.write(entry.path, Bun.gzipSync(new TextEncoder().encode('{"tampered":true}')));

    const reloaded = new ResponseCache();
    expect(await reloaded.get("https://example.test/c")).toBeNull();
  });

  test("concurrent puts do not interleave manifest lines", async () => {
    const cache = new ResponseCache();
    await Promise.all(
      Array.from({ length: 40 }, (_, i) =>
        cache.put({
          url: `https://example.test/n/${i}`,
          body: JSON.stringify({ i, pad: "y".repeat(200) }),
          httpStatus: 200,
          ecosystem: "crates",
          package: `pkg-${i}`,
        }),
      ),
    );
    await cache.flush();

    const lines = (await Bun.file(join(TMP, "cache", "manifest.jsonl")).text())
      .trim()
      .split("\n");
    expect(lines).toHaveLength(40);
    for (const l of lines) expect(() => JSON.parse(l)).not.toThrow();
  });
});

describe("HttpClient", () => {
  beforeEach(() => rmSync(join(TMP, "cache"), { recursive: true, force: true }));

  test("second request for the same url is served from cache", async () => {
    let hits = 0;
    const srv = serve(() => {
      hits++;
      return Response.json({ ok: true });
    });
    try {
      const http = new HttpClient();
      const url = `http://localhost:${srv.port}/pkg`;
      const a = await http.get(url, { ecosystem: "pypi", package: "requests" });
      const b = await http.get(url, { ecosystem: "pypi", package: "requests" });

      expect(a.fromCache).toBe(false);
      expect(b.fromCache).toBe(true);
      expect(b.body).toBe(a.body);
      expect(hits).toBe(1);
      expect(http.stats.cacheHits).toBe(1);
    } finally {
      srv.stop(true);
    }
  });

  test("--force bypasses a warm cache", async () => {
    let hits = 0;
    const srv = serve(() => Response.json({ n: ++hits }));
    try {
      const http = new HttpClient();
      const url = `http://localhost:${srv.port}/f`;
      await http.get(url, { ecosystem: "npm", package: "p" });
      const second = await http.get(url, { ecosystem: "npm", package: "p", force: true });
      expect(second.fromCache).toBe(false);
      expect(hits).toBe(2);
    } finally {
      srv.stop(true);
    }
  });

  test("an interrupted run resumes without re-fetching completed work", async () => {
    let hits = 0;
    const srv = serve(() => {
      hits++;
      return Response.json({ ok: true });
    });
    try {
      const urls = Array.from({ length: 6 }, (_, i) => `http://localhost:${srv.port}/r/${i}`);
      const first = new HttpClient();
      for (const u of urls.slice(0, 4)) await first.get(u, { ecosystem: "pypi", package: "p" });
      await first.flush();
      expect(hits).toBe(4);

      // Fresh client + fresh cache index, as a re-invoked CLI would have.
      const resumed = new HttpClient();
      for (const u of urls) await resumed.get(u, { ecosystem: "pypi", package: "p" });
      await resumed.flush();

      expect(hits).toBe(6);
      expect(resumed.stats.cacheHits).toBe(4);
      expect(resumed.stats.fetched).toBe(2);
    } finally {
      srv.stop(true);
    }
  });

  test("404 is cached as a fact, not raised as an error", async () => {
    const srv = serve(() => new Response("nope", { status: 404 }));
    try {
      const http = new HttpClient();
      const { data, res } = await http.getJson(`http://localhost:${srv.port}/missing`, {
        ecosystem: "go",
        package: "m",
      });
      expect(res.status).toBe(404);
      expect(data).toBeNull();
    } finally {
      srv.stop(true);
    }
  });

  test("retries a 503 and then succeeds", async () => {
    let n = 0;
    const srv = serve(() =>
      ++n < 3 ? new Response("busy", { status: 503 }) : Response.json({ ok: true }),
    );
    try {
      const http = new HttpClient({ maxRetries: 4 });
      const res = await http.get(`http://localhost:${srv.port}/flaky`, {
        ecosystem: "crates",
        package: "c",
      });
      expect(res.status).toBe(200);
      expect(n).toBe(3);
      expect(http.stats.retries).toBe(2);
    } finally {
      srv.stop(true);
    }
  }, 20_000);

  test("honours Retry-After instead of the backoff curve", async () => {
    let n = 0;
    const srv = serve(() =>
      ++n === 1
        ? new Response("slow down", { status: 429, headers: { "retry-after": "1" } })
        : Response.json({ ok: true }),
    );
    try {
      const http = new HttpClient();
      const t0 = Date.now();
      await http.get(`http://localhost:${srv.port}/429`, { ecosystem: "rubygems", package: "g" });
      // Retry-After: 1 rather than the ~1s first backoff step; assert it waited at all
      // and did not blow past the header's instruction.
      const elapsed = Date.now() - t0;
      expect(elapsed).toBeGreaterThanOrEqual(900);
      expect(elapsed).toBeLessThan(6000);
    } finally {
      srv.stop(true);
    }
  }, 20_000);

  test("throws once the retry budget is exhausted so it becomes a recorded fetch_error", async () => {
    const srv = serve(() => new Response("down", { status: 500 }));
    try {
      const http = new HttpClient({ maxRetries: 1 });
      await expect(
        http.get(`http://localhost:${srv.port}/dead`, { ecosystem: "maven", package: "m" }),
      ).rejects.toThrow(/fetch failed after 2 attempts/);
      expect(http.stats.errors).toBe(1);
    } finally {
      srv.stop(true);
    }
  }, 20_000);

  test("unexpected status is an error, not a silent empty body", async () => {
    const srv = serve(() => new Response("teapot", { status: 418 }));
    try {
      const http = new HttpClient();
      await expect(
        http.get(`http://localhost:${srv.port}/tea`, { ecosystem: "packagist", package: "p" }),
      ).rejects.toThrow(/unexpected HTTP 418/);
    } finally {
      srv.stop(true);
    }
  });

  test("invalid JSON surfaces the url rather than a bare parse error", async () => {
    const srv = serve(() => new Response("<html>not json</html>"));
    try {
      const http = new HttpClient();
      await expect(
        http.getJson(`http://localhost:${srv.port}/html`, { ecosystem: "pypi", package: "p" }),
      ).rejects.toThrow(/invalid JSON from http/);
    } finally {
      srv.stop(true);
    }
  });

  test("HEAD keeps Last-Modified as its cached body, separately from a GET of the same url", async () => {
    const srv = serve((req) =>
      req.method === "HEAD"
        ? new Response(null, { headers: { "Last-Modified": "Mon, 14 Apr 2025 17:25:22 GMT" } })
        : Response.json({ got: true }),
    );
    try {
      const http = new HttpClient();
      const url = `http://localhost:${srv.port}/a.pom`;
      const head = await http.get(url, { ecosystem: "maven", package: "g:a", method: "HEAD" });
      const get = await http.get(url, { ecosystem: "maven", package: "g:a" });

      expect(JSON.parse(head.body)["last-modified"]).toBe("Mon, 14 Apr 2025 17:25:22 GMT");
      expect(get.body).toBe('{"got":true}');
      expect(head.entry.url).toBe(`HEAD ${url}`);

      const { CacheSource } = await import("../src/http/client.ts");
      const replay = new CacheSource(new ResponseCache());
      const again = await replay.get(url, { ecosystem: "maven", package: "g:a", method: "HEAD" });
      expect(again.body).toBe(head.body);
    } finally {
      srv.stop(true);
    }
  });

  test("a POST is cached per body, records the body in the manifest, and replays from the cache", async () => {
    const bodies: string[] = [];
    const srv = serve(async (req) => {
      const body = await req.text();
      bodies.push(body);
      return Response.json({ echo: JSON.parse(body), type: req.headers.get("content-type") });
    });
    try {
      const http = new HttpClient();
      const url = `http://localhost:${srv.port}/v1/querybatch`;
      const opts = { ecosystem: "npm", package: "chalk" } as const;
      const a = await http.postJson<{ echo: unknown; type: string }>(url, { q: 1 }, opts);
      const again = await http.postJson(url, { q: 1 }, opts);
      const b = await http.postJson(url, { q: 2 }, opts);
      await http.flush();

      expect(bodies).toEqual(['{"q":1}', '{"q":2}']);
      expect(a.data).toEqual({ echo: { q: 1 }, type: "application/json" });
      expect(again.res.fromCache).toBe(true);
      expect(b.res.fromCache).toBe(false);
      expect(a.res.entry.url).toBe(`POST ${url} ${sha256('{"q":1}')}`);

      const manifest = (await Bun.file(join(TMP, "cache", "manifest.jsonl")).text()).trim().split("\n").map((l) => JSON.parse(l));
      expect(manifest.find((e) => e.url === a.res.entry.url).requestBody).toBe('{"q":1}');

      const { CacheSource } = await import("../src/http/client.ts");
      const replay = new CacheSource(new ResponseCache());
      expect((await replay.postJson(url, { q: 2 }, opts)).data).toEqual(b.data);
      await expect(replay.postJson(url, { q: 3 }, opts)).rejects.toThrow("not in cache: POST");
    } finally {
      srv.stop(true);
    }
  });

  test("a POST query is retried like a GET", async () => {
    let hits = 0;
    const srv = serve(() => (++hits < 2 ? new Response("busy", { status: 503 }) : Response.json({ ok: true })));
    try {
      const http = new HttpClient({ maxRetries: 2 });
      const { data } = await http.postJson(`http://localhost:${srv.port}/q`, { q: 1 }, { ecosystem: "pypi", package: "p" });
      expect(data).toEqual({ ok: true });
      expect(hits).toBe(2);
    } finally {
      srv.stop(true);
    }
  });

  test("the curl transport sends a POST body", async () => {
    const srv = serve(async (req) => Response.json({ method: req.method, body: await req.text() }));
    try {
      const { CurlTransport } = await import("../src/http/transport.ts");
      const res = await new CurlTransport().fetch(new Request(`http://localhost:${srv.port}/q`, { method: "POST", body: '{"a":1}' }));
      expect(await res.json()).toEqual({ method: "POST", body: '{"a":1}' });
    } finally {
      srv.stop(true);
    }
  });
});

describe("per-host pacing", () => {
  test("spaces requests to the configured rate", async () => {
    const srv = serve(() => Response.json({}));
    try {
      const http = new HttpClient({ policies: { [`localhost:${srv.port}`]: { rps: 10, concurrency: 4 } } });
      const t0 = Date.now();
      await Promise.all(
        Array.from({ length: 5 }, (_, i) => http.get(`http://localhost:${srv.port}/s/${i}`, { ecosystem: "pypi", package: "p" })),
      );
      // 5 starts at 100ms spacing: the first is immediate, so >= 400ms.
      expect(Date.now() - t0).toBeGreaterThanOrEqual(380);
    } finally {
      srv.stop(true);
    }
  });

  test("caps concurrency", async () => {
    let active = 0;
    let peak = 0;
    const srv = serve(async () => {
      peak = Math.max(peak, ++active);
      await Bun.sleep(15);
      active--;
      return Response.json({});
    });
    try {
      const http = new HttpClient({ policies: { [`localhost:${srv.port}`]: { rps: 1000, concurrency: 2 } } });
      await Promise.all(
        Array.from({ length: 8 }, (_, i) => http.get(`http://localhost:${srv.port}/c/${i}`, { ecosystem: "pypi", package: "p" })),
      );
      expect(peak).toBeLessThanOrEqual(2);
    } finally {
      srv.stop(true);
    }
  });
});
