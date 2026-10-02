import { NextResponse } from 'next/server';
import { listPublicVideosWithPoster } from '@/lib/videos/server/public';

export const dynamic = 'force-dynamic';

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 48;

/**
 * 公开：前台视频瀑布流分页
 * GET /api/videos?cursor=<offset>&limit=<n>&tag=<可选>
 *
 * - cursor 为上一页 offset（数字），响应 nextCursor 为 null 时表示没有更多
 * - 只返回 PUBLISHED + PUBLIC；字段白名单见 PublicVideoCard
 * - tag 参数预留（扩展点 2：标签筛选，本次不筛）
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const offset = Math.max(0, Number.parseInt(searchParams.get('cursor') ?? '0', 10) || 0);
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(searchParams.get('limit') ?? String(DEFAULT_PAGE_SIZE), 10) || 1),
  );
  const tag = searchParams.get('tag')?.trim() || undefined;

  // 多取 1 条判断是否还有下一页
  const rows = await listPublicVideosWithPoster({ limit: limit + 1, offset, tag });
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);

  return NextResponse.json({
    items,
    hasMore,
    nextCursor: hasMore ? offset + limit : null,
    offset,
    limit,
  });
}
