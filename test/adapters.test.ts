/**
 * Extract tests for every adapter, run against the captured M0 fixtures where they exist
 * and small synthetic responses where a fixture cannot express the case (Maven dates).
 *
 * Each test also checks the extracted signals against src/facts — an adapter that emits
 * `unknown` for a signal the facts call "observable", or a percentage for a "no
 * mechanism" cell, would make the matrix lie.
 */

import { describe, expect, test } from "bun:test";
import type { Candidate, EcosystemId, ExtractedPackage, FetchResult } from "../src/types.ts";
import { CacheMissError, cacheKey, type RequestOptions, type Source } from "../src/http/client.ts";
import { sha256 } from "../src/http/cache.ts";
import { availabilityOf, AVAILABILITY } from "../src/facts/index.ts";
import { BASELINE, BASELINE_PROPERTIES, baselineOf } from "../src/facts/baseline.ts";
import { SIGSTORE, sigstoreOf } from "../src/facts/sigstore.ts";
import { PQC, PQC_LAYERS, pqcOf } from "../src/facts/pqc.ts";
import { POLICIES, POLICY_PROPERTIES, policyOf } from "../src/facts/policies.ts";
import { ECOSYSTEMS, SIGNALS } from "../src/types.ts";
import { PypiAdapter, jsonUrl, simpleUrl } from "../src/adapters/pypi.ts";
import { NpmAdapter, highImpactWindow, packumentUrl, windowDownloadsUrl } from "../src/adapters/npm.ts";
import { CratesAdapter } from "../src/adapters/crates.ts";
import { RubygemsAdapter } from "../src/adapters/rubygems.ts";
import { GoAdapter, parseRetractions, retractedVersions } from "../src/adapters/go.ts";
import { MavenAdapter, pomUrl } from "../src/adapters/maven.ts";
import { PackagistAdapter } from "../src/adapters/packagist.ts";

const CTX = { asOf: new Date("2026-10-01T00:00:00Z") };
const fixture = (name: string) => Bun.file(`test/fixtures/${name}`).text();

type Route = string | { status: number; body?: string };

/** An in-memory `Source`: what `extract` sees, with every request recorded. */
class FakeSource implements Source {
  calls: string[] = [];
  constructor(private routes: Record<string, Route>) {}

  async get(url: string, opts: RequestOptions): Promise<FetchResult> {
    const key = cacheKey(url, opts.method, opts.body);
    this.calls.push(key);
    const route = this.routes[key];
    if (route === undefined) throw new CacheMissError(url);
    const { status, body } = typeof route === "string" ? { status: 200, body: route } : { status: route.status, body: route.body ?? "" };
    return {
      url,
      status,
      body,
      fromCache: true,
      entry: {
        url: key, sha256: sha256(body), bytes: body.length, httpStatus: status, fetchedAt: "2026-10-01T00:00:00Z",
        ecosystem: opts.ecosystem, package: opts.package, path: `mem/${sha256(key).slice(0, 8)}`,
      },
    };
  }

  async getJson<T>(url: string, opts: RequestOptions): Promise<{ data: T | null; res: FetchResult }> {
    const res = await this.get(url, opts);
    return { data: res.status === 404 || res.status === 410 ? null : (JSON.parse(res.body) as T), res };
  }

  postJson<T>(url: string, body: unknown, opts: RequestOptions): Promise<{ data: T | null; res: FetchResult }> {
    return this.getJson<T>(url, { ...opts, method: "POST", body: JSON.stringify(body) });
  }
}

function candidate(ecosystem: EcosystemId, name: string): Candidate {
  const deps = ecosystem === "go" || ecosystem === "maven";
  return { ecosystem, name, rank: 1, rankFrame: deps ? "dependents" : "downloads", downloadCount: deps ? null : 1, dependentCount: deps ? 1 : null };
}

const sig = (pkg: ExtractedPackage, version: string, signal: string) =>
  pkg.versions.find((v) => v.version === version)?.signals.find((s) => s.signal === signal);

function assertConsistentWithFacts(pkg: ExtractedPackage): void {
  for (const v of pkg.versions) {
    expect(v.signals.map((s) => s.signal).sort()).toEqual([...SIGNALS].sort());
    for (const s of v.signals) {
      const fact = availabilityOf(pkg.ecosystem, s.signal);
      const where = `${pkg.ecosystem}/${pkg.name}@${v.version} ${s.signal}`;
      if (fact.availability === "no_mechanism") expect([where, s.value, s.signalSource.startsWith("no_mechanism")]).toEqual([where, "false", true]);
      if (fact.availability === "not_exposed") expect([where, s.value, s.signalSource.startsWith("not_exposed")]).toEqual([where, "unknown", true]);
      if (fact.availability === "observable") expect([where, s.value === "unknown"]).toEqual([where, false]);
      if (s.value === "true") expect([where, s.evidence != null]).toEqual([where, true]);
      // Every value read from the registry names the cached responses it was read from.
      if (!/^(policy|no_mechanism|not_exposed):/.test(s.signalSource)) expect([where, s.responses.length > 0]).toEqual([where, true]);
      for (const r of s.responses) expect([where, r.sha256]).toEqual([where, expect.stringMatching(/^[0-9a-f]{64}$/)]);
    }
  }
}

describe("facts", () => {
  test("cover every ecosystem × signal exactly once", () => {
    expect(AVAILABILITY).toHaveLength(ECOSYSTEMS.length * SIGNALS.length);
    for (const e of ECOSYSTEMS) for (const s of SIGNALS) expect(() => availabilityOf(e, s)).not.toThrow();
  });

  test("the registry baseline covers every ecosystem × property exactly once, each cited", () => {
    expect(BASELINE).toHaveLength(ECOSYSTEMS.length * BASELINE_PROPERTIES.length);
    for (const e of ECOSYSTEMS) for (const p of BASELINE_PROPERTIES) expect(() => baselineOf(e, p.id)).not.toThrow();
    for (const b of BASELINE) {
      expect(b.sources.length).toBeGreaterThan(0);
      for (const c of b.sources) expect(c.quote.length).toBeGreaterThan(0);
      expect(b.note.length).toBeGreaterThan(10);
      if (b.since) expect(b.since).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  test("the Sigstore table covers every ecosystem once, each cited", () => {
    expect(SIGSTORE).toHaveLength(ECOSYSTEMS.length);
    for (const e of ECOSYSTEMS) expect(() => sigstoreOf(e)).not.toThrow();
    for (const s of SIGSTORE) {
      expect(s.sources.length).toBeGreaterThan(0);
      for (const c of s.sources) expect(c.quote.length).toBeGreaterThan(0);
      // A registry that accepts bundles has a start date and says who checks them.
      if (s.status === "yes") expect([s.since, s.registryVerifies]).toEqual([expect.stringMatching(/^\d{4}-\d{2}$/), expect.any(String)]);
      else expect([s.since, s.registryVerifies, s.clients.every((c) => c.verifies === "n/a")]).toEqual([undefined, "n/a", true]);
      expect(s.clients.length).toBeGreaterThan(0);
      for (const c of s.clients) expect(c.sources.length).toBeGreaterThan(0);
    }
  });

  test("the post-quantum table covers every ecosystem × layer once, each cited", () => {
    expect(PQC).toHaveLength(ECOSYSTEMS.length * PQC_LAYERS.length);
    for (const e of ECOSYSTEMS) for (const l of PQC_LAYERS) expect(() => pqcOf(e, l.id)).not.toThrow();
    for (const p of PQC) {
      expect(p.sources.length).toBeGreaterThan(0);
      for (const c of p.sources) expect(c.quote.length).toBeGreaterThan(0);
      expect(p.note.length).toBeGreaterThan(5);
    }
  });

  test("the governance/containment table covers every ecosystem × property once, each cited", () => {
    expect(POLICIES).toHaveLength(ECOSYSTEMS.length * POLICY_PROPERTIES.length);
    for (const e of ECOSYSTEMS) for (const p of POLICY_PROPERTIES) expect(() => policyOf(e, p.id)).not.toThrow();
    for (const b of POLICIES) {
      expect(b.sources.length).toBeGreaterThan(0);
      for (const c of b.sources) expect(c.quote.length).toBeGreaterThan(0);
      expect(b.note.length).toBeGreaterThan(10);
      if (b.since) expect(b.since).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  test("post-quantum cells agree with the Sigstore table", () => {
    // A registry that accepts Sigstore bundles has a (classical) publisher signature and a log.
    for (const s of SIGSTORE.filter((x) => x.status === "yes")) {
      expect(pqcOf(s.ecosystem, "publisher_signature").status).toBe("vulnerable");
      expect(pqcOf(s.ecosystem, "transparency_log").status).toBe("partial");
    }
  });

  test("Sigstore facts agree with the signal availability they explain", () => {
    // Every registry that accepts bundles measures them as a publisher signature.
    for (const s of SIGSTORE.filter((x) => x.status === "yes")) {
      expect([s.ecosystem, availabilityOf(s.ecosystem, "artifact_signature").availability]).not.toEqual([s.ecosystem, "no_mechanism"]);
    }
  });
});

describe("PyPI extract", () => {
  /** Every attested file's provenance URL answers with `provenance` (default: the real capture). */
  async function sigstoreRoutes(provenance?: Route) {
    const simple = await fixture("pypi-simple-sigstore.json");
    const body = provenance ?? (await fixture("pypi-provenance-sigstore.json"));
    const routes: Record<string, Route> = {
      [simpleUrl("sigstore")]: simple,
      [jsonUrl("sigstore")]: JSON.stringify({ info: { version: "4.5.0", project_urls: { Source: "https://github.com/sigstore/sigstore-python" } } }),
    };
    for (const f of JSON.parse(simple).files) if (f.provenance) routes[f.provenance] = body;
    return new FakeSource(routes);
  }

  test("a publish attestation is a signature and a source link, but not SLSA provenance", async () => {
    const pkg = await new PypiAdapter().extract(candidate("pypi", "sigstore"), await sigstoreRoutes(), CTX);

    expect(pkg.latestVersion).toBe("4.5.0");
    expect(pkg.repositoryUrl).toBe("https://github.com/sigstore/sigstore-python");
    expect(pkg.maintainerCount).toBeNull();
    expect(sig(pkg, "4.5.0", "artifact_signature")!.evidence).toContain("(2/2 files attested)");
    expect(sig(pkg, "4.5.0", "build_provenance")!.value).toBe("false");
    expect(sig(pkg, "4.5.0", "source_link")!.evidence).toMatch(/sigstore-python@[0-9a-f]{40}$/);
    expect(sig(pkg, "4.5.0", "identity_publish")!.evidence).toBe("GitHub sigstore/sigstore-python release.yml");
    expect(sig(pkg, "4.5.0", "registry_integrity")!.value).toBe("false");
    expect(sig(pkg, "4.5.0", "mfa_enforced")!.value).toBe("true");
    assertConsistentWithFacts(pkg);
  });

  test("an SLSA predicate in the provenance object is build provenance", async () => {
    const statement = Buffer.from(JSON.stringify({ predicateType: "https://slsa.dev/provenance/v1" })).toString("base64");
    const prov = JSON.stringify({ version: 1, attestation_bundles: [{ publisher: { kind: "GitHub" }, attestations: [{ envelope: { statement } }] }] });
    const pkg = await new PypiAdapter().extract(candidate("pypi", "sigstore"), await sigstoreRoutes(prov), CTX);
    expect(sig(pkg, "4.5.0", "build_provenance")!.value).toBe("true");
  });

  test("an attested release whose provenance object is gone is unknown, not false", async () => {
    const pkg = await new PypiAdapter().extract(candidate("pypi", "sigstore"), await sigstoreRoutes({ status: 404 }), CTX);
    expect(sig(pkg, "4.5.0", "build_provenance")!.value).toBe("unknown");
    expect(sig(pkg, "4.5.0", "source_link")!.value).toBe("unknown");
    expect(sig(pkg, "4.5.0", "artifact_signature")!.value).toBe("true");
  });

  test("an unattested release is a real negative for provenance but unknown for identity", async () => {
    const src = new FakeSource({
      [simpleUrl("ruff")]: await fixture("pypi-simple-ruff.json"),
      [jsonUrl("ruff")]: JSON.stringify({ info: { version: "0.16.3" } }),
    });
    const pkg = await new PypiAdapter().extract(candidate("pypi", "ruff"), src, CTX);

    expect(sig(pkg, "0.16.3", "build_provenance")!.value).toBe("false");
    expect(sig(pkg, "0.16.3", "identity_publish")!.value).toBe("unknown");
    expect(pkg.withdrawals).toEqual([{ kind: "yanked", versionsInWindow: expect.any(Number), withdrawn: expect.any(Array), releasedAt: expect.any(Object) }]);
    // Without a provenance URL there is no provenance object, so the negative rests on the index.
    expect(sig(pkg, "0.16.3", "build_provenance")!.responses.map((r) => r.url)).toEqual([simpleUrl("ruff")]);
    assertConsistentWithFacts(pkg);
  });

  test("a project PyPI does not have is an error, not an empty package", async () => {
    const src = new FakeSource({ [simpleUrl("nope")]: { status: 404 }, [jsonUrl("nope")]: { status: 404 } });
    await expect(new PypiAdapter().extract(candidate("pypi", "nope"), src, CTX)).rejects.toThrow(/no project/);
  });

  test("extract makes exactly the requests fetch made", async () => {
    const routes = {
      [simpleUrl("ruff")]: await fixture("pypi-simple-ruff.json"),
      [jsonUrl("ruff")]: JSON.stringify({ info: { version: "0.16.3" } }),
    };
    const a = new FakeSource(routes);
    const b = new FakeSource(routes);
    await new PypiAdapter().fetch(candidate("pypi", "ruff"), a, CTX);
    await new PypiAdapter().extract(candidate("pypi", "ruff"), b, CTX);
    expect(b.calls).toEqual(a.calls);
  });
});

describe("npm extract", () => {
  /** The packument plus one downloads answer per release date the adapter will ask about. */
  async function npmRoutes(name: string, weekly: (version: string) => Route = () => JSON.stringify({ downloads: 0 })) {
    const body = await fixture(`npm-packument-${name}.json`);
    const routes: Record<string, Route> = { [packumentUrl(name)]: body };
    for (const [version, at] of Object.entries(JSON.parse(body).time as Record<string, string>)) {
      const window = highImpactWindow(at);
      if (window) routes[windowDownloadsUrl(name, window)] = weekly(version);
    }
    return routes;
  }

  test("trusted publishing and provenance are read per version", async () => {
    const src = new FakeSource(await npmRoutes("sigstore"));
    const pkg = await new NpmAdapter().extract(candidate("npm", "sigstore"), src, CTX);

    expect(pkg.latestVersion).toBe("5.0.0");
    expect(pkg.repositoryUrl).toBe("https://github.com/sigstore/sigstore-js");
    expect(sig(pkg, "5.0.0", "identity_publish")).toMatchObject({ value: "true" });
    expect(sig(pkg, "5.0.0", "build_provenance")!.evidence).toContain("slsa.dev/provenance/v1");
    expect(sig(pkg, "5.0.0", "artifact_signature")!.value).toBe("true");
    expect(sig(pkg, "5.0.0", "source_link")!.value).toBe("true");
    expect(sig(pkg, "5.0.0", "mfa_enforced")!.value).toBe("unknown");
    assertConsistentWithFacts(pkg);
  });

  test("a registry signature is not a publisher signature", async () => {
    const src = new FakeSource(await npmRoutes("chalk"));
    const pkg = await new NpmAdapter().extract(candidate("npm", "chalk"), src, CTX);

    expect(sig(pkg, "6.0.0", "registry_integrity")!.value).toBe("true");
    expect(sig(pkg, "6.0.0", "artifact_signature")!.value).toBe("false");
    expect(sig(pkg, "6.0.0", "source_link")!.value).toBe("false");
    expect(sig(pkg, "6.0.0", "build_provenance")!.value).toBe("false");
    expect(sig(pkg, "6.0.0", "identity_publish")!.value).toBe("false");
    assertConsistentWithFacts(pkg);
  });

  test("unpublished versions are read from the time map, deprecated ones from the manifest", async () => {
    const doc = {
      "dist-tags": { latest: "2.0.0" },
      time: {
        created: "2023-01-01T00:00:00Z",
        modified: "2026-09-01T00:00:00Z",
        "1.0.0": "2023-06-01T00:00:00Z",
        "1.1.0": "2025-01-01T00:00:00Z",
        "1.1.1": "2025-09-08T13:00:00Z",
        "2.0.0": "2026-02-01T00:00:00Z",
      },
      versions: { "1.0.0": { deprecated: "old" }, "1.1.0": { deprecated: "use 2.x" }, "2.0.0": {} },
    };
    const routes: Record<string, Route> = { [packumentUrl("w")]: JSON.stringify(doc) };
    for (const at of Object.values(doc.time)) {
      const window = highImpactWindow(at);
      if (window) routes[windowDownloadsUrl("w", window)] = JSON.stringify({ downloads: 0 });
    }
    const pkg = await new NpmAdapter().extract(candidate("npm", "w"), new FakeSource(routes), CTX);
    // 1.0.0 predates the window; 1.1.1 was unpublished and survives only in `time`.
    expect(pkg.withdrawals).toEqual([
      // The release time of an unpublished version is what advisory timing is measured from.
      { kind: "unpublished", versionsInWindow: 3, withdrawn: ["1.1.1"], releasedAt: { "1.1.1": "2025-09-08T13:00:00Z" } },
      { kind: "deprecated", versionsInWindow: 3, withdrawn: ["1.1.0"], releasedAt: { "1.1.0": "2025-01-01T00:00:00Z" } },
    ]);
  });

  test("the high-impact window is the week ending 15 days before the publication day", () => {
    expect(highImpactWindow("2026-06-01T21:02:52.319Z")).toBe("2026-05-11:2026-05-17");
    expect(highImpactWindow("2022-11-01T00:00:00Z")).toBe("2022-10-11:2022-10-17");
    expect(highImpactWindow("2022-10-31T23:59:59Z")).toBeNull();
    expect(highImpactWindow(null)).toBeNull();
    expect(windowDownloadsUrl("@babel/core", "2026-05-11:2026-05-17")).toBe(
      "https://api.npmjs.org/downloads/point/2026-05-11:2026-05-17/@babel/core",
    );
  });

  test("MFA is true above 1M weekly downloads, and unknown at or below it or without a count", async () => {
    const counts: Record<string, Route> = {
      "5.0.0": JSON.stringify({ downloads: 4_200_000 }),
      "4.0.0": JSON.stringify({ downloads: 1_000_000 }),
      "4.1.0": { status: 404, body: '{"error":"package sigstore not found"}' },
    };
    const src = new FakeSource(await npmRoutes("sigstore", (v) => counts[v] ?? JSON.stringify({ downloads: 0 })));
    const pkg = await new NpmAdapter().extract(candidate("npm", "sigstore"), src, CTX);

    expect(sig(pkg, "5.0.0", "mfa_enforced")).toMatchObject({ value: "true", evidence: "4200000 downloads in 2026-05-11:2026-05-17" });
    expect(sig(pkg, "5.0.0", "mfa_enforced")!.responses.map((r) => r.url)).toEqual([
      "https://api.npmjs.org/downloads/point/2026-05-11:2026-05-17/sigstore",
    ]);
    expect(sig(pkg, "4.0.0", "mfa_enforced")).toMatchObject({ value: "unknown", evidence: "1000000 downloads in 2025-07-08:2025-07-14" });
    expect(sig(pkg, "4.1.0", "mfa_enforced")).toMatchObject({ value: "unknown", evidence: null });
    assertConsistentWithFacts(pkg);
  });

  test("releases before the high-impact rule are unknown and cost no downloads request", async () => {
    const doc = {
      "dist-tags": { latest: "1.0.0" },
      time: { "1.0.0": "2021-03-01T00:00:00Z" },
      versions: { "1.0.0": {} },
    };
    const src = new FakeSource({ [packumentUrl("old")]: JSON.stringify(doc) });
    const pkg = await new NpmAdapter().extract(candidate("npm", "old"), src, CTX);

    expect(sig(pkg, "1.0.0", "mfa_enforced")!.value).toBe("unknown");
    expect(src.calls).toEqual([packumentUrl("old")]);
  });

  test("extract makes exactly the requests fetch made", async () => {
    const routes = await npmRoutes("sigstore");
    const a = new FakeSource(routes);
    const b = new FakeSource(routes);
    await new NpmAdapter().fetch(candidate("npm", "sigstore"), a, CTX);
    await new NpmAdapter().extract(candidate("npm", "sigstore"), b, CTX);
    expect(b.calls).toEqual(a.calls);
    expect(a.calls.filter((c) => c.includes("api.npmjs.org")).length).toBeGreaterThan(0);
  });
});

describe("crates.io extract", () => {
  async function routes(name: string, file: string, defaultVersion: string) {
    // The fixture was captured with a smaller page size; end the walk at its last page.
    const page = JSON.parse(await fixture(file));
    page.meta.next_page = null;
    return new FakeSource({
      [`https://crates.io/api/v1/crates/${name}/versions?per_page=100&sort=date`]: JSON.stringify(page),
      [`https://crates.io/api/v1/crates/${name}?include=default_version`]: JSON.stringify({ crate: { default_version: defaultVersion, repository: "https://github.com/x/y" } }),
      [`https://crates.io/api/v1/crates/${name}/owners`]: JSON.stringify({ users: [{ kind: "user" }, { kind: "team" }] }),
    });
  }

  test("trustpub_data is the direct observation of trusted publishing", async () => {
    const pkg = await new CratesAdapter().extract(candidate("crates", "bon"), await routes("bon", "crates-versions-bon.json", "3.9.3"), CTX);
    expect(sig(pkg, "3.9.3", "identity_publish")!.evidence).toContain("github:elastio/bon");
    expect(sig(pkg, "3.9.3", "artifact_signature")).toMatchObject({ value: "false" });
    expect(sig(pkg, "3.9.3", "source_link")!.evidence).toMatch(/^elastio\/bon@[0-9a-f]{40} \(run \d+\)$/);
    expect(pkg.maintainerCount).toBe(1);
    assertConsistentWithFacts(pkg);
  });

  test("a token-published crate is a real negative", async () => {
    const pkg = await new CratesAdapter().extract(candidate("crates", "serde"), await routes("serde", "crates-versions-serde.json", "1.0.229"), CTX);
    expect(sig(pkg, "1.0.229", "identity_publish")!.value).toBe("false");
    expect(sig(pkg, "1.0.229", "source_link")!.value).toBe("false");
    assertConsistentWithFacts(pkg);
  });
});

describe("RubyGems extract", () => {
  test("MFA metadata and Sigstore attestations are read per version", async () => {
    const versions = JSON.parse(await fixture("rubygems-versions-rails.json")) as Array<{ number: string }>;
    const bundle = await fixture("rubygems-attestations-rails.json");
    const routes: Record<string, Route> = {
      "https://rubygems.org/api/v1/versions/rails.json": JSON.stringify(versions),
      "https://rubygems.org/api/v1/gems/rails.json": JSON.stringify({ version: "8.1.3.1", source_code_uri: "https://github.com/rails/rails/tree/v8.1.3.1" }),
      "https://rubygems.org/api/v1/gems/rails/owners.json": JSON.stringify([{}, {}, {}]),
    };
    const tpPage = await fixture("rubygems-page-rails-8.1.3.1.html");
    const userPage = await fixture("rubygems-page-rails-7.0.0.html");
    const oldPage = await fixture("rubygems-page-rails-4.0.0.html");
    const oldest = versions.at(-1)!.number;
    for (const v of versions) {
      routes[`https://rubygems.org/api/v1/attestations/rails-${v.number}.json`] = v.number === "8.1.3.1" ? bundle : "[]";
      routes[`https://rubygems.org/gems/rails/versions/${v.number}`] = v.number === "8.1.3.1" ? tpPage : v.number === oldest ? oldPage : userPage;
    }
    const pkg = await new RubygemsAdapter().extract(candidate("rubygems", "rails"), new FakeSource(routes), CTX);

    expect(pkg.latestVersion).toBe("8.1.3.1");
    expect(pkg.repositoryUrl).toBe("https://github.com/rails/rails");
    expect(pkg.maintainerCount).toBe(3);
    expect(sig(pkg, "8.1.3.1", "mfa_enforced")!.value).toBe("true");
    // The page names the trusted publisher.
    expect(sig(pkg, "8.1.3.1", "identity_publish")).toMatchObject({ value: "true", evidence: expect.stringContaining("GitHub Actions rails/rails") });
    expect(sig(pkg, "8.1.3.1", "transparency_log")!.evidence).toMatch(/Rekor logIndex \d+/);
    expect(sig(pkg, "8.1.3.1", "source_link")!.evidence).toMatch(/^https:\/\/github.com\/rails\/rails@[0-9a-f]{40}$/);
    // A bare message signature carries no SLSA statement.
    expect(sig(pkg, "8.1.3.1", "build_provenance")!.value).toBe("false");
    const older = pkg.versions.find((v) => !v.isLatest)!;
    // An empty attestation list: no Sigstore signature, but a gem-cert one is invisible.
    expect(older.signals.find((s) => s.signal === "artifact_signature")!.value).toBe("unknown");
    expect(older.signals.find((s) => s.signal === "source_link")!.value).toBe("false");
    // A user push is an API-key push: a real negative, unlike a missing attestation.
    expect(older.signals.find((s) => s.signal === "identity_publish")).toMatchObject({ value: "false", evidence: "pushed with a user API key" });
    assertConsistentWithFacts(pkg);
  });
});

describe("Go extract", () => {
  test("sumdb inclusion and proxy Origin are read for the kept versions", async () => {
    const latest = await fixture("go-latest-gorilla-mux.json");
    const src = new FakeSource({
      "https://proxy.golang.org/github.com/gorilla/mux/@v/list": "v1.8.0\nv1.8.1\nv1.9.0-rc.1\n",
      "https://proxy.golang.org/github.com/gorilla/mux/@latest": latest,
      "https://proxy.golang.org/github.com/gorilla/mux/@v/v1.8.0.info": JSON.stringify({ Version: "v1.8.0", Time: "2020-08-17T07:28:15Z" }),
      "https://proxy.golang.org/github.com/gorilla/mux/@v/v1.8.1.info": latest,
      "https://sum.golang.org/lookup/github.com/gorilla/mux@v1.8.1": await fixture("go-sumdb-gorilla-mux.txt"),
      "https://proxy.golang.org/github.com/gorilla/mux/@v/v1.8.1.mod": "module github.com/gorilla/mux\n\ngo 1.20\n",
    });
    const pkg = await new GoAdapter().extract(candidate("go", "github.com/gorilla/mux"), src, CTX);
    expect(pkg.withdrawals).toEqual([{ kind: "retracted", versionsInWindow: null, withdrawn: [] }]);

    expect(pkg.latestVersion).toBe("v1.8.1");
    expect(pkg.repositoryUrl).toBe("https://github.com/gorilla/mux");
    expect(pkg.versions).toHaveLength(1);
    expect(pkg.versions[0]!.quarterAnchor?.split(",")[0]).toBe("2024Q1");
    expect(sig(pkg, "v1.8.1", "transparency_log")!.value).toBe("true");
    expect(sig(pkg, "v1.8.1", "source_link")!.evidence).toContain("b4617d0b9670ad14039b2739167fd35a60f557c5");
    expect(sig(pkg, "v1.8.1", "registry_integrity")!.value).toBe("true");
    assertConsistentWithFacts(pkg);
  });

  test("retract directives: single versions, ranges, blocks and comments", () => {
    const gomod = [
      "module example.com/m",
      "",
      "retract v1.0.1 // published by mistake",
      "retract [v1.2.0, v1.2.3]",
      "retract (",
      "\tv1.5.0 // broken build",
      "\t[v2.0.0, v2.0.1]",
      ")",
    ].join("\n");
    expect(parseRetractions(gomod)).toEqual([
      { low: "v1.0.1", high: "v1.0.1" },
      { low: "v1.2.0", high: "v1.2.3" },
      { low: "v1.5.0", high: "v1.5.0" },
      { low: "v2.0.0", high: "v2.0.1" },
    ]);
    const tags = ["v1.0.0", "v1.0.1", "v1.2.0", "v1.2.2", "v1.2.4", "v1.5.0", "v2.0.1", "v2.1.0"];
    expect(retractedVersions(gomod, tags)).toEqual(["v1.0.1", "v1.2.0", "v1.2.2", "v1.5.0", "v2.0.1"]);
  });

  test("a module the proxy cannot serve is an error", async () => {
    const src = new FakeSource({
      "https://proxy.golang.org/example.com/gone/@v/list": { status: 410 },
      "https://proxy.golang.org/example.com/gone/@latest": { status: 410 },
    });
    await expect(new GoAdapter().extract(candidate("go", "example.com/gone"), src, CTX)).rejects.toThrow(/cannot serve/);
  });
});

describe("Maven extract", () => {
  const ga = "org.example:lib";
  const base = "https://repo1.maven.org/maven2/org/example/lib";
  const dates: Record<string, string> = {
    "1.0": "Thu, 01 Jun 2023 10:00:00 GMT",
    "1.1": "Thu, 01 Aug 2024 10:00:00 GMT",
    "2.0-alpha1": "Mon, 01 Sep 2025 10:00:00 GMT",
    "1.2": "Mon, 15 Sep 2025 10:00:00 GMT",
  };

  test("anchors come from Last-Modified; signatures from HEAD probes; latest is the newest stable", async () => {
    const routes: Record<string, Route> = {
      [`${base}/maven-metadata.xml`]: `<metadata><versioning><release>2.0-alpha1</release><versions>${Object.keys(dates).map((v) => `<version>${v}</version>`).join("")}</versions></versioning></metadata>`,
    };
    for (const [v, lm] of Object.entries(dates)) {
      routes[`HEAD ${pomUrl(ga, v)}`] = JSON.stringify({ "last-modified": lm });
      routes[`HEAD ${pomUrl(ga, v)}.asc`] = "{}";
      routes[`${pomUrl(ga, v)}.sigstore.json`] = v === "1.2" ? "{}" : { status: 404, body: "" };
      routes[`HEAD ${base}/${v}/lib-${v}.jar.build.slsa`] = v === "1.1" ? "{}" : { status: 404, body: "{}" };
    }
    const pkg = await new MavenAdapter().extract(candidate("maven", ga), new FakeSource(routes), CTX);

    expect(pkg.latestVersion).toBe("1.2");
    expect(pkg.versions.map((v) => [v.version, v.quarterAnchor])).toEqual([
      ["1.0", "2024Q1,2024Q2"],
      ["1.1", "2024Q3,2024Q4,2025Q1,2025Q2"],
      ["1.2", "2025Q3,2025Q4,2026Q1,2026Q2,2026Q3"],
    ]);
    expect(sig(pkg, "1.0", "artifact_signature")!.value).toBe("true");
    expect(sig(pkg, "1.0", "transparency_log")!.value).toBe("false");
    expect(sig(pkg, "1.2", "transparency_log")!.value).toBe("true");
    expect(sig(pkg, "1.1", "build_provenance")!.value).toBe("true");
    expect(sig(pkg, "1.1", "source_link")!.value).toBe("true");
    expect(sig(pkg, "1.0", "source_link")!.value).toBe("false");
    assertConsistentWithFacts(pkg);
  });
});

describe("Packagist extract", () => {
  test("branch aliases are not releases", async () => {
    const src = new FakeSource({ "https://packagist.org/packages/monolog/monolog.json": await fixture("packagist-monolog.json") });
    const pkg = await new PackagistAdapter().extract(candidate("packagist", "monolog/monolog"), src, CTX);
    // The trimmed fixture kept only dev branches.
    expect(pkg.versions).toHaveLength(0);
    expect(pkg.latestVersion).toBeNull();
    expect(pkg.repositoryUrl).toBe("https://github.com/Seldaek/monolog");
  });

  test("tagged releases carry no-mechanism signals", async () => {
    const doc = { package: { maintainers: [{}], repository: "https://github.com/php-fig/log", versions: {
      "dev-master": { time: "2026-01-01T00:00:00+00:00" },
      "3.0.2": { time: "2024-09-11T13:17:53+00:00", source: { url: "https://github.com/php-fig/log.git", reference: "f16e1d5863e37f8d8c2a01719f5b34baa2b714d3" } },
      "3.0.1": { time: "2024-08-21T13:31:24+00:00" },
      "3.0.0": { time: "2021-07-14T16:46:02+00:00" },
    } } };
    const src = new FakeSource({ "https://packagist.org/packages/psr/log.json": JSON.stringify(doc) });
    const pkg = await new PackagistAdapter().extract(candidate("packagist", "psr/log"), src, CTX);
    expect(pkg.latestVersion).toBe("3.0.2");
    expect(sig(pkg, "3.0.2", "source_link")!.evidence).toBe("https://github.com/php-fig/log.git@f16e1d5863e37f8d8c2a01719f5b34baa2b714d3");
    expect(sig(pkg, "3.0.0", "source_link")!.value).toBe("false");
    // 3.0.1 is superseded within its quarter, so it anchors nothing and is not kept.
    expect(pkg.versions.map((v) => v.version)).toEqual(["3.0.0", "3.0.2"]);
    assertConsistentWithFacts(pkg);
  });
});
