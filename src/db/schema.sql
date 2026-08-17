-- Cross-ecosystem package trust signal scraper.
-- Every signal row is traceable to an endpoint + JSON path (signal_source) and to a
-- byte-exact cached response (raw_sha256). That traceability is what makes the paper's
-- methodology section defensible; see docs/IMPLEMENTATION_PLAN.md §4.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS snapshots (
  snapshot_id  TEXT PRIMARY KEY,
  started_at   TEXT NOT NULL,
  finished_at  TEXT,
  tool_version TEXT NOT NULL,
  config_json  TEXT NOT NULL
);

-- Hand-curated from primary sources, not scraped. Filled in M7 with citations.
CREATE TABLE IF NOT EXISTS ecosystem_facts (
  ecosystem                    TEXT PRIMARY KEY,
  display_name                 TEXT NOT NULL,
  registry_url                 TEXT NOT NULL,
  mandates_2fa                 INTEGER,          -- nullable: unknown until cited
  mfa_policy_note              TEXT,
  trusted_publishing_ga_date   TEXT,
  trusted_publishing_mechanism TEXT,
  notes                        TEXT,
  sources                      TEXT              -- newline-separated citation URLs
);

-- Whether each ecosystem exposes each signal at all. This is what lets the maturity
-- matrix distinguish "0% adoption" from "the registry will not tell us".
CREATE TABLE IF NOT EXISTS signal_availability (
  ecosystem        TEXT NOT NULL,
  signal_id        TEXT NOT NULL,
  availability     TEXT NOT NULL
    CHECK (availability IN ('observable','inferred','not_exposed','no_mechanism')),
  mandatory        INTEGER NOT NULL DEFAULT 0,   -- registry-wide requirement, e.g. Maven .asc
  detection_method TEXT,                          -- endpoint + field
  notes            TEXT,
  PRIMARY KEY (ecosystem, signal_id)
);

CREATE TABLE IF NOT EXISTS packages (
  snapshot_id             TEXT NOT NULL REFERENCES snapshots(snapshot_id),
  ecosystem               TEXT NOT NULL,
  package_name            TEXT NOT NULL,
  rank_frame              TEXT NOT NULL CHECK (rank_frame IN ('downloads','dependents')),
  rank                    INTEGER NOT NULL,
  download_count          INTEGER,
  dependent_count         INTEGER,
  latest_version          TEXT,
  latest_publish_date     TEXT,
  maintainer_count        INTEGER,
  maintainer_count_source TEXT,
  repository_url          TEXT,
  fetch_timestamp         TEXT,
  -- Populated instead of dropping the row, so partial failures stay visible in the data.
  fetch_error             TEXT,
  PRIMARY KEY (snapshot_id, ecosystem, package_name)
);

CREATE TABLE IF NOT EXISTS package_versions (
  snapshot_id       TEXT NOT NULL,
  ecosystem         TEXT NOT NULL,
  package_name      TEXT NOT NULL,
  version           TEXT NOT NULL,
  published_at      TEXT,
  is_latest         INTEGER NOT NULL DEFAULT 0,
  quarter_anchor    TEXT,                        -- '2024Q1' … , NULL if not an anchor
  raw_response_path TEXT,
  raw_sha256        TEXT,
  PRIMARY KEY (snapshot_id, ecosystem, package_name, version),
  FOREIGN KEY (snapshot_id, ecosystem, package_name)
    REFERENCES packages(snapshot_id, ecosystem, package_name)
);

-- Tidy/long format: one row per version per signal. Five nullable wide columns would be
-- awkward to aggregate and would need a migration to add a sixth signal.
CREATE TABLE IF NOT EXISTS version_signals (
  snapshot_id   TEXT NOT NULL,
  ecosystem     TEXT NOT NULL,
  package_name  TEXT NOT NULL,
  version       TEXT NOT NULL,
  signal_id     TEXT NOT NULL,
  value         TEXT NOT NULL CHECK (value IN ('true','false','unknown')),
  evidence      TEXT,
  signal_source TEXT NOT NULL,
  PRIMARY KEY (snapshot_id, ecosystem, package_name, version, signal_id),
  FOREIGN KEY (snapshot_id, ecosystem, package_name, version)
    REFERENCES package_versions(snapshot_id, ecosystem, package_name, version)
);

CREATE INDEX IF NOT EXISTS idx_pkg_eco      ON packages(snapshot_id, ecosystem);
CREATE INDEX IF NOT EXISTS idx_ver_latest   ON package_versions(snapshot_id, ecosystem, is_latest);
CREATE INDEX IF NOT EXISTS idx_ver_anchor   ON package_versions(snapshot_id, ecosystem, quarter_anchor);
CREATE INDEX IF NOT EXISTS idx_sig_lookup   ON version_signals(snapshot_id, ecosystem, signal_id, value);
