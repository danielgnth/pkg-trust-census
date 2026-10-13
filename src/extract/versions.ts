/**
 * Version-string helpers, one rule per ecosystem's convention.
 *
 * Only two questions are ever asked: "is this a pre-release?" (pre-releases are excluded
 * from quarter anchors because a default install skips them) and, for Go, "what order are
 * these tags in?" (the proxy lists them unordered and undated).
 */

/** SemVer 2.0 pre-release: anything after a `-` in the core, ignoring build metadata. */
export function isSemverPrerelease(v: string): boolean {
  return v.replace(/\+.*$/, "").includes("-");
}

/** PEP 440 pre- and dev-releases: `1.0a1`, `2.0rc2`, `3.1.dev0`. Post-releases are stable. */
export function isPep440Prerelease(v: string): boolean {
  return /[\d._-](a|b|c|rc|alpha|beta|pre|preview|dev)\d*$|[\d._-](a|b|c|rc|alpha|beta|pre|preview)\d*[._-]?dev\d*$/i.test(v.replace(/[._-]?post\d*$/i, ""));
}

/**
 * Maven has no enforced convention; these are the qualifiers Maven's own ComparableVersion
 * ranks below a release, plus `SNAPSHOT`.
 */
export function isMavenPrerelease(v: string): boolean {
  return /(^|[.\-_])(alpha|beta|milestone|rc|cr|m|a|b|snapshot|preview|ea|dev)[.\-_]?\d*([.\-_]|$)/i.test(v);
}

/** Composer: `dev-main`, `1.x-dev`, and stability suffixes `alpha|beta|RC`. */
export function isComposerPrerelease(v: string): boolean {
  return isComposerBranch(v) || /(^|[-._\d])(alpha|beta|rc|a|b)[._-]?\d*$/i.test(v);
}

/** True for a Composer branch alias rather than a tagged release. */
export function isComposerBranch(v: string): boolean {
  return v.startsWith("dev-") || v.endsWith("-dev");
}

/**
 * SemVer precedence for Go module tags (`v1.2.3`, `v1.2.3-rc.1`, `v2.0.0+incompatible`).
 * Build metadata is ignored, as the spec requires.
 */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    const d = pa.core[i]! - pb.core[i]!;
    if (d !== 0) return d;
  }
  // A release outranks any of its pre-releases.
  if (!pa.pre.length || !pb.pre.length) return pb.pre.length - pa.pre.length;
  for (let i = 0; i < Math.max(pa.pre.length, pb.pre.length); i++) {
    const x = pa.pre[i];
    const y = pb.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const xn = /^\d+$/.test(x);
    const yn = /^\d+$/.test(y);
    if (xn && yn) {
      const d = Number(x) - Number(y);
      if (d !== 0) return d;
    } else if (xn !== yn) {
      return xn ? -1 : 1;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

function parseSemver(v: string): { core: number[]; pre: string[] } {
  const stripped = v.replace(/^v/, "").replace(/\+.*$/, "");
  const dash = stripped.indexOf("-");
  const core = (dash === -1 ? stripped : stripped.slice(0, dash))
    .split(".")
    .map((n) => Number.parseInt(n, 10) || 0);
  while (core.length < 3) core.push(0);
  const pre = dash === -1 ? [] : stripped.slice(dash + 1).split(".");
  return { core, pre };
}
