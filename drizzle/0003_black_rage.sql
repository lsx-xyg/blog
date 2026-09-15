-- 修改 media 表的 uploaded_by 列类型为 text（独立操作，不依赖 gallery_items）
ALTER TABLE "media" ALTER COLUMN "uploaded_by" SET DATA TYPE text;
--> statement-breakpoint
-- 以下操作都依赖 gallery_items 表，如果表不存在则跳过
DO $$
BEGIN
  -- 检查 gallery_items 表是否存在
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gallery_items') THEN
    -- 1. 删除约束（如果存在）
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gallery_items_media_id_media_id_fk') THEN
      ALTER TABLE "gallery_items" DROP CONSTRAINT "gallery_items_media_id_media_id_fk";
    END IF;

    -- 2. 修改 media_id 列为 NOT NULL（如果列存在）
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gallery_items' AND column_name = 'media_id') THEN
      ALTER TABLE "gallery_items" ALTER COLUMN "media_id" SET NOT NULL;
    END IF;

    -- 3. 重新添加约束（如果不存在）
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gallery_items_media_id_media_id_fk') THEN
      ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
    END IF;

    -- 4. 创建索引（如果不存在）
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'gallery_items_media_id_idx') THEN
      CREATE INDEX "gallery_items_media_id_idx" ON "gallery_items" USING btree ("media_id");
    END IF;

    -- 5. 删除 image_url 列（如果存在）
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gallery_items' AND column_name = 'image_url') THEN
      ALTER TABLE "gallery_items" DROP COLUMN "image_url";
    END IF;

    -- 6. 删除 storage_driver 列（如果存在）
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gallery_items' AND column_name = 'storage_driver') THEN
      ALTER TABLE "gallery_items" DROP COLUMN "storage_driver";
    END IF;

    -- 7. 删除 storage_key 列（如果存在）
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gallery_items' AND column_name = 'storage_key') THEN
      ALTER TABLE "gallery_items" DROP COLUMN "storage_key";
    END IF;
  END IF;
END$$;
