import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isAdminUser } from "@/lib/utils";
import { listAllTags } from "@/lib/tags";

/**
 * 所有标签 API（用于下拉提示）
 * GET /api/admin/tags - 获取所有标签列表
 */

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const tags = await listAllTags();
    return NextResponse.json({ tags });
  } catch (error) {
    console.error("获取标签列表失败：", error);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}
