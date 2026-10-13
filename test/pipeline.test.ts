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
const { packages, packageVersions, versionSignals, signalAvailability } = await import("../src/db/schema.ts");
const { runRank } = await import("../src/stages/rank.ts");
const { runFetch } = await import("../src/stages/fetch.ts");
const { runExtract } = await import("../src/stages/extract.ts");
const { runAggregate } = await import("../src/stages/aggregate.ts");
const { runReport } = await import("../src/stages/report.ts");
const { simpleUrl, jsonUrl } = await import("../src/adapters/pypi.ts");
import { eq, isNotNull } from "drizzle-orm";
import type { Transport, TransportResponse } from "../src/http/transport.ts";

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
};

const transport: Transport = {
  name: "mock",
  async request(url): Promise<TransportResponse> {
    const body = ROUTES[url];
    return body === undefined ? { status: 404, body: "", headers: new Map() } : { status: 200, body, headers: new Map() };
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
    expect(latest.every((v) => /^[0-9a-f]{64}$/.test(v.rawSha256 ?? ""))).toBe(true);
    expect(db.select().from(signalAvailability).all()).toHaveLength(49);

    const { aggregate } = await runAggregate(db, "snap-e2e");
    const cell = aggregate.matrix.find((c) => c.ecosystem === "pypi" && c.signal === "artifact_signature")!;
    expect(cell).toMatchObject({ n: 2, t: 1, f: 1, u: 0, pct: 0.5 });
    // A publish attestation is not SLSA provenance.
    expect(aggregate.matrix.find((c) => c.signal === "build_provenance")).toMatchObject({ t: 0, f: 2 });

    // attested@2.0: identity, signature, tlog, MFA (post-mandate) = 4 of 7.
    // plain@0.9 (2022): nothing true; identity and MFA unknown = 0 to 2 of 7.
    const score = aggregate.scores.find((s) => s.ecosystem === "pypi")!;
    expect(score).toMatchObject({ offered: 6, auditable: 6, total: 7, n: 2 });
    expect(score.assuranceLow).toBeCloseTo(2 / 7, 6);
    expect(score.assuranceHigh).toBeCloseTo(3 / 7, 6);
    const identity = aggregate.matrix.find((c) => c.signal === "identity_publish")!;
    expect(identity).toMatchObject({ availability: "inferred", t: 1, u: 1 });

    // Before the attested release existed, neither package had provenance.
    const q1 = aggregate.series.find((p) => p.quarter === "2024Q1" && p.signal === "artifact_signature")!;
    expect(q1).toMatchObject({ n: 2, t: 0 });
    expect(aggregate.coverage[0]).toMatchObject({ sampled: 2, fetched: 2, extracted: 2, extractErrors: 0 });

    const { dir, files } = await runReport(db, "snap-e2e");
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
    expect(summary).toMatch(/\| \*\*PyPI\*\* \| 6\/7 \| 6\/7 \| 29%–43% \|/);
    expect(await Bun.file(join(dir, "charts/scores.svg")).text()).toContain("Trust summary per platform");
    // Charts name the snapshot by a readable instant, never by its id.
    const scoresChart = await Bun.file(join(dir, "charts/scores.svg")).text();
    expect(scoresChart).toMatch(/snapshot \d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} UTC/);
    expect(scoresChart).not.toContain("snap-e2e");
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
    const csv = await Bun.file(join(dir, "signals.csv")).text();
    expect(csv.split("\n")[0]).toStartWith("ecosystem,package,version");
    expect(await Bun.file(join(dir, "charts/adoption-build_provenance.svg")).text()).toStartWith("<svg");
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
