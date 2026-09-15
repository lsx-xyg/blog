ALTER TABLE "media_tags" DROP CONSTRAINT IF EXISTS "media_tags_media_id_posts_id_fk";
--> statement-breakpoint
ALTER TABLE "media" ALTER COLUMN "storage_driver" SET DEFAULT 'LOCAL';--> statement-breakpoint
ALTER TABLE "media_tags" ADD CONSTRAINT IF NOT EXISTS "media_tags_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;