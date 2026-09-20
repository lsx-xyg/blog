/**
 * POST /api/admin/cron/start - 启动系统定时任务（预设驱动）
 * 已存在 → 更新为启用（PATCH enabled=true，保留任务与执行历史）
 * 不存在 → 按预设创建
 */
import { NextResponse } from "next/server";
import { requireAdmin, adminDenied } from "@/lib/auth/server/guard";
import { createSystemJob, findSystemJob, listCronJobs, updateCronJob } from "@/lib/cron";
import { getDeployPlatform } from "@/lib/settings/server";
import { getCronSettings, getSiteSettings } from "@/lib/settings/server";
import { CronDeployPlatform } from "@/lib/types/settings";
import { getPresetKeyFromTitle, getSystemJobPreset } from "@/lib/cron/system-jobs";

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

  const [platform, cronConfig, siteSettings] = await Promise.all([
    getDeployPlatform(),
    getCronSettings(),
    getSiteSettings(),
  ]);

  const siteUrl = siteSettings.siteUrl;

  if (!cronConfig.secret) {
    return NextResponse.json(
      { error: "CRON_SECRET 未配置，无法启动定时任务" },
      { status: 400 },
    );
  }

  if (platform === CronDeployPlatform.VERCEL) {
    if (!siteUrl) {
      return NextResponse.json(
        { error: "站点 URL 未配置，请在「设置 → 站点设置」中配置站点 URL" },
        { status: 400 },
      );
    }

    try {
      // 预设的目标配置（标题 / URL 用）
      const presetCfg = preset.createConfig({
        siteUrl,
        cronSecret: cronConfig.secret,
      });

      // 先检查是否已存在：存在则启用（不删除、保留历史）
      const existing = await findSystemJob(presetKey);
      if (existing) {
        if (!existing.enabled) {
          await updateCronJob(existing.jobId, { enabled: true });
        }
        return NextResponse.json({
          success: true,
          message: existing.enabled ? "定时任务已在运行" : "定时任务已启用",
          jobId: existing.jobId,
        });
      }

      // 标题匹配不到：按 URL 找失联任务（标题被改动导致），修复标题并启用，避免重复创建
      const jobs = await listCronJobs();
      const orphan = jobs.find(
        (j) =>
          j.url === presetCfg.url &&
          getPresetKeyFromTitle(j.title) !== presetKey,
      );
      if (orphan) {
        await updateCronJob(orphan.jobId, {
          enabled: true,
          title: presetCfg.title,
        });
        return NextResponse.json({
          success: true,
          message: `检测到失联的${preset.name}任务（标题被改动），已修复标题并启用`,
          jobId: orphan.jobId,
        });
      }

      const jobId = await createSystemJob(presetKey, {
        siteUrl,
        cronSecret: cronConfig.secret,
      });
      return NextResponse.json({
        success: true,
        message: `${preset.name}已创建并启动`,
        jobId,
      });
    } catch (error) {
      console.error("启动系统定时任务失败：", error);
      return NextResponse.json(
        { error: "启动定时任务失败", detail: String(error) },
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
