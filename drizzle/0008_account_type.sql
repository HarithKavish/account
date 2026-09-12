-- account_type (human | ai) — Phase 1 of the human/agent platform.
--
-- Written idempotently, on purpose. This change was first generated on a
-- branch that had forked before 0001_authentication, as `0001_flat_leech`,
-- and applied to production from there. That file is gone (it collided with
-- the real 0001) but the row it wrote to `__drizzle_migrations` is not, and
-- the column it added is already live.
--
-- drizzle's migrator decides what to run by comparing timestamps, not by
-- hashing files, so it cannot know this one is already applied. The guards
-- below are what make replaying it a no-op instead of a failed deploy, while
-- keeping it correct against a database that has never seen it.

DO $$ BEGIN
 CREATE TYPE "public"."account_type" AS ENUM('human', 'ai');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "account_type" "public"."account_type" DEFAULT 'human' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_account_type_idx" ON "users" USING btree ("account_type");
