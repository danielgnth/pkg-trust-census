import type { EcosystemId } from "../types.ts";
import type { EcosystemAdapter } from "./types.ts";
import { PypiAdapter } from "./pypi.ts";
import { NpmAdapter } from "./npm.ts";
import { CratesAdapter } from "./crates.ts";
import { RubygemsAdapter } from "./rubygems.ts";
import { GoAdapter } from "./go.ts";
import { MavenAdapter } from "./maven.ts";
import { PackagistAdapter } from "./packagist.ts";

const REGISTRY: Partial<Record<EcosystemId, EcosystemAdapter>> = {
  pypi: new PypiAdapter(),
  npm: new NpmAdapter(),
  crates: new CratesAdapter(),
  rubygems: new RubygemsAdapter(),
  go: new GoAdapter(),
  maven: new MavenAdapter(),
  packagist: new PackagistAdapter(),
};

export function getAdapter(id: EcosystemId): EcosystemAdapter | null {
  return REGISTRY[id] ?? null;
}

export function implementedEcosystems(): EcosystemId[] {
  return Object.keys(REGISTRY) as EcosystemId[];
}
