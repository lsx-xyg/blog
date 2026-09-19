-- 1. 删除错误的约束（如果存在）
ALTER TABLE "media_tags" DROP CONSTRAINT IF EXISTS "media_tags_media_id_posts_id_fk";
--> statement-breakpoint
-- 2. 修改 media 表的 storage_driver 列默认值
ALTER TABLE "media" ALTER COLUMN "storage_driver" SET DEFAULT 'LOCAL';
--> statement-breakpoint
-- 3. 添加正确的外键约束（PostgreSQL 不支持 ADD CONSTRAINT IF NOT EXISTS，用 DO 块）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'media_tags_media_id_media_id_fk') THEN
    ALTER TABLE "media_tags" ADD CONSTRAINT "media_tags_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END$$;
