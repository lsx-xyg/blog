import { NextResponse } from "next/server";
import { listPublishedPosts } from "@/lib/posts";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 9;
const MAX_PAGE_SIZE = 50;

/** 公开：已发布文章分页列表（首页瀑布流滚动加载；T7 在此扩展筛选/搜索） */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE),
  );
  const offset = (page - 1) * pageSize;
  // 多取 1 条用于判断是否还有下一页
  const rows = await listPublishedPosts({ limit: pageSize + 1, offset });
  const hasMore = rows.length > pageSize;
  const posts = rows.slice(0, pageSize);
  return NextResponse.json({ posts, hasMore, page, pageSize });
}
