/** Every citation in the curated facts, for the quote check and the sources index. */

import type { Cite } from "../sources/index.ts";
import { ADVISORY_NOTES } from "./advisories.ts";
import { BASELINE } from "./baseline.ts";
import { ECOSYSTEM_FACTS } from "./index.ts";
import { POLICIES } from "./policies.ts";
import { PQC } from "./pqc.ts";
import { SIGSTORE } from "./sigstore.ts";

export const ALL_CITES: Cite[] = [
  ...[...BASELINE, ...POLICIES, ...PQC, ...ECOSYSTEM_FACTS, ...ADVISORY_NOTES].flatMap((f) => f.sources),
  ...SIGSTORE.flatMap((f) => [...f.sources, ...f.clients.flatMap((c) => c.sources)]),
];
