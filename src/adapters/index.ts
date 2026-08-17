import type { EcosystemId } from "../types.ts";
import type { EcosystemAdapter } from "./types.ts";
import { PypiAdapter } from "./pypi.ts";

/** Adapters land per milestone: PyPI (M2), crates.io + npm (M4), RubyGems + Packagist (M5), Go + Maven (M6). */
const REGISTRY: Partial<Record<EcosystemId, EcosystemAdapter>> = {
  pypi: new PypiAdapter(),
};

export function getAdapter(id: EcosystemId): EcosystemAdapter | null {
  return REGISTRY[id] ?? null;
}

export function implementedEcosystems(): EcosystemId[] {
  return Object.keys(REGISTRY) as EcosystemId[];
}
