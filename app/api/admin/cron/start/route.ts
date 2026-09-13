/**
 * POST /api/admin/cron/start - 创建全局定时发布任务（cron-job.org）
 */
import { NextResponse } from "next/server";
import { requireAdmin, adminDenied } from "@/lib/auth-guard";
import { createGlobalPublishJob, findGlobalPublishJob } from "@/lib/cron-job";
import { getDeployPlatform } from "@/lib/cron-utils";
import { getCronConfig } from "@/lib/settings";
import { env } from "@/db/env";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return adminDenied();

  const [platform, cronConfig] = await Promise.all([
    getDeployPlatform(),
    getCronConfig(),
  ]);

  const siteUrl = env("NEXT_PUBLIC_SITE_URL");

  if (!cronConfig.cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET 未配置，无法启动定时任务" },
      { status: 400 },
    );
  }

  if (platform === "VERCEL") {
    if (!siteUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_SITE_URL 未配置，无法创建 cron-job.org 任务" },
        { status: 400 },
      );
    }

    try {
      // 先检查是否已存在
      const existing = await findGlobalPublishJob();
      if (existing) {
        return NextResponse.json({
          success: true,
          message: "定时任务已存在",
          jobId: existing.jobId,
        });
      }

      const jobId = await createGlobalPublishJob(siteUrl, cronConfig.cronSecret);
      return NextResponse.json({
        success: true,
        message: "定时任务已创建（每分钟执行一次）",
        jobId,
      });
    } catch (error) {
      console.error("创建 cron-job.org 任务失败：", error);
      return NextResponse.json(
        { error: "创建定时任务失败", detail: String(error) },
        { status: 500 },
      );
    }
  } else {
    // SERVER 模式：node-cron 在 instrumentation.ts 中启动
    return NextResponse.json({
      success: true,
      message: "SERVER 模式：node-cron 内置定时任务已在应用启动时自动运行",
    });
  }
}
