/**
 * 相册测试数据脚本
 * 插入测试相册数据，验证前台相册页面展示
 *
 * 注意：gallery_items 表已重构，需要先在 media 表创建图片记录，
 * 然后再创建 gallery_items 并关联 media_id。
 */
import "../db/load-env";
import { db } from "../db";
import { galleryItems, media } from "../db/schema";
import { MediaType } from "../lib/types/media";

async function main() {
  console.log("开始插入相册测试数据...");

  const testImages = [
    {
      title: "青岛的海",
      description: "秋日的海边，阳光洒在海面上",
      featured: true,
      imageUrl: "https://picsum.photos/seed/qingdao1/800/600",
    },
    {
      title: "城市夜景",
      description: "夜晚的城市灯火辉煌",
      featured: false,
      imageUrl: "https://picsum.photos/seed/city1/800/1000",
    },
    {
      title: "山间小路",
      description: "蜿蜒的小路通向远方",
      featured: true,
      imageUrl: "https://picsum.photos/seed/mountain1/800/600",
    },
    {
      title: "咖啡时光",
      description: "午后的一杯咖啡",
      featured: false,
      imageUrl: "https://picsum.photos/seed/coffee1/600/800",
    },
    {
      title: "樱花盛开",
      description: "春天的樱花树下",
      featured: true,
      imageUrl: "https://picsum.photos/seed/sakura1/800/600",
    },
    {
      title: "星空银河",
      description: "夜晚的星空，银河横跨天际",
      featured: false,
      imageUrl: "https://picsum.photos/seed/stars1/1000/800",
    },
  ];

  for (const img of testImages) {
    // 先创建 media 记录
    const newMedia = await db
      .insert(media)
      .values({
        type: MediaType.GALLERY,
        url: img.imageUrl,
        storageDriver: "LOCAL",
        storageKey: null,
        title: img.title,
        description: img.description,
        mimeType: null,
        size: null,
        width: null,
        height: null,
        uploadedBy: null,
      })
      .returning();

    // 再创建 gallery_items 并关联 media_id
    await db.insert(galleryItems).values({
      mediaId: newMedia[0].id,
      title: img.title,
      description: img.description,
      featured: img.featured,
    });

    console.log(`  插入: ${img.title} (media_id: ${newMedia[0].id})`);
  }

  console.log(`\n完成！共插入 ${testImages.length} 张测试图片。`);
  process.exit(0);
}

main().catch((err) => {
  console.error("错误：", err);
  process.exit(1);
});
