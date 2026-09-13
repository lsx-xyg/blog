/**
 * POST /api/admin/cron/stop - 删除全局定时发布任务（cron-job.org）
 */
import { NextResponse } from "next/server";
import { requireAdmin, adminDenied } from "@/lib/auth-guard";
import { deleteCronJob, findGlobalPublishJob } from "@/lib/cron-job";
import { getDeployPlatform } from "@/lib/cron-utils";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return adminDenied();

  const platform = getDeployPlatform();

  if (platform === "VERCEL") {
    try {
      const job = await findGlobalPublishJob();
      if (!job) {
        return NextResponse.json({
          success: true,
          message: "定时任务不存在",
        });
      }

      await deleteCronJob(job.jobId);
      return NextResponse.json({
        success: true,
        message: "定时任务已删除",
        jobId: job.jobId,
      });
    } catch (error) {
      console.error("删除 cron-job.org 任务失败：", error);
      return NextResponse.json(
        { error: "删除定时任务失败", detail: String(error) },
        { status: 500 },
      );
    }
  } else {
    return NextResponse.json({
      success: true,
      message: "SERVER 模式：请在应用配置中禁用 node-cron 定时任务",
    });
  }
}
