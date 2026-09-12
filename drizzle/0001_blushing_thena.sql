ALTER TABLE "gallery_items" ADD COLUMN "storage_driver" text DEFAULT 'LOCAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "gallery_items" ADD COLUMN "storage_key" text;