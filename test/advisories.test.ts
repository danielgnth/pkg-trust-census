/** Package URLs, OSV alias grouping and the querybatch walk. The SBOM is checked in pipeline.test.ts. */

import { describe, expect, test } from "bun:test";
import { purlOf } from "../src/advisories/purl.ts";
import { advisoryVersions, aliasGroups, databaseOf, gatherAdvisories } from "../src/advisories/osv.ts";
import { sha256 } from "../src/http/cache.ts";
import type { RequestOptions, Source } from "../src/http/client.ts";
import type { FetchResult } from "../src/types.ts";

describe("purlOf", () => {
  test("splits each registry's names into namespace and name", () => {
    expect(purlOf("maven", "org.slf4j:slf4j-api", "2.0.0")).toBe("pkg:maven/org.slf4j/slf4j-api@2.0.0");
    expect(purlOf("npm", "@types/node", "1.0.0")).toBe("pkg:npm/%40types/node@1.0.0");
    expect(purlOf("npm", "chalk", "5.6.1")).toBe("pkg:npm/chalk@5.6.1");
    expect(purlOf("packagist", "symfony/console", "v7.0.0")).toBe("pkg:composer/symfony/console@v7.0.0");
    expect(purlOf("go", "golang.org/x/net", "v0.17.0")).toBe("pkg:golang/golang.org/x/net@v0.17.0");
    expect(purlOf("crates", "serde", "1.0.0")).toBe("pkg:cargo/serde@1.0.0");
    expect(purlOf("rubygems", "rails", "7.1.0")).toBe("pkg:gem/rails@7.1.0");
  });

  test("applies the type's normalisation, except lowercasing Go module paths", () => {
    expect(purlOf("pypi", "PyYAML", "6.0")).toBe("pkg:pypi/pyyaml@6.0");
    expect(purlOf("pypi", "typing_extensions")).toBe("pkg:pypi/typing-extensions");
    // Module paths are case-sensitive; packageurl-js keeps the case (see src/facts/advisories.ts).
    expect(purlOf("go", "github.com/BurntSushi/toml", "v1.0.0")).toBe("pkg:golang/github.com/BurntSushi/toml@v1.0.0");
  });
});

describe("aliasGroups", () => {
  const rec = (id: string, aliases: string[], published: string | null, withdrawn: string | null = null) => ({ id, aliases, published, withdrawn });

  test("joins records through shared aliases, transitively, named by the first published", () => {
    const groups = aliasGroups([
      rec("PYSEC-2026-1", ["CVE-2024-1"], "2026-07-07T00:00:00Z"),
      rec("GHSA-x", ["CVE-2024-1"], "2024-05-20T00:00:00Z"),
      rec("GO-2024-9", ["GHSA-x"], "2024-06-01T00:00:00Z"),
      rec("RUSTSEC-2025-3", [], "2025-01-01T00:00:00Z"),
    ]);
    expect(Object.fromEntries(groups)).toEqual({
      "PYSEC-2026-1": "GHSA-x",
      "GHSA-x": "GHSA-x",
      "GO-2024-9": "GHSA-x",
      "RUSTSEC-2025-3": "RUSTSEC-2025-3",
    });
  });

  test("leaves withdrawn records out, so they cannot join two groups either", () => {
    const groups = aliasGroups([
      rec("A-1", [], "2025-01-01T00:00:00Z"),
      rec("B-1", [], "2025-02-01T00:00:00Z"),
      rec("C-1", ["A-1", "B-1"], "2025-01-15T00:00:00Z", "2025-03-01T00:00:00Z"),
    ]);
    expect(Object.fromEntries(groups)).toEqual({ "A-1": "A-1", "B-1": "B-1" });
  });

  test("databaseOf reads the id prefix", () => {
    expect(["GHSA-2v46-p5h4-248w", "MAL-2025-46969", "PYSEC-2026-1872", "RHSA-2026:7291"].map(databaseOf)).toEqual(["GHSA", "MAL", "PYSEC", "RHSA"]);
  });
});

/** Answers querybatch and vulns requests from tables; records every request. */
class OsvFake implements Source {
  calls: string[] = [];
  constructor(private pages: Array<Record<string, { ids: string[]; next?: string }>>) {}

  async get(url: string, opts: RequestOptions): Promise<FetchResult> {
    this.calls.push(opts.method === "POST" ? `POST ${opts.body}` : url);
    let body: string;
    if (opts.method === "POST") {
      const { queries } = JSON.parse(opts.body!) as { queries: Array<{ version: string; page_token?: string }> };
      const page = this.pages[queries[0]!.page_token ? Number(queries[0]!.page_token) : 0]!;
      body = JSON.stringify({ results: queries.map((q) => ({ vulns: (page[q.version]?.ids ?? []).map((id) => ({ id, modified: "x" })), next_page_token: page[q.version]?.next })) });
    } else {
      const id = decodeURIComponent(url.split("/").at(-1)!);
      body = JSON.stringify({ id, modified: "2025-01-01T00:00:00Z", published: "2025-01-01T00:00:00Z", aliases: id === "GHSA-m" ? ["MAL-1"] : [] });
    }
    const key = opts.method === "POST" ? `POST ${url} ${sha256(opts.body!)}` : url;
    return { url, status: 200, body, fromCache: true, entry: { url: key, sha256: sha256(body), bytes: body.length, httpStatus: 200, fetchedAt: `2026-10-1${this.calls.length}T00:00:00Z`, ecosystem: opts.ecosystem, package: opts.package, path: "mem" } };
  }

  async getJson<T>(url: string, opts: RequestOptions) {
    const res = await this.get(url, opts);
    return { data: JSON.parse(res.body) as T, res };
  }

  postJson<T>(url: string, body: unknown, opts: RequestOptions) {
    return this.getJson<T>(url, { ...opts, method: "POST", body: JSON.stringify(body) });
  }
}

describe("gatherAdvisories", () => {
  test("asks about stored and withdrawn versions, in one sorted list", () => {
    expect(
      advisoryVersions({
        versions: [{ version: "2.0" }, { version: "1.0" }] as never,
        withdrawals: [{ kind: "unpublished", versionsInWindow: 3, withdrawn: ["1.5", "1.0"] }],
      }),
    ).toEqual(["1.0", "1.5", "2.0"]);
  });

  test("follows next_page_token for the queries that have one, then reads each record once", async () => {
    const src = new OsvFake([
      { "1.0": { ids: ["GHSA-a"], next: "1" }, "2.0": { ids: ["GHSA-a"] } },
      { "1.0": { ids: ["GHSA-m"] } },
    ]);
    const got = (await gatherAdvisories(src, "npm", "chalk", ["1.0", "2.0"]))!;
    expect(got.matches).toEqual([
      { version: "1.0", advisoryId: "GHSA-a" },
      { version: "1.0", advisoryId: "GHSA-m" },
      { version: "2.0", advisoryId: "GHSA-a" },
    ]);
    // The second page asks again only for the query that had more.
    expect(JSON.parse(src.calls[1]!.slice(5)).queries).toEqual([{ package: { ecosystem: "npm", name: "chalk" }, version: "1.0", page_token: "1" }]);
    expect(src.calls.filter((c) => c.startsWith("https://"))).toHaveLength(2);
    expect(got.advisories.map((a) => [a.id, a.malicious])).toEqual([["GHSA-a", false], ["GHSA-m", true]]);
    expect(got.responses).toHaveLength(2);
    expect(got.responses[0]!.url).toStartWith("POST https://api.osv.dev/v1/querybatch ");
    expect(got.queriedAt).toBe("2026-10-11T00:00:00Z");
  });

  test("asks nothing when there are no versions", async () => {
    const src = new OsvFake([]);
    expect(await gatherAdvisories(src, "pypi", "x", [])).toBeNull();
    expect(src.calls).toEqual([]);
  });
});
