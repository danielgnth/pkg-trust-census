#!/usr/bin/env bun
/**
 * Captures small, real API responses as test fixtures — one per signal shape the
 * extractors will parse.
 *
 * Fixtures are deliberately *trimmed* (huge version arrays cut down) and *redacted* (fields that
 * name people, email addresses — see redactFixture) but otherwise never edited:
 * field names, nesting and value shapes are exactly what the registry returned. Every
 * fixture's source URL, capture date and trim rule is recorded in fixtures.json so a
 * reviewer can tell a real capture from a hand-written mock.
 *
 *   bun run scripts/capture-fixtures.ts
 */

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { HttpClient } from "../src/http/client.ts";
import { redactBody } from "../src/publish/redact.ts";
import { ALL_PERSONAL_DATA } from "../src/publish/publish.ts";
import type { EcosystemId } from "../src/types.ts";

const OUT = "test/fixtures";

interface Spec {
  name: string;
  ecosystem: EcosystemId;
  pkg: string;
  url: string;
  headers?: Record<string, string>;
  /** Why this package: which signal state it pins down. */
  why: string;
  /** Shrinks huge arrays while preserving shape. Returns a note describing what it did. */
  trim?: (data: any) => string | null;
  /** Store verbatim text rather than JSON (Go sumdb returns a signed note). */
  text?: boolean;
}

/**
 * Array ordering differs per registry and getting it wrong silently captures the wrong
 * era of a package: PyPI's Simple API and npm's `time` map run oldest-first, while
 * RubyGems' versions endpoint runs newest-first.
 */
const keepNewestAtEnd = (arr: unknown[], n: number) => arr.splice(0, Math.max(0, arr.length - n));
const keepNewestAtStart = (arr: unknown[], n: number) => arr.splice(n);

/**
 * Public registry data still names people; fixtures are committed, so they carry none of it. The
 * same field-level redaction as a published cache (src/publish/redact.ts), applied before trimming.
 */
export function redactFixture(url: string, body: string): string {
  return redactBody(url, body, ALL_PERSONAL_DATA);
}

const SPECS: Spec[] = [
  {
    name: "pypi-simple-sigstore",
    ecosystem: "pypi",
    pkg: "sigstore",
    url: "https://pypi.org/simple/sigstore/",
    headers: { Accept: "application/vnd.pypi.simple.v1+json" },
    why: "files[].provenance is non-null — PEP 740 attestation present",
    trim: (d) => {
      const before = d.files.length;
      keepNewestAtEnd(d.files, 6);
      if (d.versions) keepNewestAtEnd(d.versions, 6);
      return `files ${before} -> ${d.files.length} (kept newest)`;
    },
  },
  {
    name: "pypi-simple-ruff",
    ecosystem: "pypi",
    pkg: "ruff",
    url: "https://pypi.org/simple/ruff/",
    headers: { Accept: "application/vnd.pypi.simple.v1+json" },
    why: "files[].provenance is null — the negative case, so `false` is a real negative",
    trim: (d) => {
      const before = d.files.length;
      keepNewestAtEnd(d.files, 4);
      if (d.versions) keepNewestAtEnd(d.versions, 4);
      return `files ${before} -> ${d.files.length} (kept newest)`;
    },
  },
  {
    name: "npm-packument-sigstore",
    ecosystem: "npm",
    pkg: "sigstore",
    url: "https://registry.npmjs.org/sigstore",
    why: "dist.attestations present; also exercises the `time` map the backfill needs",
    trim: (d) => {
      const before = Object.keys(d.versions).length;
      const keep = Object.keys(d.versions).slice(-4);
      d.versions = Object.fromEntries(keep.map((v) => [v, d.versions[v]]));
      d.time = Object.fromEntries(
        Object.entries(d.time).filter(([k]) => keep.includes(k) || k === "created" || k === "modified"),
      );
      delete d.readme;
      return `versions ${before} -> ${keep.length}; readme dropped`;
    },
  },
  {
    name: "npm-packument-chalk",
    ecosystem: "npm",
    pkg: "chalk",
    url: "https://registry.npmjs.org/chalk",
    why: "dist.signatures present but no dist.attestations — proves signatures are not the differentiator",
    trim: (d) => {
      const before = Object.keys(d.versions).length;
      const keep = Object.keys(d.versions).slice(-3);
      d.versions = Object.fromEntries(keep.map((v) => [v, d.versions[v]]));
      d.time = Object.fromEntries(
        Object.entries(d.time).filter(([k]) => keep.includes(k) || k === "created" || k === "modified"),
      );
      delete d.readme;
      return `versions ${before} -> ${keep.length}; readme dropped`;
    },
  },
  {
    name: "crates-versions-bon",
    ecosystem: "crates",
    pkg: "bon",
    url: "https://crates.io/api/v1/crates/bon/versions?per_page=5",
    why: "trustpub_data populated — the only direct trusted-publishing observation of the seven",
  },
  {
    name: "crates-versions-serde",
    ecosystem: "crates",
    pkg: "serde",
    url: "https://crates.io/api/v1/crates/serde/versions?per_page=3",
    why: "trustpub_data null — token-published negative case",
  },
  {
    name: "rubygems-versions-trusted-publishing-test",
    ecosystem: "rubygems",
    pkg: "trusted_publishing_test",
    url: "https://rubygems.org/api/v1/versions/trusted_publishing_test.json",
    why: "Ruby Central's own trusted-publishing gem exposes NO trusted-publishing field — pins the negative finding",
    trim: (d) => {
      const before = d.length;
      keepNewestAtStart(d, 4);
      return `versions ${before} -> ${d.length} (newest-first API, kept head)`;
    },
  },
  {
    name: "rubygems-versions-rails",
    ecosystem: "rubygems",
    pkg: "rails",
    url: "https://rubygems.org/api/v1/versions/rails.json",
    why: "metadata.rubygems_mfa_required present per version — the backfillable MFA signal",
    trim: (d) => {
      const before = d.length;
      keepNewestAtStart(d, 4);
      return `versions ${before} -> ${d.length} (newest-first API, kept head)`;
    },
  },
  {
    name: "go-latest-gorilla-mux",
    ecosystem: "go",
    pkg: "github.com/gorilla/mux",
    url: "https://proxy.golang.org/github.com/gorilla/mux/@latest",
    why: "Origin {VCS, URL, Ref, Hash} — source provenance built into the module proxy",
  },
  {
    name: "go-sumdb-gorilla-mux",
    ecosystem: "go",
    pkg: "github.com/gorilla/mux",
    url: "https://sum.golang.org/lookup/github.com/gorilla/mux@v1.8.1",
    text: true,
    why: "transparency-log inclusion proof; HTTP 200 is itself the signal",
  },
  {
    name: "maven-gav-sigstore",
    ecosystem: "maven",
    pkg: "dev.sigstore:protobuf-specs",
    url: "https://search.maven.org/solrsearch/select?q=g:dev.sigstore+AND+a:protobuf-specs&core=gav&rows=3&wt=json",
    why: "ec[] lists .jar.sigstore.json — the Sigstore positive case. Note it lists .jar.asc.sha256 but never a bare .jar.asc",
  },
  {
    name: "maven-gav-guava",
    ecosystem: "maven",
    pkg: "com.google.guava:guava",
    url: "https://search.maven.org/solrsearch/select?q=g:com.google.guava+AND+a:guava&core=gav&rows=3&wt=json",
    why: "ec[] omits .asc even though the .asc file exists — pins the trap that ec is unreliable for GPG",
  },
  {
    name: "packagist-monolog",
    ecosystem: "packagist",
    pkg: "monolog/monolog",
    url: "https://packagist.org/packages/monolog/monolog.json",
    why: "no signing field of any kind exists on version objects — the no_mechanism case",
    trim: (d) => {
      const before = Object.keys(d.package.versions).length;
      const keep = Object.keys(d.package.versions).slice(0, 3);
      d.package.versions = Object.fromEntries(keep.map((v) => [v, d.package.versions[v]]));
      return `versions ${before} -> ${keep.length}`;
    },
  },
  {
    name: "pypi-provenance-sigstore",
    ecosystem: "pypi",
    pkg: "sigstore",
    url: "https://pypi.org/integrity/sigstore/4.5.0/sigstore-4.5.0.tar.gz/provenance",
    why: "PEP 740 provenance object: 'publish' predicate (not SLSA) and a Fulcio certificate carrying repository + commit",
  },
  {
    name: "rubygems-attestations-rails",
    ecosystem: "rubygems",
    pkg: "rails",
    url: "https://rubygems.org/api/v1/attestations/rails-8.1.4.json",
    why: "Sigstore attestation bundle (bare message signature) whose certificate carries repository + commit",
  },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const http = new HttpClient();
  await http.cache.load();

  const manifest: unknown[] = [];
  let failures = 0;

  for (const spec of SPECS) {
    const file = join(OUT, `${spec.name}.${spec.text ? "txt" : "json"}`);
    try {
      const res = await http.get(spec.url, {
        ecosystem: spec.ecosystem,
        package: spec.pkg,
        ...(spec.headers ? { headers: spec.headers } : {}),
      });

      let note: string | null = null;
      let out: string;
      if (spec.text) {
        out = redactFixture(spec.url, res.body);
      } else {
        const data = JSON.parse(redactFixture(spec.url, res.body));
        note = spec.trim?.(data) ?? null;
        out = JSON.stringify(data, null, 2) + "\n";
      }
      await Bun.write(file, out);

      manifest.push({
        fixture: file,
        ecosystem: spec.ecosystem,
        package: spec.pkg,
        source_url: spec.url,
        ...(spec.headers ? { request_headers: spec.headers } : {}),
        http_status: res.status,
        captured_at: res.entry.fetchedAt,
        full_response_sha256: res.entry.sha256,
        full_response_bytes: res.entry.bytes,
        trimmed: note,
        redacted: "fields that name people (PERSONAL_DATA in each adapter) and email addresses",
        why: spec.why,
      });
      console.log(`  ok  ${spec.name}${note ? `  (${note})` : ""}`);
    } catch (err) {
      failures++;
      console.error(`  FAIL ${spec.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await Bun.write(join(OUT, "fixtures.json"), JSON.stringify(manifest, null, 2) + "\n");
  await http.flush();
  console.log(`\n${manifest.length}/${SPECS.length} captured -> ${OUT}/fixtures.json`);
  if (failures) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
