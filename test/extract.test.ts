import { describe, expect, test } from "bun:test";
import { cleanRepoUrl, earliest, policySince, selectKeptVersions } from "../src/extract/signals.ts";
import { probeAnchorDates } from "../src/extract/probe.ts";
import {
  compareSemver,
  isComposerPrerelease,
  isMavenPrerelease,
  isPep440Prerelease,
  isSemverPrerelease,
} from "../src/extract/versions.ts";
import { fileVersion } from "../src/adapters/pypi.ts";
import { escapeModulePath } from "../src/adapters/go.ts";
import { parseMetadata, pomUrl } from "../src/adapters/maven.ts";
import { packumentUrl } from "../src/adapters/npm.ts";

const AS_OF = new Date("2024-10-15T00:00:00Z");

describe("selectKeptVersions", () => {
  const records = [
    { version: "1.0", publishedAt: "2023-05-01T00:00:00Z" },
    { version: "1.1", publishedAt: "2024-02-01T00:00:00Z" },
    { version: "2.0rc1", publishedAt: "2024-05-01T00:00:00Z", prerelease: true },
    { version: "1.2", publishedAt: "2024-08-01T00:00:00Z", yanked: true },
    { version: "1.3", publishedAt: "2024-09-01T00:00:00Z" },
  ];

  test("keeps the latest plus one anchor per quarter, skipping pre-releases and yanked", () => {
    const kept = selectKeptVersions(records, "1.3", AS_OF);
    expect(kept.map((k) => [k.record.version, k.quarterAnchor, k.isLatest])).toEqual([
      ["1.1", "2024Q1,2024Q2", false],
      ["1.3", "2024Q3", true],
    ]);
  });

  test("keeps the registry's latest even when it anchors nothing", () => {
    const kept = selectKeptVersions(records, "2.0rc1", AS_OF);
    expect(kept.find((k) => k.isLatest)?.record.version).toBe("2.0rc1");
  });

  test("falls back to the newest stable release when the registry names none", () => {
    expect(selectKeptVersions(records, null, AS_OF).find((k) => k.isLatest)?.record.version).toBe("1.3");
  });

  test("a package first released after the backfill start anchors only later quarters", () => {
    const kept = selectKeptVersions([{ version: "0.1", publishedAt: "2024-06-01T00:00:00Z" }], "0.1", AS_OF);
    expect(kept[0]!.quarterAnchor).toBe("2024Q2,2024Q3");
  });
});

describe("probeAnchorDates", () => {
  const dates: Record<string, string> = {};
  const ordered = Array.from({ length: 200 }, (_, i) => {
    const v = `1.0.${i}`;
    dates[v] = new Date(Date.UTC(2022, 0, 1) + i * 5 * 86_400_000).toISOString();
    return v;
  });

  test("finds every quarter anchor with far fewer probes than releases", async () => {
    let calls = 0;
    const probed = await probeAnchorDates(ordered, async (v) => (calls++, dates[v]!), AS_OF);
    expect(calls).toBeLessThan(60);
    expect(calls).toBe(probed.size);

    const records = [...probed].map(([version, publishedAt]) => ({ version, publishedAt }));
    const viaProbe = selectKeptVersions(records, ordered.at(-1)!, AS_OF);
    const exhaustive = selectKeptVersions(
      ordered.map((v) => ({ version: v, publishedAt: dates[v]! })),
      ordered.at(-1)!,
      AS_OF,
    );
    expect(viaProbe.map((k) => [k.record.version, k.quarterAnchor])).toEqual(
      exhaustive.map((k) => [k.record.version, k.quarterAnchor]),
    );
  });

  test("an undated release is never chosen as an anchor", async () => {
    const probed = await probeAnchorDates(["a", "b", "c"], async (v) => (v === "c" ? null : "2023-01-01T00:00:00Z"), AS_OF);
    const kept = selectKeptVersions([...probed].map(([version, publishedAt]) => ({ version, publishedAt })), null, AS_OF);
    expect(kept.every((k) => k.record.version !== "c")).toBe(true);
  });

  test("empty history probes nothing", async () => {
    expect((await probeAnchorDates([], async () => null, AS_OF)).size).toBe(0);
  });
});

describe("version conventions", () => {
  test.each([
    ["1.0a1", true], ["2.0rc2", true], ["3.1.dev0", true], ["1.0b2.dev3", true], ["1.0.post1", false], ["2.31.0", false], ["2024.8.30", false], ["1.0c1", true],
  ])("PEP 440 %s pre-release=%p", (v, expected) => expect(isPep440Prerelease(v)).toBe(expected));

  test.each([
    ["1.2.3", false], ["1.2.3-rc.1", true], ["v2.0.0+incompatible", false], ["v0.0.0-20240101-abcdef", true],
  ])("SemVer %s pre-release=%p", (v, expected) => expect(isSemverPrerelease(v)).toBe(expected));

  test.each([
    ["33.4.8-jre", false], ["33.4.8-android", false], ["2.1.0-alpha1", true], ["5.0.0-M2", true],
    ["1.2.3.RELEASE", false], ["4.13.2", false], ["6.0.0.Beta3", true], ["1.0-SNAPSHOT", true],
  ])("Maven %s pre-release=%p", (v, expected) => expect(isMavenPrerelease(v)).toBe(expected));

  test.each([
    ["v3.0.2", false], ["3.0.0-beta1", true], ["2.0.0-RC2", true], ["dev-main", true], ["2.x-dev", true], ["1.0.0-p1", false],
  ])("Composer %s pre-release=%p", (v, expected) => expect(isComposerPrerelease(v)).toBe(expected));

  test("SemVer ordering follows the spec, not string order", () => {
    const sorted = ["v1.10.0", "v1.2.0", "v1.2.0-rc.1", "v1.2.0-beta.11", "v1.2.0-beta.2", "v1.9.9"].sort(compareSemver);
    expect(sorted).toEqual(["v1.2.0-beta.2", "v1.2.0-beta.11", "v1.2.0-rc.1", "v1.2.0", "v1.9.9", "v1.10.0"]);
  });
});

describe("PyPI fileVersion", () => {
  const versions = new Set(["1.0", "1.0.1", "2.8.2", "0.16.3"]);
  test.each([
    ["ruff-0.16.3-py3-none-win32.whl", "ruff", "0.16.3"],
    ["ruff-0.16.3.tar.gz", "ruff", "0.16.3"],
    ["python-dateutil-2.8.2.tar.gz", "python-dateutil", "2.8.2"],
    ["python_dateutil-2.8.2-py2.py3-none-any.whl", "python-dateutil", "2.8.2"],
    ["Foo.Bar-1.0.1.zip", "foo-bar", "1.0.1"],
    ["foo-1.0.win32.exe", "foo", "1.0"],
    ["unrelated-1.0.tar.gz", "foo", null],
  ])("%s -> %s", (file, project, expected) => {
    expect(fileVersion(file, project, versions)).toBe(expected);
  });
});

describe("URL helpers", () => {
  test("Go module paths escape uppercase letters", () => {
    expect(escapeModulePath("github.com/BurntSushi/toml")).toBe("github.com/!burnt!sushi/toml");
  });

  test("npm scoped names encode the slash", () => {
    expect(packumentUrl("@types/node")).toBe("https://registry.npmjs.org/@types%2Fnode");
    expect(packumentUrl("react")).toBe("https://registry.npmjs.org/react");
  });

  test("Maven coordinates map onto the repository layout", () => {
    expect(pomUrl("com.google.guava:guava", "33.4.8-jre")).toBe(
      "https://repo1.maven.org/maven2/com/google/guava/guava/33.4.8-jre/guava-33.4.8-jre.pom",
    );
  });

  test("maven-metadata.xml parsing keeps deploy order", () => {
    const xml = "<metadata><versioning><release>2.0</release><versions><version>1.0</version><version>2.0</version></versions></versioning></metadata>";
    expect(parseMetadata(xml)).toEqual({ versions: ["1.0", "2.0"], release: "2.0" });
  });

  test.each([
    ["git+https://github.com/sigstore/sigstore-js.git", "https://github.com/sigstore/sigstore-js"],
    ["git://github.com/a/b.git", "https://github.com/a/b"],
    ["git@github.com:a/b.git", "https://github.com/a/b"],
    ["github:a/b", "https://github.com/a/b"],
    ["https://github.com/a/b#readme", "https://github.com/a/b"],
    ["not a url", null],
    ["", null],
  ])("cleanRepoUrl(%s)", (input, expected) => expect(cleanRepoUrl(input)).toBe(expected));
});

describe("signal helpers", () => {
  test("a policy applies only on and after its effective date, and is unknown before", () => {
    const eff = "2024-01-01T00:00:00Z";
    expect(policySince("mfa_enforced", "2024-03-01T00:00:00Z", eff, "p").value).toBe("true");
    expect(policySince("mfa_enforced", "2023-03-01T00:00:00Z", eff, "p").value).toBe("unknown");
    expect(policySince("mfa_enforced", null, eff, "p").value).toBe("unknown");
  });

  test("earliest normalises and ignores unparseable timestamps", () => {
    expect(earliest(["2024-02-01T00:00:00Z", "garbage", null, "2024-01-01T00:00:00.5Z"])).toBe("2024-01-01T00:00:00.500Z");
    expect(earliest([])).toBeNull();
  });
});
