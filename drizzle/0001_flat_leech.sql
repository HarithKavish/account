CREATE TYPE "public"."account_type" AS ENUM('human', 'ai');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_type" "account_type" DEFAULT 'human' NOT NULL;--> statement-breakpoint
CREATE INDEX "users_account_type_idx" ON "users" USING btree ("account_type");