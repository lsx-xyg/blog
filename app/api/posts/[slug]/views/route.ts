import { NextResponse } from "next/server";
import { getPublishedPostBySlugOrId, incrementViewCount } from "@/lib/posts";

export const dynamic = "force-dynamic";

/** 浏览量 +1（公开接口，客户端上报；原子自增） */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const post = await getPublishedPostBySlugOrId(slug);
  if (!post) {
    return NextResponse.json({ error: "文章不存在" }, { status: 404 });
  }
  const [updated] = await incrementViewCount(post.id);
  return NextResponse.json({ viewCount: updated?.viewCount ?? post.viewCount });
}
