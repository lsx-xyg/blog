import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { isAdminUser } from "@/lib/utils";
import { listFriendLinks, createFriendLink } from "@/lib/friend-links";

/**
 * 友链 API
 * GET /api/admin/friend-links - 获取所有友链
 * POST /api/admin/friend-links - 创建友链
 */

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const links = await listFriendLinks();
    return NextResponse.json({ links });
  } catch (error) {
    console.error("获取友链失败：", error);
    return NextResponse.json({ error: "获取失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, url, avatarUrl, description, tags, sortOrder } = body;

    if (!name || !url) {
      return NextResponse.json({ error: "名称和链接不能为空" }, { status: 400 });
    }

    const link = await createFriendLink({
      name,
      url,
      avatarUrl: avatarUrl ?? null,
      description: description ?? "",
      tags: tags ?? [],
      sortOrder: sortOrder ?? 0,
    });

    return NextResponse.json({ link }, { status: 201 });
  } catch (error) {
    console.error("创建友链失败：", error);
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
