import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server/auth";
import { headers } from "next/headers";
import { isAdminUser } from "@/lib/shared/utils";
import { createTag, getTagByName, listAllTags, listTagsWithCount } from "@/lib/tags";

/**
 * 标签 API
 * GET /api/admin/tags - 获取所有标签列表
 *   - ?withCount=true: 返回带关联数量的标签列表（用于标签管理页）
 *   - 默认: 返回简单标签列表（用于下拉提示）
 * POST /api/admin/tags - 创建标签 { name }
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

/** 创建标签 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "标签名称不能为空" }, { status: 400 });
    }

    const existing = await getTagByName(name);
    if (existing) {
      return NextResponse.json({ error: "同名标签已存在" }, { status: 409 });
    }

    const tag = await createTag(name);
    return NextResponse.json({ tag });
  } catch (error) {
    console.error("创建标签失败：", error);
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
