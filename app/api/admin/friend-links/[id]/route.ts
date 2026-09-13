import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isAdminUser } from "@/lib/utils";
import { getFriendLinkById, updateFriendLink, deleteFriendLink } from "@/lib/friend-links";

/**
 * 友链详情 API
 * PUT /api/admin/friend-links/[id] - 更新友链
 * DELETE /api/admin/friend-links/[id] - 删除友链
 */

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
    const existing = await getFriendLinkById(id);
    if (!existing) {
      return NextResponse.json({ error: "友链不存在" }, { status: 404 });
    }

    const body = await request.json();
    const { name, url, avatarUrl, description, tags, sortOrder } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (url !== undefined) updateData.url = url;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    if (description !== undefined) updateData.description = description;
    if (tags !== undefined) updateData.tags = tags;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    const link = await updateFriendLink(id, updateData);
    return NextResponse.json({ link });
  } catch (error) {
    console.error("更新友链失败：", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

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
    const existing = await getFriendLinkById(id);
    if (!existing) {
      return NextResponse.json({ error: "友链不存在" }, { status: 404 });
    }

    await deleteFriendLink(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除友链失败：", error);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
