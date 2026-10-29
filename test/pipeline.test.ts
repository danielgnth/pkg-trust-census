/**
 * The five stages end to end against a mocked network: rank → fetch → extract →
 * aggregate → report, then the properties that make the pipeline safe to re-run.
 */

import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TMP = mkdtempSync(join(tmpdir(), "pkg-trust-pipeline-"));
process.env.PKG_TRUST_DATA_DIR = TMP;

const { HttpClient } = await import("../src/http/client.ts");
const { ResponseCache } = await import("../src/http/cache.ts");
const { openDb, closeDb } = await import("../src/db/open.ts");
const { packages, packageVersions, sampleMembers, versionSignals, signalAvailability, advisoryMatches } = await import("../src/db/schema.ts");
const { RankIncompleteError, runRank } = await import("../src/stages/rank.ts");
const { runFetch } = await import("../src/stages/fetch.ts");
const { runExtract } = await import("../src/stages/extract.ts");
const { runAggregate } = await import("../src/stages/aggregate.ts");
const { runLayersReport, runReport } = await import("../src/stages/report.ts");
const { simpleUrl, jsonUrl } = await import("../src/adapters/pypi.ts");
import { eq, isNotNull } from "drizzle-orm";
import * as CDX from "@cyclonedx/cyclonedx-library";
import type { Transport } from "../src/http/transport.ts";

afterAll(() => rmSync(TMP, { recursive: true, force: true }));
beforeEach(() => rmSync(join(TMP, "cache"), { recursive: true, force: true }));

const RANKING_URL = "https://raw.githubusercontent.com/hugovk/top-pypi-packages/main/top-pypi-packages.json";

const file = (name: string, uploaded: string, provenance: string | null) => ({
  filename: name,
  "upload-time": uploaded,
  provenance,
  yanked: false,
});

const ROUTES: Record<string, string> = {
  [RANKING_URL]: JSON.stringify({
    rows: [
      { project: "attested", download_count: 900 },
      { project: "plain", download_count: 500 },
    ],
  }),
  [simpleUrl("attested")]: JSON.stringify({
    name: "attested",
    versions: ["1.0", "2.0"],
    files: [
      file("attested-1.0.tar.gz", "2023-06-01T00:00:00Z", null),
      file("attested-2.0.tar.gz", "2025-02-01T00:00:00Z", "https://pypi.org/integrity/attested/2.0/attested-2.0.tar.gz/provenance"),
    ],
  }),
  [jsonUrl("attested")]: JSON.stringify({ info: { version: "2.0" } }),
  // A publish attestation without a certificate: signed, but no SLSA and no source link.
  "https://pypi.org/integrity/attested/2.0/attested-2.0.tar.gz/provenance": JSON.stringify({
    version: 1,
    attestation_bundles: [{
      publisher: { kind: "GitHub", repository: "o/attested", workflow: "release.yml" },
      attestations: [{ envelope: { statement: Buffer.from(JSON.stringify({ predicateType: "https://docs.pypi.org/attestations/publish/v1" })).toString("base64") } }],
    }],
  }),
  [simpleUrl("plain")]: JSON.stringify({
    name: "plain",
    versions: ["0.9"],
    files: [file("plain-0.9.tar.gz", "2022-01-01T00:00:00Z", null)],
  }),
  [jsonUrl("plain")]: JSON.stringify({ info: { version: "0.9" } }),
  // The random draw's name list, and two packages only it can draw: one active, one not.
  "https://pypi.org/simple/": JSON.stringify({ projects: ["attested", "plain", "Fresh_Pkg", "ancient"].map((name) => ({ name })) }),
  [simpleUrl("fresh-pkg")]: JSON.stringify({ name: "fresh-pkg", versions: ["3.0"], files: [file("fresh_pkg-3.0.tar.gz", "2026-03-01T00:00:00Z", null)] }),
  [jsonUrl("fresh-pkg")]: JSON.stringify({ info: { version: "3.0" } }),
  [simpleUrl("ancient")]: JSON.stringify({ name: "ancient", versions: ["0.1"], files: [file("ancient-0.1.tar.gz", "2015-01-01T00:00:00Z", null)] }),
};

/**
 * OSV: attested 1.0 has one vulnerability under two ids (GHSA first, PYSEC three months later);
 * plain 0.9 has a malware report published long after its release.
 */
const OSV_MATCHES: Record<string, string[]> = {
  "attested@1.0": ["GHSA-aaaa-bbbb-cccc", "PYSEC-2025-1"],
  "plain@0.9": ["MAL-2025-7"],
};
const OSV_RECORDS: Record<string, object> = {
  "GHSA-aaaa-bbbb-cccc": { id: "GHSA-aaaa-bbbb-cccc", aliases: ["CVE-2025-0001", "PYSEC-2025-1"], published: "2025-03-01T00:00:00Z", modified: "2025-03-02T00:00:00Z", summary: "A flaw" },
  "PYSEC-2025-1": { id: "PYSEC-2025-1", aliases: ["CVE-2025-0001", "GHSA-aaaa-bbbb-cccc"], published: "2025-06-01T00:00:00Z", modified: "2025-06-01T00:00:00Z" },
  "MAL-2025-7": { id: "MAL-2025-7", published: "2025-06-01T00:00:00Z", modified: "2025-06-01T00:00:00Z", summary: "Malicious code in plain (PyPI)" },
};

const transport: Transport = {
  name: "mock",
  async fetch(req) {
    if (req.method === "POST" && req.url === "https://api.osv.dev/v1/querybatch") {
      const { queries } = (await req.json()) as { queries: Array<{ package: { name: string }; version: string }> };
      return Response.json({ results: queries.map((q) => ({ vulns: (OSV_MATCHES[`${q.package.name}@${q.version}`] ?? []).map((id) => ({ id, modified: "2025-06-01T00:00:00Z" })) })) });
    }
    const record = OSV_RECORDS[decodeURIComponent(req.url.replace("https://api.osv.dev/v1/vulns/", ""))];
    if (record) return Response.json(record);
    const body = ROUTES[req.url];
    return body === undefined ? new Response(null, { status: 404 }) : new Response(body);
  },
};

async function pipeline(snapshotId: string) {
  const db = openDb(":memory:");
  const http = new HttpClient({ transport, cache: new ResponseCache() });
  await runRank(["pypi"], 2, snapshotId, db, http);
  await runFetch(["pypi"], snapshotId, db, http);
  await http.flush();
  const [extract] = await runExtract(["pypi"], snapshotId, db, new ResponseCache());
  return { db, extract: extract! };
}

describe("pipeline", () => {
  test("produces versions, signals, aggregate and report files", async () => {
    const { db, extract } = await pipeline("snap-e2e");
    expect(extract).toMatchObject({ packages: 2, extracted: 2, failed: 0 });

    const latest = db.select().from(packageVersions).where(eq(packageVersions.isLatest, true)).all();
    expect(latest.map((v) => [v.packageName, v.version]).sort()).toEqual([["attested", "2.0"], ["plain", "0.9"]]);
    // SLSA is read from the provenance object, not from the index that lists it.
    const slsa = db.select().from(versionSignals).where(eq(versionSignals.signalId, "build_provenance")).all();
    expect(slsa.find((s) => s.packageName === "attested" && s.version === "2.0")!.responses.map((r) => r.url)).toEqual([
      "https://pypi.org/integrity/attested/2.0/attested-2.0.tar.gz/provenance",
    ]);
    expect(slsa.find((s) => s.packageName === "plain")!.responses.map((r) => r.url)).toEqual([simpleUrl("plain")]);
    expect(db.select().from(signalAvailability).all()).toHaveLength(49);

    const { aggregate } = await runAggregate(db, "snap-e2e");
    const cell = aggregate.matrix.find((c) => c.ecosystem === "pypi" && c.signal === "artifact_signature")!;
    expect(cell).toMatchObject({ n: 2, t: 1, f: 1, u: 0, pct: 0.5 });
    // A publish attestation is not SLSA provenance.
    expect(aggregate.matrix.find((c) => c.signal === "build_provenance")).toMatchObject({ t: 0, f: 2 });

    // attested@2.0: publisher auth 1 (identity), authenticity 1 (signature), source 0 = 2 of 3.
    // plain@0.9 (2022): nothing true; identity unknown = 0 of 3, up to 1 of 3.
    // PyPI offers identity, signature and SLSA, so every category is fully offered.
    const score = aggregate.scores.find((s) => s.ecosystem === "pypi")!;
    expect(score).toMatchObject({ capability: 1, auditable: 1, n: 2 });
    expect(score.assuranceLow).toBeCloseTo(1 / 3, 6);
    expect(score.assuranceHigh).toBeCloseTo(1 / 2, 6);
    expect(score.categories.map((c) => [c.category, c.assuranceLow, c.assuranceHigh])).toEqual([
      ["publisher_auth", 0.5, 1],
      ["artifact_authenticity", 0.5, 0.5],
      ["source_provenance", 0, 0],
    ]);
    const identity = aggregate.matrix.find((c) => c.signal === "identity_publish")!;
    expect(identity).toMatchObject({ availability: "inferred", t: 1, u: 1 });

    // Before the attested release existed, neither package had provenance.
    const q1 = aggregate.series.find((p) => p.quarter === "2024Q1" && p.signal === "artifact_signature")!;
    expect(q1).toMatchObject({ n: 2, t: 0 });
    expect(aggregate.coverage[0]).toMatchObject({ sampled: 2, fetched: 2, extracted: 2, extractErrors: 0 });

    // Advisories: one vulnerability under two ids, unknown at 2024Q1, known now; one malware report.
    expect(db.select().from(advisoryMatches).all().map((m) => `${m.packageName}@${m.version} ${m.advisoryId}`).sort()).toEqual([
      "attested@1.0 GHSA-aaaa-bbbb-cccc",
      "attested@1.0 PYSEC-2025-1",
      "plain@0.9 MAL-2025-7",
    ]);
    expect(db.select({ purl: packageVersions.purl }).from(packageVersions).where(eq(packageVersions.version, "2.0")).get()!.purl).toBe("pkg:pypi/attested@2.0");
    const adv = aggregate.advisories;
    expect(adv.exposure).toEqual([{ ecosystem: "pypi", checked: 2, affected: 1, malicious: 1, vulnerabilities: 1 }]);
    expect(adv.series.find((p) => p.quarter === "2024Q1")).toEqual({ quarter: "2024Q1", ecosystem: "pypi", n: 2, knownThen: 0, knownNow: 2 });
    expect(adv.databases).toEqual([
      { ecosystem: "pypi", database: "GHSA", vulnerabilities: 1, first: 1, medianLagDays: null },
      { ecosystem: "pypi", database: "MAL", vulnerabilities: 1, first: 1, medianLagDays: null },
      { ecosystem: "pypi", database: "PYSEC", vulnerabilities: 1, first: 0, medianLagDays: 92 },
    ]);
    expect(adv.malicious).toMatchObject([{ package: "plain", version: "0.9", advisory: "MAL-2025-7", releasedAt: "2022-01-01T00:00:00.000Z", reportedAt: "2025-06-01T00:00:00.000Z", withdrawn: [] }]);

    const { dir, files } = await runReport(db, "snap-e2e");
    const sbomText = await Bun.file(join(dir, "sbom.cdx.json")).text();
    expect(await new CDX.Validation.JsonStrictValidator(CDX.Spec.Version.v1dot6).validate(sbomText)).toBeNull();
    const sbom = JSON.parse(sbomText);
    expect(sbom).toMatchObject({ bomFormat: "CycloneDX", specVersion: "1.6" });
    expect(sbom.components.map((c: { purl: string }) => c.purl)).toEqual(["pkg:pypi/attested@2.0", "pkg:pypi/plain@0.9"]);
    expect(sbom.vulnerabilities).toMatchObject([{ id: "MAL-2025-7", affects: [{ ref: "pkg:pypi/plain@0.9" }] }]);
    const advisoriesMd = await Bun.file(join(dir, "advisories.md")).text();
    expect(advisoriesMd).toContain("| **PyPI** | 50% (1/2) | 1 | 1 | 0% → 100% (n=2) |");
    expect(advisoriesMd).toContain("#### Method and sources");
    expect((await Bun.file(join(dir, "advisories.csv")).text()).split("\n")).toHaveLength(5);
    expect(await Bun.file(join(dir, "charts/advisories.svg")).text()).toContain("Known vulnerabilities in sampled releases (OSV)");
    expect(files).toContain("charts/matrix.svg");
    const matrix = await Bun.file(join(dir, "matrix.md")).text();
    expect(matrix).toContain("≥ 50% (1/2)");
    expect(matrix).toContain("Inferred cells");
    const summary = await Bun.file(join(dir, "summary.md")).text();
    expect(summary).toContain("error rate 0.0%");
    expect(summary).toContain("Trust summary per platform");
    expect(summary).toContain("Registry baseline");
    expect(summary).toMatch(/\| \*\*PyPI\*\* \| ✓ yes \(since 2026-07\) \| ✓ yes \|/);
    const baseline = await Bun.file(join(dir, "baseline.md")).text();
    expect(baseline).toContain("#### Notes and sources");
    expect(baseline).toContain("https://blog.pypi.org/posts/2026-07-22-releases-now-reject-new-files-after-14-days/");
    expect(summary).toMatch(/\| \*\*PyPI\*\* \| 3\/3 \| 3\/3 \| 33%–50% \| [^|]+ \| 50%–100% \| 50% \| 0% \|/);
    const signalsCsv = await Bun.file(join(dir, "signals.csv")).text();
    expect(signalsCsv.split("\n")[0]).toEndWith("signal_source,response_urls,response_sha256s");
    expect(await Bun.file(join(dir, "charts/scores.svg")).text()).toContain("Trust summary per platform");
    // Charts name the snapshot by a readable instant, never by its id.
    const scoresChart = await Bun.file(join(dir, "charts/scores.svg")).text();
    expect(scoresChart).toMatch(/snapshot \d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} UTC/);
    expect(scoresChart).not.toContain("snap-e2e");
    // The chart prints its own arithmetic: attested is strong, plain's identity is unknown.
    expect(scoresChart).toContain("(1 × 1 + 0 × ½) ÷ 2 · 1 unknown");
    expect(scoresChart).toContain("(50 + 50 + 0) ÷ 3");
    const baselineChart = await Bun.file(join(dir, "charts/baseline.svg")).text();
    expect(baselineChart).toContain("Registry baseline");
    expect(baselineChart).toContain("since Jul 2026");
    expect(baselineChart).toContain(">PyPI</text>");
    const sigstore = await Bun.file(join(dir, "sigstore.md")).text();
    expect(sigstore).toContain("#### What is signed, and sources");
    expect(summary).toContain("Sigstore across registries");
    expect(sigstore).toContain("#### Install clients");
    const sigstoreChart = await Bun.file(join(dir, "charts/sigstore.svg")).text();
    expect(sigstoreChart).toContain("Sigstore across registries");
    expect(sigstoreChart).toContain("since Nov 2024");
    expect(summary).toContain("How the latest releases were published");
    expect(summary).toContain("Registry governance and containment");
    expect(summary).toContain("Withdrawn versions since");
    // Every chart must be well-formed XML: a bare "<" in a label breaks the whole file.
    for (const f of files.filter((n) => n.endsWith(".svg"))) {
      const body = await Bun.file(join(dir, f)).text();
      expect([f, /<(?![a-zA-Z/!?])/.test(body)]).toEqual([f, false]);
    }
    expect(await Bun.file(join(dir, "charts/withdrawals.svg")).text()).toContain("how often containment is used");
    expect((await Bun.file(join(dir, "withdrawals.csv")).text()).split("\n")[0]).toBe("ecosystem,package,kind,versions_in_window,withdrawn_count,withdrawn_versions");
    const policiesChart = await Bun.file(join(dir, "charts/policies.svg")).text();
    expect(policiesChart).toContain("Governance: keeping malicious packages out");
    expect(await Bun.file(join(dir, "policies.md")).text()).toContain("#### Notes and sources");
    expect(await Bun.file(join(dir, "charts/publish-auth.svg")).text()).toContain("account credential");
    const pqcChart = await Bun.file(join(dir, "charts/pqc.svg")).text();
    expect(pqcChart).toContain("Post-quantum exposure");
    expect(pqcChart).toContain("X25519MLKEM768");
    expect(await Bun.file(join(dir, "pqc.md")).text()).toContain("#### Notes and sources");
    expect(summary).toContain("Post-quantum exposure");
    const csv = await Bun.file(join(dir, "signals.csv")).text();
    expect(csv.split("\n")[0]).toStartWith("ecosystem,package,version");
    expect(await Bun.file(join(dir, "charts/adoption-build_provenance.svg")).text()).toStartWith("<svg");
    closeDb(db);
  });

  test("one registry failing does not stop the others, and a re-run keeps every sample made the same way", async () => {
    const db = openDb(":memory:");
    // npm's registry is down; PyPI answers.
    const npmDown: Transport = { name: "mock", fetch: (req) => (new URL(req.url).host.includes("npmjs") ? Promise.reject(new Error("connection reset")) : transport.fetch(req)) };
    const http = new HttpClient({ transport: npmDown, cache: new ResponseCache(), maxRetries: 0 });
    const err = await runRank(["npm", "pypi"], 2, "snap-rerank", db, http).catch((e) => e);
    expect(err).toBeInstanceOf(RankIncompleteError);
    expect(err.failures).toMatchObject([{ ecosystem: "npm" }]);
    expect(err.results).toMatchObject([{ ecosystem: "pypi", layer: "top", count: 2 }]);
    await runRank(["pypi"], 5, "snap-rerank", db, http, undefined, { layer: "random", seed: "fixed" });

    // Run again without a network: both PyPI samples are kept, not ranked or drawn again.
    const offline = new HttpClient({ cache: new ResponseCache(), transport: { name: "none", fetch: () => Promise.reject(new Error("no network")) }, maxRetries: 0 });
    const [top] = await runRank(["pypi"], 2, "snap-rerank", db, offline);
    const [random] = await runRank(["pypi"], 5, "snap-rerank", db, offline, undefined, { layer: "random", seed: "fixed" });
    expect(top).toMatchObject({ count: 2, reused: true });
    expect(random).toMatchObject({ count: 2, reused: true });
    expect(db.select().from(sampleMembers).all()).toHaveLength(4);

    // Another seed, another size or --fresh makes the sample again.
    const redraw = await runRank(["pypi"], 5, "snap-rerank", db, offline, undefined, { layer: "random", seed: "other" }).catch((e) => e);
    expect(redraw).toBeInstanceOf(RankIncompleteError);
    const [smaller] = await runRank(["pypi"], 1, "snap-rerank", db, http);
    expect(smaller).toMatchObject({ count: 1 });
    expect(smaller!.reused).toBeUndefined();
    const [fresh] = await runRank(["pypi"], 1, "snap-rerank", db, http, undefined, { fresh: true });
    expect(fresh!.reused).toBeUndefined();
    closeDb(db);
  });

  test("a random layer is drawn from active packages, measured once with the top layer, and compared", async () => {
    const db = openDb(":memory:");
    const http = new HttpClient({ transport, cache: new ResponseCache() });
    await runRank(["pypi"], 2, "snap-layers", db, http);
    const [drawn] = await runRank(["pypi"], 5, "snap-layers", db, http, undefined, { layer: "random", seed: "fixed" });
    // plain (2022) and ancient (2015) have no release in the 36 months before the snapshot.
    expect(drawn).toMatchObject({ layer: "random", count: 2 });
    const random = db.select().from(sampleMembers).where(eq(sampleMembers.layer, "random")).all();
    expect(random.map((m) => m.packageName).sort()).toEqual(["attested", "fresh-pkg"]);
    expect(random.every((m) => m.rankFrame === "random" && m.downloadCount === null)).toBe(true);
    // attested is in both samples but one package row.
    expect(db.select().from(packages).all().map((p) => p.packageName).sort()).toEqual(["attested", "fresh-pkg", "plain"]);

    await runFetch(["pypi"], "snap-layers", db, http);
    await http.flush();
    const [extract] = await runExtract(["pypi"], "snap-layers", db, new ResponseCache());
    expect(extract).toMatchObject({ packages: 3, extracted: 3 });

    const { aggregate: top } = await runAggregate(db, "snap-layers", "top");
    const { aggregate: rand } = await runAggregate(db, "snap-layers", "random");
    expect(top.matrix.find((c) => c.signal === "artifact_signature")).toMatchObject({ n: 2, t: 1 });
    expect(rand).toMatchObject({ layer: "random" });
    expect(rand.matrix.find((c) => c.signal === "artifact_signature")).toMatchObject({ n: 2, t: 1, pct: 0.5 });
    expect(rand.coverage).toMatchObject([{ rankFrame: "random", sampled: 2, extracted: 2 }]);

    await runReport(db, "snap-layers", "top");
    const { dir } = await runReport(db, "snap-layers", "random");
    expect(dir).toEndWith(join("snap-layers", "random"));
    expect(await Bun.file(join(dir, "README.md")).text()).toContain("random active packages");
    expect((await Bun.file(join(dir, "packages.csv")).text()).split("\n").filter(Boolean)).toHaveLength(3);
    const compared = await runLayersReport(db, "snap-layers");
    const layers = await Bun.file(join(compared!.dir, "layers.md")).text();
    expect(layers).toContain("| Publisher signature | PyPI | 50% [9–91%] (n=2) | 50% [9–91%] (n=2) |");
    expect(layers).toContain("| PyPI | 2 | 2 | 1 |");
    expect(layers).toMatch(/\| PyPI \| every project in the Simple API root \(PEP 691 JSON\) \| 4 \| [34] \| 0 \| 2 \|/);
    expect(layers).toContain("## Method and sources");
    const draw = JSON.parse(await Bun.file(join(compared!.dir, "random", "draw.json")).text());
    expect(draw.draws[0]).toMatchObject({ ecosystem: "pypi", seed: "fixed", listed: 4, accepted: 2 });
    expect(draw.draws[0].files[0]).toMatchObject({ url: "https://pypi.org/simple/" });
    expect(draw.draws[0].files[0].path).toBeUndefined();
    expect(await Bun.file(join(compared!.dir, "README.md")).text()).toContain("[compared](layers.md)");
    closeDb(db);
  });

  test("re-running extract replaces rows rather than accumulating them", async () => {
    const { db } = await pipeline("snap-rerun");
    const before = db.select().from(versionSignals).all().length;
    await runExtract(["pypi"], "snap-rerun", db, new ResponseCache());
    expect(db.select().from(versionSignals).all().length).toBe(before);
    closeDb(db);
  });

  test("a package missing from the cache is recorded as an extract error, not dropped", async () => {
    const { db } = await pipeline("snap-miss");
    rmSync(join(TMP, "cache"), { recursive: true, force: true });
    const [summary] = await runExtract(["pypi"], "snap-miss", db, new ResponseCache());
    expect(summary).toMatchObject({ extracted: 0, failed: 2 });

    const errors = db.select({ err: packages.extractError }).from(packages).where(isNotNull(packages.extractError)).all();
    expect(errors).toHaveLength(2);
    expect(errors[0]!.err).toContain("run `fetch` first");
    expect(db.select().from(packageVersions).all()).toHaveLength(0);
    closeDb(db);
  });

  test("extract never touches the network", async () => {
    const { db } = await pipeline("snap-offline");
    const original = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error("network used during extract");
    }) as unknown as typeof fetch;
    try {
      const [summary] = await runExtract(["pypi"], "snap-offline", db, new ResponseCache());
      expect(summary!.failed).toBe(0);
    } finally {
      globalThis.fetch = original;
      closeDb(db);
    }
  });
});
