/**
 * Package URLs: one identifier format for a release in any of the seven registries, which is
 * what lets an SBOM name components across ecosystems. packageurl-js implements the purl spec,
 * including each type's name normalisation (PyPI and Composer lowercase, npm percent-encodes the
 * scope's "@"); this module only splits our registry-canonical names into namespace and name.
 */

import { PackageURL } from "packageurl-js";
import type { EcosystemId } from "../types.ts";

export const PURL_TYPE: Record<EcosystemId, string> = {
  pypi: "pypi",
  npm: "npm",
  crates: "cargo",
  rubygems: "gem",
  go: "golang",
  maven: "maven",
  packagist: "composer",
};

/** Namespace and name as the purl type expects them, from the name as this project stores it. */
function split(ecosystem: EcosystemId, name: string): [namespace: string | null, name: string] {
  const cut = (sep: string, at: number) => (at > 0 ? [name.slice(0, at), name.slice(at + sep.length)] as [string, string] : [null, name] as [null, string]);
  switch (ecosystem) {
    // "group:artifact"
    case "maven":
      return cut(":", name.indexOf(":"));
    // "@scope/name" and "vendor/name"
    case "npm":
    case "packagist":
      return cut("/", name.indexOf("/"));
    // A module path: everything up to the last segment is the namespace.
    case "go":
      return cut("/", name.lastIndexOf("/"));
    default:
      return [null, name];
  }
}

/** `pkg:npm/%40types/node@1.0.0`, or without `@version` when none is given. */
export function purlOf(ecosystem: EcosystemId, name: string, version?: string): string {
  const [namespace, base] = split(ecosystem, name);
  return new PackageURL(PURL_TYPE[ecosystem], namespace, base, version ?? null, null, null).toString();
}
