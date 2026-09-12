import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { galleryItems, galleryItemTags, tags, media } from "@/db/schema";
import { listPublishedPostMeta } from "@/lib/posts";

export const dynamic = "force-dynamic";

/**
 * T7 方案 A：全量轻量元数据下发（首页/相册启动时拉取，前端负责筛选/搜索/分批渲染）
 * - posts：已发布文章（含标签数组）
 * - gallery：相册条目（T5 闭环后才有数据；接口结构先就位）
 */
export async function GET() {
  const posts = await listPublishedPostMeta();

  const galleryRows = await db
    .select({
      id: galleryItems.id,
      title: galleryItems.title,
      description: galleryItems.description,
      featured: galleryItems.featured,
      imageUrl: media.url,
      createdAt: galleryItems.createdAt,
      tagName: tags.name,
    })
    .from(galleryItems)
    .innerJoin(media, eq(galleryItems.mediaId, media.id))
    .leftJoin(galleryItemTags, eq(galleryItemTags.galleryItemId, galleryItems.id))
    .leftJoin(tags, eq(tags.id, galleryItemTags.tagId))
    .orderBy(desc(galleryItems.createdAt));

  const galleryMap = new Map<string, {
    id: string;
    title: string | null;
    description: string | null;
    featured: boolean;
    imageUrl: string;
    createdAt: Date;
    tags: string[];
  }>();
  for (const r of galleryRows) {
    let item = galleryMap.get(r.id);
    if (!item) {
      item = {
        id: r.id,
        title: r.title,
        description: r.description,
        featured: r.featured,
        imageUrl: r.imageUrl,
        createdAt: r.createdAt,
        tags: [],
      };
      galleryMap.set(r.id, item);
    }
    if (r.tagName) item.tags.push(r.tagName);
  }

  return NextResponse.json({
    posts,
    gallery: [...galleryMap.values()],
  });
}
