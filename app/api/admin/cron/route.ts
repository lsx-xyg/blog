/**
 * GET /api/admin/cron - 获取定时任务状态（总览）
 * 返回：平台 / 密钥配置 / 站点 URL / 系统定时任务状态列表 / 接口地址
 * 系统任务状态通过一次 listCronJobs 获取全部任务后按预设匹配（1 个 API）
 */
import { NextResponse } from "next/server";
import { requireAdmin, adminDenied } from "@/lib/auth/server";
import { listSystemJobsStatus } from "@/lib/cron/server";
import { getDeployPlatform } from "@/lib/settings/server";
import { getCronSettings, getSiteSettings } from "@/lib/settings/server";
import { CronDeployPlatform } from "@/lib/types/settings";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return adminDenied();

  const [platform, cronConfig, siteSettings] = await Promise.all([
    getDeployPlatform(),
    getCronSettings(),
    getSiteSettings(),
  ]);

  const siteUrl = siteSettings.siteUrl || "http://localhost:3000";

  let systemJobs: Awaited<ReturnType<typeof listSystemJobsStatus>> = [];
  if (platform === CronDeployPlatform.VERCEL && cronConfig.jobApiKey) {
    try {
      systemJobs = await listSystemJobsStatus();
    } catch (error) {
      console.error("获取系统定时任务状态失败：", error);
    }
  }

  return NextResponse.json({
    platform,
    cronSecretConfigured: !!cronConfig.secret,
    cronJobApiKeyConfigured: !!cronConfig.jobApiKey,
    siteUrl,
    systemJobs,
    endpoints: {
      publishScheduled: `${siteUrl}/api/cron/publish-scheduled`,
    },
  });
}
