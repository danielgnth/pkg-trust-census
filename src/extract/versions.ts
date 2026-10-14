/**
 * "Is this a pre-release?", one rule per ecosystem's convention. Pre-releases are excluded
 * from quarter anchors because a default install skips them. SemVer and PEP 440 use their
 * reference parsers; Maven and Composer have no such library, so they keep a pattern.
 */

import { explain } from "@renovatebot/pep440";
import semver from "semver";

/** SemVer 2.0 pre-release (`1.2.3-rc.1`); build metadata is ignored. Go's `v` prefix is accepted. */
export function isSemverPrerelease(v: string): boolean {
  return semver.prerelease(v) !== null;
}

/** PEP 440 pre- and dev-releases: `1.0a1`, `2.0rc2`, `3.1.dev0`. Post-releases are stable. */
export function isPep440Prerelease(v: string): boolean {
  return explain(v)?.is_prerelease ?? false;
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
