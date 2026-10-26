/**
 * A CycloneDX 1.6 SBOM of the sample: the latest version of every sampled package as a
 * component named by its purl, and every vulnerability OSV knew for them at the snapshot,
 * each pointing at the components it affects. It shows the RQ4 path end to end: purls in an
 * SBOM are enough to find a component's advisories across all seven ecosystems.
 *
 * The output is deterministic (no serial number, the snapshot instant as timestamp, sorted
 * lists), so regenerating the report does not churn the committed file.
 */

import * as CDX from "@cyclonedx/cyclonedx-library";
import { and, eq, isNotNull } from "drizzle-orm";
import type { Db } from "../db/open.ts";
import { advisories, advisoryMatches, packageVersions, packages } from "../db/schema.ts";
import { aliasGroups, databaseOf } from "../advisories/osv.ts";
import { TOOL_VERSION } from "../http/client.ts";

/** Where a reader can look up any OSV id; not a cited source. */
const OSV_VULN_PAGE = "https://osv.dev/vulnerability/";

/** `sample`: the sample's "{ecosystem}/{package}" keys; the SBOM lists that sample's packages. */
export function sbomJson(db: Db, snapshotId: string, asOf: string, sample: Set<string>): string {
  const bom = new CDX.Models.Bom();
  bom.metadata.timestamp = new Date(asOf);
  bom.metadata.tools.components.add(new CDX.Models.Component(CDX.Enums.ComponentType.Application, "pkg-trust-census", { version: TOOL_VERSION }));

  const latest = db
    .select({ ecosystem: packageVersions.ecosystem, name: packageVersions.packageName, version: packageVersions.version, purl: packageVersions.purl, checked: packages.osvQueriedAt })
    .from(packageVersions)
    .innerJoin(packages, and(eq(packages.snapshotId, packageVersions.snapshotId), eq(packages.ecosystem, packageVersions.ecosystem), eq(packages.packageName, packageVersions.packageName)))
    .where(and(eq(packageVersions.snapshotId, snapshotId), eq(packageVersions.isLatest, true), isNotNull(packageVersions.purl)))
    .all()
    .filter((v) => sample.has(`${v.ecosystem}/${v.name}`));
  const components = new Map<string, CDX.Models.Component>();
  for (const v of latest) {
    const c = new CDX.Models.Component(CDX.Enums.ComponentType.Library, v.name, {
      version: v.version,
      bomRef: v.purl!,
      purl: v.purl!,
    });
    bom.components.add(c);
    // Only components OSV was asked about can be said to have no known vulnerability.
    if (v.checked) components.set(`${v.ecosystem}/${v.name}@${v.version}`, c);
  }

  const records = db.select().from(advisories).where(eq(advisories.snapshotId, snapshotId)).all();
  const group = aliasGroups(records.map((r) => ({ id: r.advisoryId, aliases: r.aliases, published: r.published, withdrawn: r.withdrawn })));
  const members = new Map<string, typeof records>();
  for (const r of records) {
    const g = group.get(r.advisoryId);
    if (g) members.set(g, [...(members.get(g) ?? []), r]);
  }

  const affects = new Map<string, Set<CDX.Models.Component>>();
  for (const m of db.select().from(advisoryMatches).where(eq(advisoryMatches.snapshotId, snapshotId)).all()) {
    const c = components.get(`${m.ecosystem}/${m.packageName}@${m.version}`);
    const g = group.get(m.advisoryId);
    if (c && g) affects.set(g, (affects.get(g) ?? new Set()).add(c));
  }

  const cutoff = Date.parse(asOf);
  for (const [g, affected] of affects) {
    const rs = members.get(g)!;
    const first = Math.min(...rs.filter((r) => r.published).map((r) => Date.parse(r.published!)));
    if (!(first <= cutoff)) continue;
    const head = rs.find((r) => r.advisoryId === g)!;
    const others = [...new Set([...rs.map((r) => r.advisoryId), ...rs.flatMap((r) => r.aliases)])].filter((id) => id !== g).sort();
    const vuln = new CDX.Models.Vulnerability.Vulnerability({
      bomRef: g,
      id: g,
      source: new CDX.Models.Vulnerability.Source({ name: databaseOf(g), url: OSV_VULN_PAGE + g }),
      published: new Date(first),
      updated: new Date(Math.max(...rs.map((r) => Date.parse(r.modified)))),
      ...(head.summary ? { description: head.summary } : {}),
    });
    for (const id of others) vuln.references.add(new CDX.Models.Vulnerability.Reference(id, new CDX.Models.Vulnerability.Source({ name: databaseOf(id), url: OSV_VULN_PAGE + id })));
    for (const c of affected) vuln.affects.add(new CDX.Models.Vulnerability.Affect(c.bomRef));
    bom.vulnerabilities.add(vuln);
  }

  const serializer = new CDX.Serialize.JsonSerializer(new CDX.Serialize.JSON.Normalize.Factory(CDX.Spec.Spec1dot6));
  return serializer.serialize(bom, { sortLists: true, space: 2 }) + "\n";
}
