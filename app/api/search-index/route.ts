import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { mediaTags, tags, media } from '@/db/schema';
import { listPublishedPostMeta } from '@/lib/posts/server';
import { MediaType } from '@/lib/types/media';

export const dynamic = 'force-dynamic';

/**
 * 搜索索引内存缓存
 *
 * 缓存构建好的搜索索引，避免每次请求都重新查询数据库。
 * 缓存有效期 60 秒，过期后自动重新构建。
 * 发布新文章、上传新图片、修改标签后最多 60 秒生效。
 */
interface SearchIndexCache {
  data: {
    posts: Awaited<ReturnType<typeof listPublishedPostMeta>>;
    gallery: Array<{
      id: string;
      title: string | null;
      description: string | null;
      featured: boolean;
      imageUrl: string;
      createdAt: Date;
      tags: string[];
    }>;
  };
  timestamp: number;
}

const CACHE_TTL = 60 * 1000; // 60 秒
let cache: SearchIndexCache | null = null;

/**
 * T7 方案 A：全量轻量元数据下发（首页/相册启动时拉取，前端负责筛选/搜索/分批渲染）
 * - posts：已发布文章（含标签数组）
 * - gallery：相册条目（media 表中 type=GALLERY 的记录）
 */
export async function GET() {
  // 检查缓存是否有效
  const now = Date.now();
  if (cache && now - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  const posts = await listPublishedPostMeta();

  const galleryRows = await db
    .select({
      id: media.id,
      title: media.title,
      description: media.description,
      featured: media.featured,
      imageUrl: media.url,
      createdAt: media.createdAt,
      tagName: tags.name,
    })
    .from(media)
    .leftJoin(mediaTags, eq(mediaTags.mediaId, media.id))
    .leftJoin(tags, eq(tags.id, mediaTags.tagId))
    .where(eq(media.type, MediaType.GALLERY))
    .orderBy(desc(media.createdAt));

  const galleryMap = new Map<
    string,
    {
      id: string;
      title: string | null;
      description: string | null;
      featured: boolean;
      imageUrl: string;
      createdAt: Date;
      tags: string[];
    }
  >();
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

  const data = {
    posts,
    gallery: [...galleryMap.values()],
  };

  // 更新缓存
  cache = {
    data,
    timestamp: now,
  };

  return NextResponse.json(data);
}
