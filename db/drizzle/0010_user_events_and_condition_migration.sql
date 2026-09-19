CREATE TABLE "user_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"event" text NOT NULL,
	"target" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_events" ADD CONSTRAINT "user_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_events_user_target_idx" ON "user_events" USING btree ("user_id","event","target");--> statement-breakpoint
-- 存量 target_condition 归一化：v1 旧格式 {event,page} → {logic,conditions[]}
-- 事件名映射：reveal-click（旧业务事件名）→ reveal-view（锚点值，新统一标识）
UPDATE "guiders"
SET "target_condition" = jsonb_build_object(
  'logic', 'and',
  'conditions', jsonb_build_array(
    CASE
      WHEN "target_condition"->>'event' = 'reveal-click' THEN
        jsonb_build_object('field','event_click','op','eq','value','reveal-view')
      WHEN "target_condition"->>'event' IS NOT NULL THEN
        jsonb_build_object('field','event_click','op','eq','value', "target_condition"->>'event')
      ELSE NULL
    END,
    CASE WHEN "target_condition"->>'page' IS NOT NULL THEN
      jsonb_build_object('field','page','op','eq','value', "target_condition"->>'page')
      ELSE NULL
    END
  )
)
WHERE "target_condition" IS NOT NULL AND "target_condition"->>'event' IS NOT NULL;
