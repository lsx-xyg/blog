ALTER TABLE "gallery_items" DROP CONSTRAINT "gallery_items_media_id_media_id_fk";
--> statement-breakpoint
ALTER TABLE "gallery_items" ALTER COLUMN "media_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ALTER COLUMN "uploaded_by" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gallery_items_media_id_idx" ON "gallery_items" USING btree ("media_id");--> statement-breakpoint
ALTER TABLE "gallery_items" DROP COLUMN "image_url";--> statement-breakpoint
ALTER TABLE "gallery_items" DROP COLUMN "storage_driver";--> statement-breakpoint
ALTER TABLE "gallery_items" DROP COLUMN "storage_key";