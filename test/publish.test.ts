/**
 * Publishing the cache: redaction keeps what the signals read and removes what names people,
 * and the publish stage refuses to pack a cache whose redacted copy would change a signal.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TMP = mkdtempSync(join(tmpdir(), "pkg-trust-publish-"));
process.env.PKG_TRUST_DATA_DIR = TMP;

const { isPersonalEmail, placeholder, redactBody, redactEmails, residue, PLACEHOLDER_EMAIL } = await import("../src/publish/redact.ts");
const { ALL_PERSONAL_DATA, runPublish } = await import("../src/publish/publish.ts");
const { pusherOf } = await import("../src/adapters/rubygems.ts");
const { HttpClient } = await import("../src/http/client.ts");
const { ResponseCache } = await import("../src/http/cache.ts");
const { openDb, closeDb } = await import("../src/db/open.ts");
const { runRank } = await import("../src/stages/rank.ts");
const { runFetch } = await import("../src/stages/fetch.ts");
const { runExtract } = await import("../src/stages/extract.ts");
const { requestSummary } = await import("../src/report/requests.ts");
const { simpleUrl, jsonUrl } = await import("../src/adapters/pypi.ts");
import type { Transport } from "../src/http/transport.ts";

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

const fixture = (name: string) => Bun.file(`test/fixtures/${name}`).text();

describe("email addresses", () => {
  test("technical look-alikes are not personal", () => {
    expect(isPersonalEmail("jane.doe@example.org")).toBe(false);
    expect(isPersonalEmail("git@github.com")).toBe(false);
    expect(isPersonalEmail("49699333+dependabot[bot]@users.noreply.github.com")).toBe(false);
    expect(isPersonalEmail("repo@v3.1.0.rc")).toBe(false);
    expect(isPersonalEmail("jane@corp.dev")).toBe(true);
  });

  test("are replaced wherever they appear in text", () => {
    expect(redactEmails("Contact jane@corp.dev or git@github.com:o/r.git")).toBe(`Contact ${PLACEHOLDER_EMAIL} or git@github.com:o/r.git`);
  });
});

describe("placeholders keep the shape the signals read", () => {
  test("arrays keep their length, objects their keys, kept keys their values", () => {
    expect(placeholder([{ name: "a", email: "a@b.cd", id: 7 }, { name: "b" }])).toEqual([
      { name: "redacted", email: PLACEHOLDER_EMAIL, id: 0 },
      { name: "redacted" },
    ]);
    expect(placeholder({ name: "x", trustedPublisher: { id: "github" } }, new Set(["trustedPublisher"]))).toEqual({ name: "redacted", trustedPublisher: { id: "github" } });
  });

  test("npm: _npmUser keeps trustedPublisher, maintainers keep their count, the star list is emptied", async () => {
    const url = "https://registry.npmjs.org/sigstore";
    const original = JSON.parse(await fixture("npm-packument-sigstore.json"));
    original.users = { someone: true };
    const out = JSON.parse(redactBody(url, JSON.stringify(original), ALL_PERSONAL_DATA));
    for (const [v, m] of Object.entries<any>(original.versions)) {
      expect(out.versions[v]._npmUser.trustedPublisher).toEqual(m._npmUser.trustedPublisher);
      expect(out.versions[v].maintainers).toHaveLength(m.maintainers.length);
      expect(out.versions[v].maintainers.every((x: { name: string }) => x.name === "redacted")).toBe(true);
    }
    expect(out.users).toEqual({});
    expect(out.versions["4.0.0"].dist).toEqual(original.versions["4.0.0"].dist);
    expect(residue(url, JSON.stringify(out), ALL_PERSONAL_DATA)).toEqual([]);
    expect(residue(url, JSON.stringify(original), ALL_PERSONAL_DATA).length).toBeGreaterThan(0);
  });

  test("RubyGems pages: the pusher reads the same, profiles and authors do not", async () => {
    for (const v of ["4.0.0", "7.0.0", "8.1.3.1"]) {
      const url = `https://rubygems.org/gems/rails/versions/${v}`;
      const html = await fixture(`rubygems-page-rails-${v}.html`);
      const redacted = redactBody(url, html, ALL_PERSONAL_DATA);
      expect(pusherOf(redacted)).toEqual(pusherOf(html));
      expect(residue(url, redacted, ALL_PERSONAL_DATA)).toEqual([]);
    }
    const page = '<h3>Pushed by</h3><div><a title="jane" href="/profiles/jane"><img src="/users/12/avatar.jpeg" /><span>jane</span></a></div><h3>Authors</h3>\n<p class="x">Jane Doe</p>';
    const url = "https://rubygems.org/gems/x/versions/1.0";
    expect(residue(url, page, ALL_PERSONAL_DATA)).toHaveLength(3);
    const out = redactBody(url, page, ALL_PERSONAL_DATA);
    expect(out).not.toContain("jane");
    expect(out).not.toContain("Jane Doe");
    expect(pusherOf(out)).toEqual({ kind: "user" });
  });

  test("a certificate naming a person is blanked; a CI certificate is kept", () => {
    const der = (identity: string) => Buffer.from(`${"0\u0082".repeat(100)}${identity}${"\u0000".repeat(60)}`, "latin1").toString("base64");
    const bundle = (identity: string) => JSON.stringify({ verificationMaterial: { certificate: { rawBytes: der(identity) } } });
    const url = "https://repo1.maven.org/maven2/a/b/1/b-1.pom.sigstore.json";
    expect(JSON.parse(redactBody(url, bundle("jane@corp.dev"), ALL_PERSONAL_DATA)).verificationMaterial.certificate.rawBytes).toBe("");
    const ci = bundle("https://github.com/o/r/.github/workflows/release.yml@refs/tags/v1");
    expect(JSON.parse(redactBody(url, ci, ALL_PERSONAL_DATA))).toEqual(JSON.parse(ci));
  });
});

const file = (name: string, uploaded: string, provenance: string | null) => ({ filename: name, "upload-time": uploaded, provenance, yanked: false });
const ROUTES: Record<string, string> = {
  "https://raw.githubusercontent.com/hugovk/top-pypi-packages/main/top-pypi-packages.json": JSON.stringify({ rows: [{ project: "named", download_count: 9 }] }),
  [simpleUrl("named")]: JSON.stringify({ name: "named", versions: ["1.0"], files: [file("named-1.0.tar.gz", "2025-02-01T00:00:00Z", null)] }),
  [jsonUrl("named")]: JSON.stringify({ info: { version: "1.0", author: "Jane Doe", author_email: "jane@corp.dev", project_urls: { Source: "https://github.com/o/named" } } }),
};
const transport: Transport = {
  name: "mock",
  async fetch(req) {
    if (req.url === "https://api.osv.dev/v1/querybatch") return Response.json({ results: [{ vulns: [] }] });
    const body = ROUTES[req.url];
    return body === undefined ? new Response(null, { status: 404 }) : new Response(body);
  },
};

describe("runPublish", () => {
  test("stages a redacted cache that yields the same signals, with both manifests", async () => {
    const db = openDb(":memory:");
    const http = new HttpClient({ transport, cache: new ResponseCache("snap-pub") });
    await runRank(["pypi"], 1, "snap-pub", db, http);
    await runFetch(["pypi"], "snap-pub", db, http);
    await http.flush();
    await runExtract(["pypi"], "snap-pub", db, new ResponseCache("snap-pub"));

    const r = await runPublish(db, "snap-pub");
    expect(r).toMatchObject({ entries: 4, redacted: 1, missing: [], uploaded: false });
    expect(r.compared.signals).toBe(7);
    expect(r.assets.map((a) => a.name)).toEqual(["cache-pypi.tar.gz", "manifest.jsonl", "manifest.original.jsonl"]);

    const published = ResponseCache.at(join(r.dir, "cache"));
    const json = await published.get(jsonUrl("named"));
    expect(json!.body).not.toContain("Jane");
    expect(json!.body).not.toContain("jane@corp.dev");
    expect(json!.entry.originalSha256).not.toBe(json!.entry.sha256);
    expect(json!.entry.path).toStartWith("pypi/");
    // The original manifest is published byte for byte; the committed summary names its hash.
    const original = r.assets.find((a) => a.name === "manifest.original.jsonl")!;
    expect(original.sha256).toBe((await requestSummary("snap-pub"))!.manifest.sha256);
    expect(await Bun.file(join(r.dir, "NOTES.md")).text()).toContain("extract --snapshot snap-pub --cache");
    closeDb(db);
  });

  test("refuses to publish when redaction would change a signal", async () => {
    const db = openDb(":memory:");
    const http = new HttpClient({ transport, cache: new ResponseCache("snap-break") });
    await runRank(["pypi"], 1, "snap-break", db, http);
    await runFetch(["pypi"], "snap-break", db, http);
    await http.flush();
    // A field the repository URL is read from, wrongly listed as personal.
    ALL_PERSONAL_DATA[0]!.paths!.push("info.project_urls");
    const npmSpec = ALL_PERSONAL_DATA[0]!;
    const matches = npmSpec.matches;
    npmSpec.matches = (url) => matches(url) || url === jsonUrl("named");
    try {
      await expect(runPublish(db, "snap-break")).rejects.toThrow(/redacted cache changes 1 rows/);
    } finally {
      npmSpec.paths!.pop();
      npmSpec.matches = matches;
      closeDb(db);
    }
  });
});
