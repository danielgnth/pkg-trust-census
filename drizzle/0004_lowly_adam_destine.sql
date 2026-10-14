ALTER TABLE `version_signals` ADD `responses` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `package_versions` DROP COLUMN `raw_response_path`;--> statement-breakpoint
ALTER TABLE `package_versions` DROP COLUMN `raw_sha256`;