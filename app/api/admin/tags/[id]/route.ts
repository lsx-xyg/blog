import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isAdminUser } from "@/lib/utils";
import { deleteTag, getTagById } from "@/lib/tags";

/**
 * 标签管理 API
 * DELETE /api/admin/tags/[id] - 删除标签（关联的文章/图片标签由外键 CASCADE 清理）
 */

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const tag = await getTagById(id);
    if (!tag) {
      return NextResponse.json({ error: "标签不存在" }, { status: 404 });
    }

    await deleteTag(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除标签失败：", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
