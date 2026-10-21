CREATE TABLE `sample_members` (
	`snapshot_id` text NOT NULL,
	`layer` text NOT NULL,
	`ecosystem` text NOT NULL,
	`package_name` text NOT NULL,
	`rank_frame` text NOT NULL,
	`rank` integer NOT NULL,
	`download_count` integer,
	`dependent_count` integer,
	PRIMARY KEY(`snapshot_id`, `layer`, `ecosystem`, `package_name`),
	FOREIGN KEY (`snapshot_id`,`ecosystem`,`package_name`) REFERENCES `packages`(`snapshot_id`,`ecosystem`,`package_name`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sample_members_layer" CHECK(layer IN ('top', 'random')),
	CONSTRAINT "sample_members_ecosystem" CHECK(ecosystem IN ('pypi', 'npm', 'crates', 'rubygems', 'go', 'maven', 'packagist')),
	CONSTRAINT "sample_members_rank_frame" CHECK(rank_frame IN ('downloads', 'dependents', 'random')),
	CONSTRAINT "sample_members_rank_positive" CHECK(rank >= 1),
	CONSTRAINT "sample_members_counts_non_negative" CHECK((download_count IS NULL OR download_count >= 0) AND (dependent_count IS NULL OR dependent_count >= 0))
);
--> statement-breakpoint
CREATE INDEX `idx_member_layer` ON `sample_members` (`snapshot_id`,`layer`,`ecosystem`);--> statement-breakpoint
-- Every package sampled before layers existed came from the ranking: the top layer.
INSERT INTO `sample_members`("snapshot_id", "layer", "ecosystem", "package_name", "rank_frame", "rank", "download_count", "dependent_count") SELECT "snapshot_id", 'top', "ecosystem", "package_name", "rank_frame", "rank", "download_count", "dependent_count" FROM `packages`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_packages` (
	`snapshot_id` text NOT NULL,
	`ecosystem` text NOT NULL,
	`package_name` text NOT NULL,
	`latest_version` text,
	`latest_publish_date` text,
	`maintainer_count` integer,
	`maintainer_count_source` text,
	`repository_url` text,
	`fetch_timestamp` text,
	`fetch_error` text,
	`extract_error` text,
	`osv_queried_at` text,
	PRIMARY KEY(`snapshot_id`, `ecosystem`, `package_name`),
	FOREIGN KEY (`snapshot_id`) REFERENCES `snapshots`(`snapshot_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "packages_ecosystem" CHECK(ecosystem IN ('pypi', 'npm', 'crates', 'rubygems', 'go', 'maven', 'packagist')),
	CONSTRAINT "packages_maintainer_count_non_negative" CHECK(maintainer_count IS NULL OR maintainer_count >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_packages`("snapshot_id", "ecosystem", "package_name", "latest_version", "latest_publish_date", "maintainer_count", "maintainer_count_source", "repository_url", "fetch_timestamp", "fetch_error", "extract_error", "osv_queried_at") SELECT "snapshot_id", "ecosystem", "package_name", "latest_version", "latest_publish_date", "maintainer_count", "maintainer_count_source", "repository_url", "fetch_timestamp", "fetch_error", "extract_error", "osv_queried_at" FROM `packages`;--> statement-breakpoint
DROP TABLE `packages`;--> statement-breakpoint
ALTER TABLE `__new_packages` RENAME TO `packages`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_pkg_eco` ON `packages` (`snapshot_id`,`ecosystem`);