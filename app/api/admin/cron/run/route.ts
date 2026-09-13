/**
 * POST /api/admin/cron/run - 手动触发一次定时发布扫描
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin, adminDenied } from "@/lib/auth-guard";
import { publishScheduledPosts } from "@/lib/posts";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return adminDenied();

  try {
    const published = await publishScheduledPosts();

    // 失效缓存
    if (published.length > 0) {
      revalidatePath("/");
      for (const post of published) {
        revalidatePath(`/posts/${post.slug ?? post.id}`);
      }
    }

    return NextResponse.json({
      success: true,
      publishedCount: published.length,
      published: published.map((p) => ({ id: p.id, slug: p.slug })),
    });
  } catch (error) {
    console.error("手动触发定时发布失败：", error);
    return NextResponse.json(
      { error: "手动触发定时发布失败", detail: String(error) },
      { status: 500 },
    );
  }
}
