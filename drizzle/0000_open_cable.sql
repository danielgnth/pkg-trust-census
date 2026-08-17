CREATE TABLE `ecosystem_facts` (
	`ecosystem` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`registry_url` text NOT NULL,
	`mandates_2fa` integer,
	`mfa_policy_note` text,
	`trusted_publishing_ga_date` text,
	`trusted_publishing_mechanism` text,
	`notes` text,
	`sources` text,
	CONSTRAINT "ecosystem_facts_ecosystem" CHECK(ecosystem IN ('pypi', 'npm', 'crates', 'rubygems', 'go', 'maven', 'packagist'))
);
--> statement-breakpoint
CREATE TABLE `package_versions` (
	`snapshot_id` text NOT NULL,
	`ecosystem` text NOT NULL,
	`package_name` text NOT NULL,
	`version` text NOT NULL,
	`published_at` text,
	`is_latest` integer DEFAULT false NOT NULL,
	`quarter_anchor` text,
	`raw_response_path` text,
	`raw_sha256` text,
	PRIMARY KEY(`snapshot_id`, `ecosystem`, `package_name`, `version`),
	FOREIGN KEY (`snapshot_id`,`ecosystem`,`package_name`) REFERENCES `packages`(`snapshot_id`,`ecosystem`,`package_name`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "package_versions_ecosystem" CHECK(ecosystem IN ('pypi', 'npm', 'crates', 'rubygems', 'go', 'maven', 'packagist'))
);
--> statement-breakpoint
CREATE INDEX `idx_ver_latest` ON `package_versions` (`snapshot_id`,`ecosystem`,`is_latest`);--> statement-breakpoint
CREATE INDEX `idx_ver_anchor` ON `package_versions` (`snapshot_id`,`ecosystem`,`quarter_anchor`);--> statement-breakpoint
CREATE TABLE `packages` (
	`snapshot_id` text NOT NULL,
	`ecosystem` text NOT NULL,
	`package_name` text NOT NULL,
	`rank_frame` text NOT NULL,
	`rank` integer NOT NULL,
	`download_count` integer,
	`dependent_count` integer,
	`latest_version` text,
	`latest_publish_date` text,
	`maintainer_count` integer,
	`maintainer_count_source` text,
	`repository_url` text,
	`fetch_timestamp` text,
	`fetch_error` text,
	PRIMARY KEY(`snapshot_id`, `ecosystem`, `package_name`),
	FOREIGN KEY (`snapshot_id`) REFERENCES `snapshots`(`snapshot_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "packages_ecosystem" CHECK(ecosystem IN ('pypi', 'npm', 'crates', 'rubygems', 'go', 'maven', 'packagist')),
	CONSTRAINT "packages_rank_frame" CHECK(rank_frame IN ('downloads', 'dependents')),
	CONSTRAINT "packages_rank_positive" CHECK(rank >= 1),
	CONSTRAINT "packages_counts_non_negative" CHECK((download_count IS NULL OR download_count >= 0) AND (dependent_count IS NULL OR dependent_count >= 0)),
	CONSTRAINT "packages_maintainer_count_non_negative" CHECK(maintainer_count IS NULL OR maintainer_count >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_pkg_eco` ON `packages` (`snapshot_id`,`ecosystem`);--> statement-breakpoint
CREATE TABLE `signal_availability` (
	`ecosystem` text NOT NULL,
	`signal_id` text NOT NULL,
	`availability` text NOT NULL,
	`mandatory` integer DEFAULT false NOT NULL,
	`detection_method` text,
	`notes` text,
	PRIMARY KEY(`ecosystem`, `signal_id`),
	CONSTRAINT "signal_availability_ecosystem" CHECK(ecosystem IN ('pypi', 'npm', 'crates', 'rubygems', 'go', 'maven', 'packagist')),
	CONSTRAINT "signal_availability_signal" CHECK(signal_id IN ('identity_publish', 'artifact_signature', 'build_provenance', 'transparency_log', 'mfa_enforced')),
	CONSTRAINT "signal_availability_value" CHECK(availability IN ('observable', 'inferred', 'not_exposed', 'no_mechanism'))
);
--> statement-breakpoint
CREATE TABLE `snapshots` (
	`snapshot_id` text PRIMARY KEY NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`tool_version` text NOT NULL,
	`config_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `version_signals` (
	`snapshot_id` text NOT NULL,
	`ecosystem` text NOT NULL,
	`package_name` text NOT NULL,
	`version` text NOT NULL,
	`signal_id` text NOT NULL,
	`value` text NOT NULL,
	`evidence` text,
	`signal_source` text NOT NULL,
	PRIMARY KEY(`snapshot_id`, `ecosystem`, `package_name`, `version`, `signal_id`),
	FOREIGN KEY (`snapshot_id`,`ecosystem`,`package_name`,`version`) REFERENCES `package_versions`(`snapshot_id`,`ecosystem`,`package_name`,`version`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "version_signals_ecosystem" CHECK(ecosystem IN ('pypi', 'npm', 'crates', 'rubygems', 'go', 'maven', 'packagist')),
	CONSTRAINT "version_signals_signal" CHECK(signal_id IN ('identity_publish', 'artifact_signature', 'build_provenance', 'transparency_log', 'mfa_enforced')),
	CONSTRAINT "version_signals_value" CHECK(value IN ('true', 'false', 'unknown'))
);
--> statement-breakpoint
CREATE INDEX `idx_sig_lookup` ON `version_signals` (`snapshot_id`,`ecosystem`,`signal_id`,`value`);