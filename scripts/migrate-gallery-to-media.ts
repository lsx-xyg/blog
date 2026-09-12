/**
 * 数据迁移脚本：把旧 gallery_items 的图片数据迁移到 media 表
 *
 * 执行时机：在应用 drizzle/0003_black_rage.sql 迁移之前
 * 执行方式：npx tsx scripts/migrate-gallery-to-media.ts
 *
 * 逻辑：
 * 1. 用原始 SQL 查询所有 gallery_items（包含旧的 image_url, storage_driver, storage_key）
 * 2. 对每个 gallery_item，在 media 表中创建一条记录（type=GALLERY）
 * 3. 更新 gallery_item 的 media_id 为新创建的 media.id
 * 4. 完成后，所有 gallery_items 都有 media_id 了，可以安全应用 0003 迁移
 */

// 必须在导入 db 之前加载环境变量
import "../db/load-env";

import { db, sql } from "../db";
import { media, galleryItems } from "../db/schema";
import { eq } from "drizzle-orm";
import { MediaType } from "../lib/types/media";

type OldGalleryItem = {
  id: string;
  title: string | null;
  description: string | null;
  featured: boolean;
  image_url: string | null;
  storage_driver: string | null;
  storage_key: string | null;
  created_at: Date;
};

async function main() {
  console.log("=== 开始数据迁移：gallery_items → media ===");

  // 1. 用原始 SQL 查询所有还没有 media_id 的 gallery_items
  // 注意：schema 已经修改了，所以需要用原始 SQL 查询旧字段
  const oldGalleryItems = await sql<OldGalleryItem[]>`
    SELECT id, title, description, featured, image_url, storage_driver, storage_key, created_at 
    FROM gallery_items 
    WHERE media_id IS NULL
  `;

  console.log(`找到 ${oldGalleryItems.length} 条需要迁移的相册数据`);

  if (oldGalleryItems.length === 0) {
    console.log("没有需要迁移的数据，退出。");
    return;
  }

  // 2. 逐条迁移
  let successCount = 0;
  let failCount = 0;

  for (const item of oldGalleryItems) {
    try {
      if (!item.image_url) {
        console.warn(`  ⚠️  相册项 ${item.id} 没有 image_url，跳过`);
        failCount++;
        continue;
      }

      // 在 media 表中创建记录
      const newMedia = await db
        .insert(media)
        .values({
          type: MediaType.GALLERY,
          url: item.image_url,
          storageDriver: item.storage_driver || "LOCAL",
          storageKey: item.storage_key || null,
          title: item.title || null,
          description: item.description || null,
          mimeType: null, // 旧数据没有 mime_type
          size: null, // 旧数据没有 size
          width: null,
          height: null,
          uploadedBy: null,
        })
        .returning();

      // 更新 gallery_item 的 media_id
      await db
        .update(galleryItems)
        .set({ mediaId: newMedia[0].id })
        .where(eq(galleryItems.id, item.id));

      console.log(`  ✅ 相册项 ${item.id} → media ${newMedia[0].id} (${item.image_url})`);
      successCount++;
    } catch (error) {
      console.error(`  ❌ 相册项 ${item.id} 迁移失败：`, error);
      failCount++;
    }
  }

  console.log("\n=== 迁移完成 ===");
  console.log(`成功：${successCount}`);
  console.log(`失败：${failCount}`);

  if (failCount > 0) {
    console.log("\n⚠️  有失败的迁移，请手动检查后再应用 0003 迁移！");
    process.exit(1);
  } else {
    console.log("\n✅ 所有数据迁移成功，可以安全应用 0003 迁移。");
  }
}

main().catch((error) => {
  console.error("迁移脚本执行失败：", error);
  process.exit(1);
});
