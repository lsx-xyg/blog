import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isAdminUser } from "@/lib/utils";
import { getMediaTags, setMediaTags } from "@/lib/media";

/**
 * 媒体标签 API
 * GET /api/admin/media/[id]/tags - 获取媒体的标签
 * PUT /api/admin/media/[id]/tags - 更新媒体的标签（全量替换，自动创建不存在的标签）
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const tags = await getMediaTags(id);
    return NextResponse.json({ tags });
  } catch (error) {
    console.error("获取媒体标签失败：", error);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { tags } = body;

    if (!Array.isArray(tags)) {
      return NextResponse.json({ error: "tags 必须是数组" }, { status: 400 });
    }

    const updatedTags = await setMediaTags(id, tags);
    return NextResponse.json({ tags: updatedTags });
  } catch (error) {
    console.error("更新媒体标签失败：", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}
