/**
 * Locks the M0 findings against real captured responses.
 *
 * These are not tests of our code — they are regression tests on the *registries*. Each
 * assertion is a claim docs/preflight.md makes about an API shape, and the adapters in
 * M2-M6 will be written against exactly these shapes. If a registry changes its response
 * format, this file fails and tells us which finding to re-verify, rather than the
 * extractor silently emitting `false` for a signal that moved.
 */

import { describe, expect, test } from "bun:test";

const F = "test/fixtures";
const load = async <T = any>(name: string): Promise<T> => JSON.parse(await Bun.file(`${F}/${name}`).text());

describe("fixture manifest", () => {
  test("records provenance for every fixture", async () => {
    const manifest = await load<any[]>("fixtures.json");
    expect(manifest.length).toBe(13);
    for (const m of manifest) {
      expect(m.source_url).toStartWith("https://");
      expect(m.http_status).toBe(200);
      expect(m.captured_at).toBeTruthy();
      expect(m.full_response_sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(m.why).toBeTruthy();
    }
  });
});

describe("PyPI — files[].provenance", () => {
  test("a trusted-publishing package carries a resolvable provenance URL", async () => {
    const d = await load("pypi-simple-sigstore.json");
    const withProv = d.files.filter((f: any) => f.provenance != null);
    expect(withProv.length).toBeGreaterThan(0);
    expect(withProv.at(-1).provenance).toStartWith("https://pypi.org/integrity/");
  });

  test("the negative case is an explicit null, not a missing key", async () => {
    const d = await load("pypi-simple-ruff.json");
    for (const f of d.files) {
      expect(f).toHaveProperty("provenance");
      expect(f.provenance).toBeNull();
    }
  });
});

describe("npm — dist.attestations", () => {
  const latest = (d: any) => d.versions[Object.keys(d.versions).at(-1)!];

  test("a --provenance publish carries a SLSA attestation bundle", async () => {
    const v = latest(await load("npm-packument-sigstore.json"));
    expect(v.dist.attestations.url).toContain("/-/npm/v1/attestations/");
    expect(v.dist.attestations.provenance.predicateType).toBe("https://slsa.dev/provenance/v1");
  });

  test("dist.signatures is present without attestations, so it is not the signal", async () => {
    const v = latest(await load("npm-packument-chalk.json"));
    expect(v.dist.signatures.length).toBeGreaterThan(0);
    expect(v.dist.attestations).toBeUndefined();
  });

  test("the time map the backfill depends on is present", async () => {
    const d = await load("npm-packument-sigstore.json");
    for (const v of Object.keys(d.versions)) expect(d.time[v]).toBeTruthy();
  });
});

describe("crates.io — trustpub_data", () => {
  test("a trusted-publishing crate exposes provider, repository and run", async () => {
    const v = (await load("crates-versions-bon.json")).versions[0];
    expect(v.trustpub_data).toMatchObject({ provider: "github", repository: "elastio/bon" });
    expect(v.trustpub_data.run_id).toBeTruthy();
    expect(v.trustpub_data.sha).toMatch(/^[0-9a-f]{40}$/);
  });

  test("a token-published crate exposes an explicit null", async () => {
    const v = (await load("crates-versions-serde.json")).versions[0];
    expect(v).toHaveProperty("trustpub_data");
    expect(v.trustpub_data).toBeNull();
  });
});

describe("RubyGems — the negative finding", () => {
  test("Ruby Central's own trusted-publishing gem exposes no trusted-publishing field", async () => {
    const versions = await load<any[]>("rubygems-versions-trusted-publishing-test.json");
    const keys = new Set(versions.flatMap((v) => Object.keys(v)));
    const metaKeys = new Set(versions.flatMap((v) => Object.keys(v.metadata ?? {})));
    for (const k of [...keys, ...metaKeys]) {
      expect(k.toLowerCase()).not.toContain("trusted");
      expect(k.toLowerCase()).not.toContain("trustpub");
      expect(k.toLowerCase()).not.toContain("attestation");
    }
  });

  test("rubygems_mfa_required is available per version, so MFA is backfillable", async () => {
    const versions = await load<any[]>("rubygems-versions-rails.json");
    expect(versions.length).toBeGreaterThan(1);
    for (const v of versions) {
      expect(v.metadata.rubygems_mfa_required).toBe("true");
      expect(v.created_at).toBeTruthy();
    }
  });
});

describe("Go — proxy origin and transparency log", () => {
  test("the proxy reports the source VCS ref and commit", async () => {
    const d = await load("go-latest-gorilla-mux.json");
    expect(d.Origin.VCS).toBe("git");
    expect(d.Origin.Ref).toBe("refs/tags/v1.8.1");
    expect(d.Origin.Hash).toMatch(/^[0-9a-f]{40}$/);
    expect(d.Time).toBeTruthy();
  });

  test("the sumdb lookup returns a module line and a signed tree head", async () => {
    const txt = await Bun.file(`${F}/go-sumdb-gorilla-mux.txt`).text();
    expect(txt).toContain("github.com/gorilla/mux v1.8.1 h1:");
    expect(txt).toContain("go.sum database tree");
  });
});

describe("Maven Central — ec cannot detect GPG", () => {
  const ec = (d: any) => d.response.docs[0].ec as string[];

  test("Sigstore bundles ARE discoverable via ec", async () => {
    expect(ec(await load("maven-gav-sigstore.json"))).toContain(".jar.sigstore.json");
  });

  test("an unsigned-by-Sigstore artifact omits the bundle", async () => {
    expect(ec(await load("maven-gav-guava.json"))).not.toContain(".jar.sigstore.json");
  });

  /**
   * The trap that would have produced a false "Maven has no GPG signing" result:
   * guava's .jar.asc returns HTTP 200, but no bare .asc entry appears in either fixture.
   */
  test("neither publisher lists a bare .jar.asc, so GPG needs a HEAD request", async () => {
    for (const f of ["maven-gav-sigstore.json", "maven-gav-guava.json"]) {
      expect(ec(await load(f))).not.toContain(".jar.asc");
    }
    // Sigstore's artifact lists checksums *of* the signature but never the signature.
    expect(ec(await load("maven-gav-sigstore.json"))).toContain(".jar.asc.sha256");
    expect(ec(await load("maven-gav-guava.json")).filter((e) => e.includes(".asc"))).toHaveLength(0);
  });
});

describe("Packagist — no mechanism exists", () => {
  test("version objects carry no signing or attestation field of any kind", async () => {
    const d = await load("packagist-monolog.json");
    const versions = Object.values<any>(d.package.versions);
    expect(versions.length).toBeGreaterThan(0);
    for (const v of versions) {
      const keys = [...Object.keys(v), ...Object.keys(v.dist ?? {})].map((k) => k.toLowerCase());
      for (const k of keys) {
        expect(k).not.toContain("signature");
        expect(k).not.toContain("attestation");
        expect(k).not.toContain("provenance");
      }
    }
  });

  test("downloads and maintainers are available for ranking and baseline metadata", async () => {
    const d = await load("packagist-monolog.json");
    expect(d.package.downloads.monthly).toBeGreaterThan(0);
    expect(Array.isArray(d.package.maintainers)).toBe(true);
  });
});
