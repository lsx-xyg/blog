import { NextResponse } from "next/server";
import { listPublishedPostsFiltered } from "@/lib/posts";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 9;
const MAX_PAGE_SIZE = 50;

/**
 * 公开：已发布文章分页列表（首页瀑布流滚动加载）
 * - 默认（方案 A CLIENT）首页走 /api/search-index 全量，前端筛选/分批渲染；本接口作为 DATABASE 模式预留
 * - 支持过滤参数：tags（逗号分隔，AND 语义）、featured=1、q（标题+摘要+标签）
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE),
  );
  const tags = searchParams.get("tags")?.split(",").map((t) => t.trim()).filter(Boolean);
  const featured = searchParams.get("featured") === "1";
  const q = searchParams.get("q")?.trim() || undefined;
  const offset = (page - 1) * pageSize;
  // 多取 1 条用于判断是否还有下一页
  const rows = await listPublishedPostsFiltered({
    limit: pageSize + 1,
    offset,
    tags,
    featured: featured || undefined,
    query: q,
  });
  const hasMore = rows.length > pageSize;
  const posts = rows.slice(0, pageSize);
  return NextResponse.json({ posts, hasMore, page, pageSize });
}
