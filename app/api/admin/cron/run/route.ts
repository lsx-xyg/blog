/**
 * POST /api/admin/cron/run - 手动触发一次系统任务
 * 按 body.key 分派：
 * - backup → 立即执行自动备份（BackupTrigger.AUTO）
 * - 缺省 / publish_scheduled → 定时发布扫描
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin, adminDenied } from "@/lib/auth/server/guard";
import { publishScheduledPosts } from "@/lib/posts";
import { createBackup } from "@/lib/backup";
import { BackupTrigger } from "@/lib/types/backup";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return adminDenied();

  try {
    const body = (await req.json().catch(() => ({}))) as { key?: string };
    const presetKey = body.key || "publish_scheduled";

    // 自动备份：手动触发立即备份一次
    if (presetKey === "backup") {
      const { record } = await createBackup(BackupTrigger.AUTO);
      return NextResponse.json({
        success: true,
        backupId: record.id,
        fileKey: record.fileKey,
        size: record.size,
      });
    }

    // 缺省：定时发布扫描
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
    console.error("手动触发系统任务失败：", error);
    return NextResponse.json(
      { error: "手动触发系统任务失败", detail: String(error) },
      { status: 500 },
    );
  }
}
