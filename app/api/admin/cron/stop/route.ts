/**
 * POST /api/admin/cron/stop - 停止系统定时任务
 * 语义：PATCH enabled=false（禁用），保留任务与执行历史；
 * 彻底删除请到任务列表操作（DELETE /api/admin/cron/jobs/[id]）
 */
import { NextResponse } from "next/server";
import { requireAdmin, adminDenied } from "@/lib/auth/server/guard";
import { findSystemJob, updateCronJob } from "@/lib/cron";
import { getDeployPlatform } from "@/lib/settings/server";
import { CronDeployPlatform } from "@/lib/types/settings";
import { getSystemJobPreset } from "@/lib/cron/system-jobs";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return adminDenied();

  const body = (await req.json().catch(() => ({}))) as { key?: string };
  const presetKey = body.key || "publish_scheduled";
  const preset = getSystemJobPreset(presetKey);
  if (!preset) {
    return NextResponse.json(
      { error: `未知的系统定时任务预设: ${presetKey}` },
      { status: 400 },
    );
  }

  const platform = await getDeployPlatform();

  if (platform === CronDeployPlatform.VERCEL) {
    try {
      const job = await findSystemJob(presetKey);
      if (!job) {
        return NextResponse.json({
          success: true,
          message: "定时任务不存在，无需停止",
        });
      }

      if (job.enabled) {
        await updateCronJob(job.jobId, { enabled: false });
      }
      return NextResponse.json({
        success: true,
        message: job.enabled ? "定时任务已停止（任务保留，可随时再启动）" : "定时任务已处于停止状态",
        jobId: job.jobId,
      });
    } catch (error) {
      console.error("停止系统定时任务失败：", error);
      return NextResponse.json(
        { error: "停止定时任务失败", detail: String(error) },
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
