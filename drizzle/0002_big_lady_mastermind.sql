PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_signal_availability` (
	`ecosystem` text NOT NULL,
	`signal_id` text NOT NULL,
	`availability` text NOT NULL,
	`mandatory` integer DEFAULT false NOT NULL,
	`detection_method` text,
	`notes` text,
	PRIMARY KEY(`ecosystem`, `signal_id`),
	CONSTRAINT "signal_availability_ecosystem" CHECK(ecosystem IN ('pypi', 'npm', 'crates', 'rubygems', 'go', 'maven', 'packagist')),
	CONSTRAINT "signal_availability_signal" CHECK(signal_id IN ('identity_publish', 'artifact_signature', 'registry_integrity', 'build_provenance', 'source_link', 'transparency_log', 'mfa_enforced')),
	CONSTRAINT "signal_availability_value" CHECK(availability IN ('observable', 'inferred', 'not_exposed', 'no_mechanism'))
);
--> statement-breakpoint
INSERT INTO `__new_signal_availability`("ecosystem", "signal_id", "availability", "mandatory", "detection_method", "notes") SELECT "ecosystem", "signal_id", "availability", "mandatory", "detection_method", "notes" FROM `signal_availability`;--> statement-breakpoint
DROP TABLE `signal_availability`;--> statement-breakpoint
ALTER TABLE `__new_signal_availability` RENAME TO `signal_availability`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_version_signals` (
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
	CONSTRAINT "version_signals_signal" CHECK(signal_id IN ('identity_publish', 'artifact_signature', 'registry_integrity', 'build_provenance', 'source_link', 'transparency_log', 'mfa_enforced')),
	CONSTRAINT "version_signals_value" CHECK(value IN ('true', 'false', 'unknown'))
);
--> statement-breakpoint
INSERT INTO `__new_version_signals`("snapshot_id", "ecosystem", "package_name", "version", "signal_id", "value", "evidence", "signal_source") SELECT "snapshot_id", "ecosystem", "package_name", "version", "signal_id", "value", "evidence", "signal_source" FROM `version_signals`;--> statement-breakpoint
DROP TABLE `version_signals`;--> statement-breakpoint
ALTER TABLE `__new_version_signals` RENAME TO `version_signals`;--> statement-breakpoint
CREATE INDEX `idx_sig_lookup` ON `version_signals` (`snapshot_id`,`ecosystem`,`signal_id`,`value`);