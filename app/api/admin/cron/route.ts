/**
 * GET /api/admin/cron - 获取定时任务状态
 */
import { NextResponse } from "next/server";
import { requireAdmin, adminDenied } from "@/lib/auth/auth-guard";
import { findGlobalPublishJob } from "@/lib/cron";
import { getDeployPlatform } from "@/lib/settings";
import { getCronSettings, getSiteSettings } from "@/lib/settings/index";
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

  let jobStatus: { enabled: boolean; jobId?: number; nextExecution?: number } = {
    enabled: false,
  };

  if (platform === CronDeployPlatform.VERCEL && cronConfig.jobApiKey) {
    try {
      const job = await findGlobalPublishJob();
      if (job) {
        jobStatus = {
          enabled: job.enabled,
          jobId: job.jobId,
          nextExecution: job.nextExecution ?? undefined,
        };
      }
    } catch (error) {
      console.error("获取 cron-job.org 任务状态失败：", error);
    }
  }

  return NextResponse.json({
    platform,
    cronSecretConfigured: !!cronConfig.secret,
    cronJobApiKeyConfigured: !!cronConfig.jobApiKey,
    siteUrl,
    job: jobStatus,
    endpoints: {
      publishScheduled: `${siteUrl}/api/cron/publish-scheduled`,
    },
  });
}
