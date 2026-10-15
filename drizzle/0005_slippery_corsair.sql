CREATE TABLE `advisories` (
	`snapshot_id` text NOT NULL,
	`advisory_id` text NOT NULL,
	`aliases` text DEFAULT '[]' NOT NULL,
	`published` text,
	`modified` text NOT NULL,
	`withdrawn` text,
	`malicious` integer NOT NULL,
	`summary` text,
	`response` text NOT NULL,
	PRIMARY KEY(`snapshot_id`, `advisory_id`)
);
--> statement-breakpoint
CREATE TABLE `advisory_matches` (
	`snapshot_id` text NOT NULL,
	`ecosystem` text NOT NULL,
	`package_name` text NOT NULL,
	`version` text NOT NULL,
	`advisory_id` text NOT NULL,
	`released_at` text,
	`responses` text DEFAULT '[]' NOT NULL,
	PRIMARY KEY(`snapshot_id`, `ecosystem`, `package_name`, `version`, `advisory_id`),
	FOREIGN KEY (`snapshot_id`,`ecosystem`,`package_name`) REFERENCES `packages`(`snapshot_id`,`ecosystem`,`package_name`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`snapshot_id`,`advisory_id`) REFERENCES `advisories`(`snapshot_id`,`advisory_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "advisory_matches_ecosystem" CHECK(ecosystem IN ('pypi', 'npm', 'crates', 'rubygems', 'go', 'maven', 'packagist'))
);
--> statement-breakpoint
CREATE INDEX `idx_adv_match_advisory` ON `advisory_matches` (`snapshot_id`,`advisory_id`);--> statement-breakpoint
ALTER TABLE `package_versions` ADD `purl` text;--> statement-breakpoint
ALTER TABLE `packages` ADD `osv_queried_at` text;