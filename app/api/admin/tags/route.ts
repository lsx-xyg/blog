import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isAdminUser } from "@/lib/utils";
import { listAllTags, listTagsWithCount } from "@/lib/tags";

/**
 * 标签 API
 * GET /api/admin/tags - 获取所有标签列表
 *   - ?withCount=true: 返回带关联数量的标签列表（用于标签管理页）
 *   - 默认: 返回简单标签列表（用于下拉提示）
 */

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const withCount = searchParams.get("withCount") === "true";

    if (withCount) {
      const tags = await listTagsWithCount();
      return NextResponse.json({ tags });
    } else {
      const tags = await listAllTags();
      return NextResponse.json({ tags });
    }
  } catch (error) {
    console.error("获取标签列表失败：", error);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}
