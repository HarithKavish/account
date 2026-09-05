ALTER TABLE "users" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_verified_unique" ON "users" USING btree ("email") WHERE "users"."email_verified_at" is not null;