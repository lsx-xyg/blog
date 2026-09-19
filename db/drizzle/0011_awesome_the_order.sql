CREATE TABLE "guide_step_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guide_key" text NOT NULL,
	"step_id" text NOT NULL,
	"selector" text NOT NULL,
	"selector_source" text DEFAULT 'unknown' NOT NULL,
	"page" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "guide_step_events_guide_step_idx" ON "guide_step_events" USING btree ("guide_key","step_id");--> statement-breakpoint
CREATE INDEX "guide_step_events_created_idx" ON "guide_step_events" USING btree ("created_at");