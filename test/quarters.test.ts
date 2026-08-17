import { describe, expect, test } from "bun:test";
import {
  anchorLabelsByVersion,
  quarterBoundaries,
  selectQuarterAnchors,
} from "../src/extract/quarters.ts";

const until = new Date("2024-12-31T00:00:00Z");

describe("quarterBoundaries", () => {
  test("emits quarter-end boundaries from the backfill start", () => {
    expect(quarterBoundaries(until).map((q) => q.label)).toEqual([
      "2024Q1",
      "2024Q2",
      "2024Q3",
    ]);
  });

  test("2024Q1 closes at 1 April, not 1 January", () => {
    const q1 = quarterBoundaries(until).find((q) => q.label === "2024Q1")!;
    expect(q1.at.toISOString()).toBe("2024-04-01T00:00:00.000Z");
  });

  test("rolls into the next year", () => {
    const labels = quarterBoundaries(new Date("2025-07-01T00:00:00Z")).map((q) => q.label);
    expect(labels).toContain("2024Q4");
    expect(labels).toContain("2025Q1");
  });
});

describe("selectQuarterAnchors", () => {
  const versions = [
    { version: "1.0.0", publishedAt: "2024-02-01T00:00:00Z" },
    { version: "1.1.0", publishedAt: "2024-03-20T00:00:00Z" },
    { version: "2.0.0", publishedAt: "2024-08-15T00:00:00Z" },
  ];

  test("picks the newest version at or before each boundary", () => {
    const a = selectQuarterAnchors(versions, until);
    expect(a.get("2024Q1")?.version).toBe("1.1.0");
    // Nothing shipped in Q2, so the Q1 release is still what you would have installed.
    expect(a.get("2024Q2")?.version).toBe("1.1.0");
    expect(a.get("2024Q3")?.version).toBe("2.0.0");
  });

  test("leaves quarters before the first release unanchored", () => {
    const late = [{ version: "1.0.0", publishedAt: "2024-09-01T00:00:00Z" }];
    const a = selectQuarterAnchors(late, until);
    expect(a.has("2024Q1")).toBe(false);
    expect(a.has("2024Q2")).toBe(false);
    expect(a.get("2024Q3")?.version).toBe("1.0.0");
  });

  test("ignores versions with missing or unparseable dates", () => {
    const messy = [
      { version: "0.9.0", publishedAt: null },
      { version: "0.9.1", publishedAt: "not-a-date" },
      { version: "1.0.0", publishedAt: "2024-02-01T00:00:00Z" },
    ];
    expect(selectQuarterAnchors(messy, until).get("2024Q1")?.version).toBe("1.0.0");
  });

  test("tolerates out-of-order input", () => {
    const shuffled = [versions[2]!, versions[0]!, versions[1]!];
    expect(selectQuarterAnchors(shuffled, until).get("2024Q1")?.version).toBe("1.1.0");
  });

  test("returns nothing for a package with no dated releases", () => {
    expect(selectQuarterAnchors([{ version: "1.0.0", publishedAt: null }], until).size).toBe(0);
  });
});

describe("anchorLabelsByVersion", () => {
  test("collapses the quarters a single version anchors", () => {
    const labels = anchorLabelsByVersion(selectQuarterAnchors(
      [
        { version: "1.1.0", publishedAt: "2024-03-20T00:00:00Z" },
        { version: "2.0.0", publishedAt: "2024-08-15T00:00:00Z" },
      ],
      until,
    ));
    expect(labels.get("1.1.0")).toBe("2024Q1,2024Q2");
    expect(labels.get("2.0.0")).toBe("2024Q3");
  });
});
