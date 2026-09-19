-- 以下操作都依赖 gallery_items 表，如果表不存在则跳过
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gallery_items') THEN
    -- 添加 storage_driver 列（如果不存在）
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gallery_items' AND column_name = 'storage_driver') THEN
      ALTER TABLE "gallery_items" ADD COLUMN "storage_driver" text DEFAULT 'LOCAL' NOT NULL;
    END IF;

    -- 添加 storage_key 列（如果不存在）
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gallery_items' AND column_name = 'storage_key') THEN
      ALTER TABLE "gallery_items" ADD COLUMN "storage_key" text;
    END IF;
  END IF;
END$$;
