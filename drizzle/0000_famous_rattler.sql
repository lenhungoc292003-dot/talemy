CREATE TABLE `submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`candidate_name` text NOT NULL,
	`candidate_email` text DEFAULT '' NOT NULL,
	`candidate_code` text DEFAULT '' NOT NULL,
	`role` text NOT NULL,
	`round1_score` integer NOT NULL,
	`round1_total` integer NOT NULL,
	`round1_band` text NOT NULL,
	`round1_breakdown` text NOT NULL,
	`round2_overall` integer,
	`round2_scores` text,
	`round2_feedback` text,
	`round2_answers` text,
	`chat_transcript` text,
	`grading_version` text NOT NULL,
	`completed_at` text NOT NULL,
	`created_at` text NOT NULL
);
