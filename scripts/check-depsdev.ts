#!/usr/bin/env bun
/**
 * Checks deps.dev's attestation records against this project's own measurement, for the latest
 * release of every sampled package in a snapshot. The whole-registry layer counts attestations
 * from deps.dev's BigQuery dataset; this check shows, release by release, which of our signals
 * that data stands for, and lists every disagreement.
 *
 * Asks deps.dev's per-version API (the same data model as the dataset) through the project's HTTP
 * client, so the answers are cached with the snapshot and published with its cache. Prints
 * Markdown, which `bun run sources` archives as the measurement source `depsDevAgreement`.
 *
 *   bun run scripts/check-depsdev.ts [--snapshot <id>]
 */

import { and, eq } from "drizzle-orm";
import { parseArgs } from "node:util";
import type { EcosystemId } from "../src/types.ts";
import { openDb, latestSnapshot, closeDb } from "../src/db/open.ts";
import { packageVersions, versionSignals } from "../src/db/schema.ts";
import { HttpClient } from "../src/http/client.ts";
import { ResponseCache } from "../src/http/cache.ts";
import { ECOSYSTEM_LABEL } from "../src/report/labels.ts";

const API = "https://api.deps.dev/v3/systems";

/**
 * deps.dev's name for each system, and the signal this project reads for the mechanism deps.dev
 * records. Only a Sigstore attestation is the same mechanism (`comparable`); crates.io's trusted
 * publishing and Go's checksum database are counted beside it, to show deps.dev does not carry them.
 */
const SYSTEMS: Partial<Record<EcosystemId, { system: string; ours: string | null; label: string; comparable: boolean }>> = {
  npm: { system: "npm", ours: "artifact_signature", label: "Sigstore provenance (`dist.attestations`)", comparable: true },
  pypi: { system: "pypi", ours: "artifact_signature", label: "PEP 740 attestation", comparable: true },
  rubygems: { system: "rubygems", ours: "transparency_log", label: "Sigstore attestation", comparable: true },
  maven: { system: "maven", ours: "transparency_log", label: "`.sigstore.json` bundle", comparable: true },
  crates: { system: "cargo", ours: "identity_publish", label: "trusted publishing (no attestation scheme)", comparable: false },
  go: { system: "go", ours: null, label: "checksum database (not an attestation)", comparable: false },
};

interface Attestation {
  type?: string;
  url?: string;
  verified?: boolean;
  sourceRepository?: string;
  commit?: string;
}

const { values: args } = parseArgs({ options: { snapshot: { type: "string" } } });
const db = openDb();
const snapshotId = args.snapshot ?? latestSnapshot(db);
if (!snapshotId) throw new Error("no snapshot");
const http = new HttpClient({ cache: new ResponseCache(snapshotId) });
await http.cache.load();

const lines: string[] = [
  `# deps.dev attestations against this project's measurement (snapshot ${snapshotId})`,
  "",
  "deps.dev attestations compared with this project's measurement, for the latest release of every sampled package.",
  "*Ours* is the signal this project reads for the same mechanism; *deps.dev* counts releases with at least one",
  "attestation, *verified* those whose every attestation deps.dev verified, *repo + commit* those naming both.",
  "",
  "| Registry | Our signal | Releases | Ours | deps.dev | Verified | Repo + commit | Both | Ours only | deps.dev only | Not in deps.dev |",
  "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
];
const disagreements: string[] = [];

for (const [eco, sys] of Object.entries(SYSTEMS) as Array<[EcosystemId, NonNullable<(typeof SYSTEMS)[EcosystemId]>]>) {
  const latest = db
    .select({ name: packageVersions.packageName, version: packageVersions.version })
    .from(packageVersions)
    .where(and(eq(packageVersions.snapshotId, snapshotId), eq(packageVersions.ecosystem, eco), eq(packageVersions.isLatest, true)))
    .all();
  if (latest.length === 0) continue;
  const signal = new Map(
    sys.ours
      ? db
          .select({ name: versionSignals.packageName, version: versionSignals.version, value: versionSignals.value })
          .from(versionSignals)
          .where(and(eq(versionSignals.snapshotId, snapshotId), eq(versionSignals.ecosystem, eco), eq(versionSignals.signalId, sys.ours)))
          .all()
          .map((s) => [`${s.name}@${s.version}`, s.value])
      : [],
  );

  const counts = { ours: 0, theirs: 0, verified: 0, linked: 0, both: 0, oursOnly: 0, theirsOnly: 0, missing: 0 };
  for (const { name, version } of latest) {
    const url = `${API}/${sys.system}/packages/${encodeURIComponent(name)}/versions/${encodeURIComponent(version)}`;
    const { data } = await http.getJson<{ attestations?: Attestation[] }>(url, { ecosystem: eco, package: name });
    const ours = signal.get(`${name}@${version}`) === "true";
    if (ours) counts.ours++;
    if (!data) {
      counts.missing++;
      if (ours && sys.comparable) disagreements.push(`- ${ECOSYSTEM_LABEL[eco]} ${name}@${version}: ours true, not in deps.dev`);
      continue;
    }
    const att = data.attestations ?? [];
    const theirs = att.length > 0;
    if (theirs) counts.theirs++;
    if (theirs && att.every((a) => a.verified)) counts.verified++;
    if (att.some((a) => a.sourceRepository && a.commit)) counts.linked++;
    if (ours && theirs) counts.both++;
    if (!sys.comparable) continue;
    if (ours && !theirs) {
      counts.oursOnly++;
      disagreements.push(`- ${ECOSYSTEM_LABEL[eco]} ${name}@${version}: ours true, deps.dev none`);
    }
    if (theirs && !ours) {
      counts.theirsOnly++;
      disagreements.push(`- ${ECOSYSTEM_LABEL[eco]} ${name}@${version}: deps.dev ${att.map((a) => a.type || "untyped").join(", ")}, ours ${signal.get(`${name}@${version}`) ?? "absent"}`);
    }
  }
  const ours = sys.ours ? String(counts.ours) : "–";
  const dash = (n: number) => (sys.comparable ? String(n) : "–");
  lines.push(
    `| ${ECOSYSTEM_LABEL[eco]} | ${sys.label} | ${latest.length} | ${ours} | ${counts.theirs} | ${counts.verified} | ${counts.linked} | ${dash(counts.both)} | ${dash(counts.oursOnly)} | ${dash(counts.theirsOnly)} | ${counts.missing} |`,
  );
}
await http.flush();
closeDb(db);

lines.push("", "Packagist is not in deps.dev.", "", "## Disagreements", "", ...(disagreements.length ? disagreements : ["None."]), "");
console.log(lines.join("\n"));
