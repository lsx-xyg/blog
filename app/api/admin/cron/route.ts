/**
 * GET /api/admin/cron - 获取定时任务状态
 */
import { NextResponse } from "next/server";
import { requireAdmin, adminDenied } from "@/lib/auth-guard";
import { findGlobalPublishJob } from "@/lib/cron-job";
import { getDeployPlatform } from "@/lib/cron-utils";
import { env } from "@/db/env";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return adminDenied();

  const platform = getDeployPlatform();
  const cronSecret = env("CRON_SECRET");
  const cronJobApiKey = env("CRON_JOB_API_KEY");
  const siteUrl = env("NEXT_PUBLIC_SITE_URL") || "http://localhost:3000";

  let jobStatus: { enabled: boolean; jobId?: number; nextRun?: number } = {
    enabled: false,
  };

  if (platform === "VERCEL" && cronJobApiKey) {
    try {
      const job = await findGlobalPublishJob();
      if (job) {
        jobStatus = {
          enabled: job.enabled,
          jobId: job.jobId,
          nextRun: job.nextRun,
        };
      }
    } catch (error) {
      console.error("获取 cron-job.org 任务状态失败：", error);
    }
  }

  return NextResponse.json({
    platform,
    cronSecretConfigured: !!cronSecret,
    cronJobApiKeyConfigured: !!cronJobApiKey,
    siteUrl,
    job: jobStatus,
    endpoints: {
      publishScheduled: `${siteUrl}/api/cron/publish-scheduled`,
    },
  });
}
