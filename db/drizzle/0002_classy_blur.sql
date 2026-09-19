-- 1. 创建 media_type 枚举类型（PostgreSQL 不支持 CREATE TYPE IF NOT EXISTS，用 DO 块）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_type') THEN
    CREATE TYPE "public"."media_type" AS ENUM('ARTICLE', 'GALLERY');
  END IF;
END$$;
--> statement-breakpoint
-- 2. 创建 media 表（如果不存在）
CREATE TABLE IF NOT EXISTS "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "media_type" NOT NULL,
	"url" text NOT NULL,
	"storage_driver" text DEFAULT 'LOCAL' NOT NULL,
	"storage_key" text,
	"title" text,
	"description" text,
	"mime_type" text,
	"size" integer,
	"width" integer,
	"height" integer,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- 3. 创建索引（如果不存在）
CREATE INDEX IF NOT EXISTS "media_type_idx" ON "media" USING btree ("type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_storage_driver_idx" ON "media" USING btree ("storage_driver");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_created_at_idx" ON "media" USING btree ("created_at");
--> statement-breakpoint
-- 4. 以下操作都依赖 gallery_items 表，如果表不存在则跳过
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gallery_items') THEN
    -- 添加 media_id 列（如果不存在）
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gallery_items' AND column_name = 'media_id') THEN
      ALTER TABLE "gallery_items" ADD COLUMN "media_id" uuid;
    END IF;

    -- 添加外键约束（如果不存在）
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gallery_items_media_id_media_id_fk') THEN
      ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    END IF;
  END IF;
END$$;
