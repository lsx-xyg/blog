CREATE TYPE "public"."guide_progress_status" AS ENUM('not_started', 'in_progress', 'completed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."guide_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "guiders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guide_key" text NOT NULL,
	"title" text NOT NULL,
	"page" text NOT NULL,
	"steps" jsonb NOT NULL,
	"status" "guide_status" DEFAULT 'draft' NOT NULL,
	"target_condition" jsonb,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guiders_guide_key_unique" UNIQUE("guide_key")
);
--> statement-breakpoint
CREATE TABLE "user_guide_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"guide_key" text NOT NULL,
	"status" "guide_progress_status" DEFAULT 'not_started' NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_guide_progress" ADD CONSTRAINT "user_guide_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guiders_status_idx" ON "guiders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "guiders_page_idx" ON "guiders" USING btree ("page");--> statement-breakpoint
CREATE UNIQUE INDEX "user_guide_progress_user_guide_key_unique" ON "user_guide_progress" USING btree ("user_id","guide_key");--> statement-breakpoint
CREATE INDEX "user_guide_progress_status_idx" ON "user_guide_progress" USING btree ("status");