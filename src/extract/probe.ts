/**
 * Quarter-anchor selection for registries where each release date costs a request.
 *
 * Go's proxy lists versions without dates (`@v/list`), and Maven Central's metadata lists
 * them without dates too; a date is one `.info` GET or one `.pom` HEAD per release. A
 * linear walk over `aws-sdk`-sized histories would mean thousands of requests per package.
 *
 * Releases are ordered (semver for Go, deploy order for Maven), so each quarter boundary
 * is a binary search: the last release dated at or before it. With eleven quarters and a
 * shared memo this costs a few dozen probes even for a thousand-release history.
 *
 * Assumes date order follows list order. A backport published after a newer line (a
 * `1.2.9` after `1.3.0`) can shift an anchor by one release; documented in methodology.md.
 */

import { quarterBoundaries } from "./quarters.ts";

/**
 * @param ordered release identifiers, oldest first
 * @param dateOf  resolves one release's publish time; null when the registry has none
 * @returns every probed release with its date — always including the newest
 */
export async function probeAnchorDates(
  ordered: string[],
  dateOf: (version: string) => Promise<string | null>,
  asOf: Date,
): Promise<Map<string, string | null>> {
  const memo = new Map<number, Promise<number>>();
  const probed = new Map<string, string | null>();

  const timeAt = (i: number): Promise<number> => {
    let p = memo.get(i);
    if (!p) {
      p = dateOf(ordered[i]!).then((d) => {
        probed.set(ordered[i]!, d);
        const t = d ? Date.parse(d) : NaN;
        // An undated release is treated as newer than any boundary, so it is never
        // chosen as an anchor on the strength of a date it does not have.
        return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
      });
      memo.set(i, p);
    }
    return p;
  };

  if (ordered.length === 0) return probed;
  await timeAt(ordered.length - 1);

  await Promise.all(
    quarterBoundaries(asOf).map(async ({ at }) => {
      const cutoff = at.getTime();
      let lo = 0;
      let hi = ordered.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if ((await timeAt(mid)) <= cutoff) lo = mid + 1;
        else hi = mid - 1;
      }
    }),
  );

  return probed;
}
