CREATE TABLE `package_withdrawals` (
	`snapshot_id` text NOT NULL,
	`ecosystem` text NOT NULL,
	`package_name` text NOT NULL,
	`kind` text NOT NULL,
	`versions_in_window` integer,
	`withdrawn_count` integer NOT NULL,
	`withdrawn_versions` text NOT NULL,
	PRIMARY KEY(`snapshot_id`, `ecosystem`, `package_name`, `kind`),
	FOREIGN KEY (`snapshot_id`,`ecosystem`,`package_name`) REFERENCES `packages`(`snapshot_id`,`ecosystem`,`package_name`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "package_withdrawals_ecosystem" CHECK(ecosystem IN ('pypi', 'npm', 'crates', 'rubygems', 'go', 'maven', 'packagist')),
	CONSTRAINT "package_withdrawals_kind" CHECK(kind IN ('yanked', 'unpublished', 'deprecated', 'retracted')),
	CONSTRAINT "package_withdrawals_counts" CHECK(withdrawn_count >= 0 AND (versions_in_window IS NULL OR versions_in_window >= withdrawn_count))
);
