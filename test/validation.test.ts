import { describe, expect, test } from "bun:test";
import {
  packageInsert,
  packageVersionInsert,
  sampleMemberInsert,
  signalAvailabilityInsert,
  snapshotInsert,
  validateAll,
  versionSignalInsert,
} from "../src/db/validation.ts";

const basePackage = {
  snapshotId: "snap-1",
  ecosystem: "pypi",
  packageName: "requests",
};

const baseMember = { ...basePackage, layer: "top", rankFrame: "downloads", rank: 1, downloadCount: 100 };

describe("packageInsert", () => {
  test("accepts a well-formed row", () => {
    expect(packageInsert.parse(basePackage)).toMatchObject({ packageName: "requests" });
  });

  test.each([
    ["unknown ecosystem", { ecosystem: "cargo" }],
    ["negative maintainer count", { maintainerCount: -1 }],
    ["empty package name", { packageName: "" }],
    ["unparseable timestamp", { fetchTimestamp: "last tuesday" }],
    ["non-url repository", { repositoryUrl: "github.com/psf/requests" }],
  ])("rejects %s", (_label, override) => {
    expect(packageInsert.safeParse({ ...basePackage, ...override }).success).toBe(false);
  });
});

describe("sampleMemberInsert", () => {
  test("accepts a well-formed row", () => {
    expect(sampleMemberInsert.parse(baseMember)).toMatchObject({ packageName: "requests", rank: 1 });
  });

  test.each([
    ["rank below 1", { rank: 0 }],
    ["negative downloads", { downloadCount: -5 }],
    ["unknown rank frame", { rankFrame: "stars" }],
    ["unknown layer", { layer: "stratified" }],
  ])("rejects %s", (_label, override) => {
    expect(sampleMemberInsert.safeParse({ ...baseMember, ...override }).success).toBe(false);
  });

  /**
   * The cross-field rules SQL cannot express: a row sampled by downloads with no download
   * count means the ranking source silently returned nothing useful.
   */
  test("requires a downloadCount when sampled by downloads", () => {
    const r = sampleMemberInsert.safeParse({ ...baseMember, downloadCount: null });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toContain("requires a downloadCount");
  });

  test("requires a dependentCount when sampled by dependents", () => {
    const r = sampleMemberInsert.safeParse({
      ...baseMember,
      rankFrame: "dependents",
      downloadCount: null,
      dependentCount: null,
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toContain("requires a dependentCount");
  });

  test("accepts a dependents-framed row for Go, which publishes no download counts", () => {
    expect(
      sampleMemberInsert.safeParse({
        ...baseMember,
        ecosystem: "go",
        packageName: "github.com/gorilla/mux",
        rankFrame: "dependents",
        downloadCount: null,
        dependentCount: 179073,
      }).success,
    ).toBe(true);
  });

  test("the random layer, and only it, is framed `random`", () => {
    const random = { ...baseMember, layer: "random", rankFrame: "random", downloadCount: null };
    expect(sampleMemberInsert.safeParse(random).success).toBe(true);
    expect(sampleMemberInsert.safeParse({ ...random, rankFrame: "downloads", downloadCount: 1 }).success).toBe(false);
    expect(sampleMemberInsert.safeParse({ ...baseMember, rankFrame: "random" }).success).toBe(false);
  });
});

describe("packageVersionInsert", () => {
  const base = {
    snapshotId: "snap-1",
    ecosystem: "crates",
    packageName: "bon",
    version: "3.9.3",
  };

  test.each([
    ["2024Q1", true],
    ["2024Q1,2024Q2", true],
    ["2024Q1,2024Q2,2024Q3", true],
    ["2024Q5", false],
    ["24Q1", false],
    ["2024-Q1", false],
    ["Q1", false],
  ])("quarter anchor %s -> valid=%s", (quarterAnchor, valid) => {
    expect(packageVersionInsert.safeParse({ ...base, quarterAnchor }).success).toBe(valid);
  });

  test("allows a null publish date, which several registries omit", () => {
    expect(packageVersionInsert.safeParse({ ...base, publishedAt: null }).success).toBe(true);
  });
});

describe("versionSignalInsert", () => {
  const base = {
    snapshotId: "snap-1",
    ecosystem: "crates",
    packageName: "bon",
    version: "3.9.3",
    signalId: "identity_publish",
    value: "true",
    evidence: "elastio/bon",
    signalSource: "GET /api/v1/crates/{c}/versions -> versions[].trustpub_data",
    responses: [{ url: "https://crates.io/api/v1/crates/bon/versions?per_page=100&sort=date", sha256: "a".repeat(64) }],
  };

  test("accepts a well-formed signal", () => {
    expect(versionSignalInsert.parse(base).value).toBe("true");
  });

  test("rejects a signal id outside the five dimensions", () => {
    expect(versionSignalInsert.safeParse({ ...base, signalId: "has_sbom" }).success).toBe(false);
  });

  test("rejects a value outside the three states", () => {
    expect(versionSignalInsert.safeParse({ ...base, value: "maybe" }).success).toBe(false);
  });

  /** Without a source an aggregate number cannot be traced back to an endpoint. */
  test("requires a signalSource", () => {
    expect(versionSignalInsert.safeParse({ ...base, signalSource: "" }).success).toBe(false);
  });

  test("requires evidence behind a positive claim", () => {
    const r = versionSignalInsert.safeParse({ ...base, evidence: null });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toContain("must carry evidence");
  });

  test("allows unknown and false without evidence", () => {
    expect(versionSignalInsert.safeParse({ ...base, value: "unknown", evidence: null }).success).toBe(true);
    expect(versionSignalInsert.safeParse({ ...base, value: "false", evidence: null }).success).toBe(true);
  });

  /** A matrix cell must trace back to the bytes each of its rows was read from. */
  test("requires the responses a registry-read value rests on", () => {
    const r = versionSignalInsert.safeParse({ ...base, responses: [] });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toContain("must name the response");
  });

  test("allows no response for policy and no-mechanism rows", () => {
    for (const signalSource of ["policy: PyPI requires 2FA for all accounts (effective 2024-01-01)", "no_mechanism: none"]) {
      expect(versionSignalInsert.safeParse({ ...base, value: "false", evidence: null, signalSource, responses: [] }).success).toBe(true);
    }
  });

  test("rejects a malformed response sha256", () => {
    expect(versionSignalInsert.safeParse({ ...base, responses: [{ url: base.responses[0]!.url, sha256: "deadbeef" }] }).success).toBe(false);
  });
});

describe("signalAvailabilityInsert", () => {
  test.each(["observable", "inferred", "not_exposed", "no_mechanism"])("accepts %s", (availability) => {
    expect(
      signalAvailabilityInsert.safeParse({
        ecosystem: "rubygems",
        signalId: "identity_publish",
        availability,
      }).success,
    ).toBe(true);
  });

  test("rejects an availability outside the four states", () => {
    expect(
      signalAvailabilityInsert.safeParse({
        ecosystem: "rubygems",
        signalId: "identity_publish",
        availability: "missing",
      }).success,
    ).toBe(false);
  });
});

describe("snapshotInsert", () => {
  test("rejects config that is not valid JSON", () => {
    const r = snapshotInsert.safeParse({
      snapshotId: "s",
      startedAt: new Date().toISOString(),
      toolVersion: "0.1.0",
      configJson: "{not json",
    });
    expect(r.success).toBe(false);
  });
});

describe("validateAll", () => {
  test("names the offending row and field", () => {
    const rows = [baseMember, { ...baseMember, packageName: "urllib3", rank: -1 }];
    expect(() => validateAll(sampleMemberInsert, rows, "sample_members")).toThrow(
      /invalid sample_members row 1 \(pypi\/urllib3\).*rank/s,
    );
  });

  test("returns parsed rows when every row is valid", () => {
    const out = validateAll(packageInsert, [basePackage], "packages");
    expect(out).toHaveLength(1);
    expect(out[0]!.packageName).toBe("requests");
  });

  /** Dropping bad rows would understate adoption in the aggregate results. */
  test("throws rather than filtering, so a bad row cannot silently vanish", () => {
    const rows = [{ ...basePackage, ecosystem: "nope" }, basePackage];
    expect(() => validateAll(packageInsert, rows, "packages")).toThrow(/row 0/);
  });
});
