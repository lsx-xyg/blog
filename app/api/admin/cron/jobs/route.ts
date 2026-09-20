/**
 * GET /api/admin/cron/jobs - 列出所有定时任务
 * POST /api/admin/cron/jobs - 创建定时任务
 */
import { NextResponse } from "next/server";
import { requireAdmin, adminDenied } from "@/lib/auth/server";
import { listCronJobs, createCronJob } from "@/lib/cron/server";
import type { CronJobConfig } from "@/lib/types/cron";

export const dynamic = "force-dynamic";

/** 列出所有定时任务 */
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return adminDenied();

  try {
    const jobs = await listCronJobs();
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error("获取定时任务列表失败：", error);
    return NextResponse.json(
      { error: "获取定时任务列表失败", detail: String(error) },
      { status: 500 },
    );
  }
}

/** 创建定时任务 */
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return adminDenied();

  try {
    const body = (await req.json()) as { job: CronJobConfig };
    if (!body.job?.url) {
      return NextResponse.json(
        { error: "任务 URL 是必填项" },
        { status: 400 },
      );
    }

    const jobId = await createCronJob(body.job);
    return NextResponse.json({ success: true, jobId });
  } catch (error) {
    console.error("创建定时任务失败：", error);
    return NextResponse.json(
      { error: "创建定时任务失败", detail: String(error) },
      { status: 500 },
    );
  }
}
