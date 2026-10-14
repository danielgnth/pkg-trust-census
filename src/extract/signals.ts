/**
 * Shared extraction logic: which versions are kept, and how a signal row is built.
 *
 * Every adapter reduces its registry's response to `VersionRecord`s and hands them here,
 * so "latest plus one anchor per quarter" means the same thing in all seven ecosystems.
 */

import hostedGitInfo from "hosted-git-info";
import type { ExtractedSignal, FetchResult, ResponseRef, SignalId, SignalValue, Withdrawal, WithdrawalKind } from "../types.ts";
import { anchorLabelsByVersion, selectQuarterAnchors } from "./quarters.ts";

export interface VersionRecord {
  version: string;
  publishedAt: string | null;
  /** Excluded from quarter anchors: a default install would not have picked it. */
  prerelease?: boolean;
  /** Excluded from quarter anchors: withdrawn releases are not what anyone installed. */
  yanked?: boolean;
}

export interface KeptVersion<T extends VersionRecord> {
  record: T;
  isLatest: boolean;
  /** Comma-joined quarter labels this version anchors, or null. */
  quarterAnchor: string | null;
}

/**
 * Reduces a full release history to the versions the dataset stores: the registry's
 * current version plus the anchor for each backfill quarter.
 *
 * Storing every release would multiply the table by ~50 for no analytical gain — the
 * time series only ever reads anchors, and the matrix only ever reads the latest.
 */
export function selectKeptVersions<T extends VersionRecord>(
  records: T[],
  latest: string | null,
  asOf: Date,
): KeptVersion<T>[] {
  const eligible = records.filter((r) => !r.prerelease && !r.yanked);
  const labels = anchorLabelsByVersion(selectQuarterAnchors(eligible, asOf));

  // When the registry names no current version, fall back to the newest stable release.
  const latestVersion = latest ?? newestByDate(eligible)?.version ?? null;

  return records
    .filter((r) => r.version === latestVersion || labels.has(r.version))
    .sort((a, b) => dateValue(a.publishedAt) - dateValue(b.publishedAt))
    .map((record) => ({
      record,
      isLatest: record.version === latestVersion,
      quarterAnchor: labels.get(record.version) ?? null,
    }));
}

function newestByDate<T extends VersionRecord>(records: T[]): T | undefined {
  return records
    .filter((r) => r.publishedAt)
    .sort((a, b) => dateValue(b.publishedAt) - dateValue(a.publishedAt))[0];
}

/** Undated releases sort last: unknown is never silently treated as old. */
function dateValue(iso: string | null): number {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

/** The cached responses a value was read from. A `false` can rest on several (all of them 404). */
export type ReadFrom = FetchResult | null | undefined | ReadonlyArray<FetchResult | null | undefined>;

function refs(from: ReadFrom): ResponseRef[] {
  const list = Array.isArray(from) ? from : [from];
  const out = new Map<string, ResponseRef>();
  for (const r of list as Array<FetchResult | null | undefined>) {
    if (r) out.set(r.url, { url: r.url, sha256: r.entry.sha256 });
  }
  return [...out.values()];
}

export function signal(
  id: SignalId,
  value: SignalValue,
  evidence: string | null,
  signalSource: string,
  from: ReadFrom,
): ExtractedSignal {
  return { signal: id, value, evidence, signalSource, responses: refs(from) };
}

/** `true` when evidence was observed, otherwise `false`: for signals whose absence is a real negative. */
export function observed(id: SignalId, evidence: string | null, signalSource: string, from: ReadFrom): ExtractedSignal {
  return signal(id, evidence != null ? "true" : "false", evidence, signalSource, from);
}

/**
 * `true` when evidence was observed, otherwise `unknown`: for inferred signals, where the
 * evidence implies the signal but its absence does not imply the opposite.
 */
export function impliedBy(id: SignalId, evidence: string | null, signalSource: string, from: ReadFrom): ExtractedSignal {
  return signal(id, evidence != null ? "true" : "unknown", evidence, signalSource, from);
}

/**
 * The ecosystem has no such mechanism, so no release can have it. Recorded as `false`
 * (accurately: this version is not signed) — the matrix reads `signal_availability` to
 * render the cell as "no mechanism" rather than as 0% adoption.
 */
export function noMechanism(id: SignalId, why: string): ExtractedSignal {
  return signal(id, "false", null, `no_mechanism: ${why}`, null);
}

/** The mechanism exists but the registry does not reveal who uses it. */
export function notExposed(id: SignalId, why: string): ExtractedSignal {
  return signal(id, "unknown", null, `not_exposed: ${why}`, null);
}

/**
 * A registry-wide mandate with a known effective date applies to every release published
 * on or after it. Earlier releases stay `unknown` rather than `false`: the account may well
 * have had MFA voluntarily, the registry simply did not require it yet.
 */
export function policySince(
  id: SignalId,
  publishedAt: string | null,
  effective: string,
  policy: string,
): ExtractedSignal {
  const source = `policy: ${policy} (effective ${effective.slice(0, 10)})`;
  if (!publishedAt) return signal(id, "unknown", null, source, null);
  return Date.parse(publishedAt) >= Date.parse(effective)
    ? signal(id, "true", policy, source, null)
    : signal(id, "unknown", null, source, null);
}

/**
 * Normalises the many spellings of a repository URL (`git+https://…/x.git`, `git://…`,
 * `github:owner/repo`) to a plain https URL, or null when it is not a URL at all.
 * The `packages.repository_url` column is validated as a URL, so garbage must not reach it.
 *
 * GitHub, GitLab, Bitbucket and Gist go through npm's hosted-git-info, which also drops a
 * `#committish` or `/tree/<ref>` suffix. Bare `owner/repo` is npm's GitHub shorthand and
 * means nothing elsewhere, so a scheme or `host:` prefix is required.
 */
export function cleanRepoUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const s = raw.trim();
  const hosted = s.includes(":") ? hostedGitInfo.fromUrl(s) : undefined;
  if (hosted) return hosted.browse({ noCommittish: true });
  try {
    const u = new URL(s.replace(/^git\+/, "").replace(/^(git|ssh):\/\/(git@)?/, "https://").replace(/\.git$/, ""));
    u.hash = "";
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString().replace(/\/$/, "") : null;
  } catch {
    return null;
  }
}

/** Earliest of several timestamps, e.g. the files of one PyPI release. */
export function earliest(timestamps: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  let bestT = Number.POSITIVE_INFINITY;
  for (const ts of timestamps) {
    if (!ts) continue;
    const t = Date.parse(ts);
    if (Number.isFinite(t) && t < bestT) {
      bestT = t;
      best = new Date(t).toISOString();
    }
  }
  return best;
}

/**
 * Counts withdrawn versions among those published in [since, until]. Undated versions are
 * left out of both numerator and denominator rather than guessed into the window.
 */
export function withdrawalIn(
  kind: WithdrawalKind,
  versions: Array<{ version: string; publishedAt: string | null; withdrawn: boolean }>,
  since: Date,
  until: Date,
): Withdrawal {
  const inWindow = versions.filter((v) => {
    const t = v.publishedAt ? Date.parse(v.publishedAt) : NaN;
    return Number.isFinite(t) && t >= since.getTime() && t <= until.getTime();
  });
  return { kind, versionsInWindow: inWindow.length, withdrawn: inWindow.filter((v) => v.withdrawn).map((v) => v.version) };
}

