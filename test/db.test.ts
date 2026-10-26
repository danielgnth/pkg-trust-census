import { describe, expect, test } from "bun:test";
import { closeDb, ensureSnapshot, newSnapshotId, openDb } from "../src/db/open.ts";
import { packageVersions, packages, sampleMembers, snapshots, versionSignals } from "../src/db/schema.ts";

function freshDb() {
  const db = openDb(":memory:");
  ensureSnapshot(db, "snap-1");
  return db;
}

const pkg = {
  snapshotId: "snap-1",
  ecosystem: "pypi",
  packageName: "requests",
};

const member = { ...pkg, layer: "top", rankFrame: "downloads", rank: 1, downloadCount: 10 };

describe("migrations", () => {
  test("open creates every table", () => {
    const db = freshDb();
    // A trivial select per table proves the migration ran and the shape matches.
    expect(db.select().from(snapshots).all()).toHaveLength(1);
    expect(db.select().from(packages).all()).toHaveLength(0);
    expect(db.select().from(packageVersions).all()).toHaveLength(0);
    expect(db.select().from(versionSignals).all()).toHaveLength(0);
    closeDb(db);
  });

  test("opening twice is idempotent", () => {
    const db = openDb(":memory:");
    expect(() => openDb(":memory:")).not.toThrow();
    closeDb(db);
  });
});

/**
 * The zod layer produces readable errors, but it can be bypassed by writing through
 * Drizzle directly. These assert the database is the backstop, not the only guard.
 */
describe("CHECK constraints (defence in depth)", () => {
  test("rejects an ecosystem outside the seven", () => {
    const db = freshDb();
    expect(() =>
      db.insert(packages).values({ ...pkg, ecosystem: "cargo" }).run(),
    ).toThrow(/CHECK/i);
    closeDb(db);
  });

  test("rejects a rank below 1", () => {
    const db = freshDb();
    db.insert(packages).values(pkg).run();
    expect(() => db.insert(sampleMembers).values({ ...member, rank: 0 }).run()).toThrow(/CHECK/i);
    closeDb(db);
  });

  test("rejects a negative download count", () => {
    const db = freshDb();
    db.insert(packages).values(pkg).run();
    expect(() =>
      db.insert(sampleMembers).values({ ...member, downloadCount: -1 }).run(),
    ).toThrow(/CHECK/i);
    closeDb(db);
  });

  test("rejects a rank frame outside the three", () => {
    const db = freshDb();
    db.insert(packages).values(pkg).run();
    expect(() =>
      db.insert(sampleMembers).values({ ...member, rankFrame: "stars" }).run(),
    ).toThrow(/CHECK/i);
    closeDb(db);
  });

  test("rejects a sample layer outside the two", () => {
    const db = freshDb();
    db.insert(packages).values(pkg).run();
    expect(() => db.insert(sampleMembers).values({ ...member, layer: "stratified" }).run()).toThrow(/CHECK/i);
    closeDb(db);
  });

  test("rejects a signal value outside the three states", () => {
    const db = freshDb();
    db.insert(packages).values(pkg).run();
    db.insert(packageVersions)
      .values({ ...pkg, version: "2.34.2", isLatest: true })
      .run();

    expect(() =>
      db
        .insert(versionSignals)
        .values({
          snapshotId: "snap-1",
          ecosystem: "pypi",
          packageName: "requests",
          version: "2.34.2",
          signalId: "build_provenance",
          value: "probably",
          signalSource: "test",
        })
        .run(),
    ).toThrow(/CHECK/i);
    closeDb(db);
  });

  test("rejects a signal id outside the five dimensions", () => {
    const db = freshDb();
    db.insert(packages).values(pkg).run();
    db.insert(packageVersions).values({ ...pkg, version: "2.34.2" }).run();

    expect(() =>
      db
        .insert(versionSignals)
        .values({
          snapshotId: "snap-1",
          ecosystem: "pypi",
          packageName: "requests",
          version: "2.34.2",
          signalId: "has_sbom",
          value: "true",
          signalSource: "test",
        })
        .run(),
    ).toThrow(/CHECK/i);
    closeDb(db);
  });
});

describe("foreign keys", () => {
  test("a sample member cannot reference a missing package", () => {
    const db = freshDb();
    expect(() => db.insert(sampleMembers).values(member).run()).toThrow(/FOREIGN KEY/i);
    closeDb(db);
  });

  test("a package cannot reference a missing snapshot", () => {
    const db = freshDb();
    expect(() =>
      db.insert(packages).values({ ...pkg, snapshotId: "nope" }).run(),
    ).toThrow(/FOREIGN KEY/i);
    closeDb(db);
  });

  test("a version cannot reference a missing package", () => {
    const db = freshDb();
    expect(() =>
      db.insert(packageVersions).values({ ...pkg, version: "1.0.0" }).run(),
    ).toThrow(/FOREIGN KEY/i);
    closeDb(db);
  });

  test("a signal cannot reference a missing version", () => {
    const db = freshDb();
    db.insert(packages).values(pkg).run();
    expect(() =>
      db
        .insert(versionSignals)
        .values({
          snapshotId: "snap-1",
          ecosystem: "pypi",
          packageName: "requests",
          version: "does-not-exist",
          signalId: "build_provenance",
          value: "true",
          signalSource: "test",
        })
        .run(),
    ).toThrow(/FOREIGN KEY/i);
    closeDb(db);
  });
});

describe("ensureSnapshot", () => {
  test("is idempotent", () => {
    const db = openDb(":memory:");
    ensureSnapshot(db, "s1");
    ensureSnapshot(db, "s1");
    expect(db.select().from(snapshots).all()).toHaveLength(1);
    closeDb(db);
  });

  test("stores config as JSON", () => {
    const db = openDb(":memory:");
    ensureSnapshot(db, "s1", { n: 50, ecosystems: ["pypi"] });
    const row = db.select().from(snapshots).get()!;
    expect(JSON.parse(row.configJson)).toEqual({ n: 50, ecosystems: ["pypi"] });
    closeDb(db);
  });
});

describe("newSnapshotId", () => {
  test("is sortable and filesystem-safe", () => {
    const a = newSnapshotId(new Date("2026-08-17T15:33:00Z"));
    const b = newSnapshotId(new Date("2026-09-01T09:00:00Z"));
    expect(a).toBe("20260817-1533Z");
    expect(a < b).toBe(true);
    expect(a).not.toMatch(/[:/]/);
  });
});
