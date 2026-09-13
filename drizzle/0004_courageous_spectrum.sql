-- 重构：去掉 gallery_items / gallery_item_tags，精选字段放到 media，新建 media_tags
-- 1. 先把 gallery_items.featured 同步到 media.featured（需要先添加字段）
ALTER TABLE "media" ADD COLUMN "featured" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
-- 2. 同步精选状态
UPDATE "media" SET "featured" = gi.featured
FROM "gallery_items" gi
WHERE gi.media_id = "media".id AND gi.featured = true;
--> statement-breakpoint
-- 3. 创建 media_tags 关联表
CREATE TABLE "media_tags" (
	"media_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "media_tags_media_id_tag_id_pk" PRIMARY KEY("media_id","tag_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_tags_tag_id_idx" ON "media_tags" ("tag_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_tags" ADD CONSTRAINT "media_tags_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_tags" ADD CONSTRAINT "media_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- 4. 添加 media.featured 索引
CREATE INDEX IF NOT EXISTS "media_featured_idx" ON "media" ("featured");
--> statement-breakpoint
-- 5. 删除 gallery_item_tags 表（无数据，直接删）
DROP TABLE IF EXISTS "gallery_item_tags";
--> statement-breakpoint
-- 6. 删除 gallery_items 表
DROP TABLE IF EXISTS "gallery_items";
