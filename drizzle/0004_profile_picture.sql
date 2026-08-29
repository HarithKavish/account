ALTER TABLE "user_identities" ADD COLUMN "picture_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "picture_source" text DEFAULT 'none' NOT NULL;