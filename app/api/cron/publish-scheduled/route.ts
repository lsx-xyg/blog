/**
 * T12 定时发布：扫描并发布到期的定时文章
 *
 * GET /api/cron/publish-scheduled
 *
 * 鉴权：CRON_SECRET 环境变量（请求头 x-cron-secret 或 query 参数 secret）
 * - 未配置 CRON_SECRET 时，接口返回 403（防止未授权访问）
 * - 配置后，请求必须携带正确的 secret 才能调用
 *
 * 两套实现：
 * - VERCEL 模式：cron-job.org 定时调用此接口
 * - SERVER 模式：node-cron 内置定时任务调用此接口
 *
 * 幂等设计：
 * - 只扫描 status = SCHEDULED 且 scheduledAt <= now 的文章
 * - 已发布的文章不会重复发布
 * - 双重检查（WHERE status = SCHEDULED）防止并发重复发布
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { publishScheduledPosts } from "@/lib/posts";
import { env } from "@/db/env";

export const dynamic = "force-dynamic";

/** 校验 CRON_SECRET */
function verifyCronSecret(req: Request): boolean {
  const cronSecret = env("CRON_SECRET");
  if (!cronSecret) {
    // 未配置 CRON_SECRET 时，拒绝所有请求（防止未授权访问）
    return false;
  }

  // 从请求头或 query 参数中获取 secret
  const headerSecret = req.headers.get("x-cron-secret");
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret");

  const providedSecret = headerSecret || querySecret;
  return providedSecret === cronSecret;
}

export async function GET(req: Request) {
  // 鉴权
  if (!verifyCronSecret(req)) {
    return NextResponse.json(
      { error: "未授权：CRON_SECRET 校验失败" },
      { status: 403 },
    );
  }

  try {
    // 扫描并发布到期的定时文章
    const published = await publishScheduledPosts();

    // 失效缓存（首页 + 所有发布的文章页）
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
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("定时发布扫描失败：", error);
    return NextResponse.json(
      { error: "定时发布扫描失败", detail: String(error) },
      { status: 500 },
    );
  }
}
