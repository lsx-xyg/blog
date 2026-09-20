/**
 * GET /api/admin/cron/jobs/[id] - 获取单个定时任务详情
 * PATCH /api/admin/cron/jobs/[id] - 更新定时任务
 * DELETE /api/admin/cron/jobs/[id] - 删除定时任务
 */
import { NextResponse } from "next/server";
import { requireAdmin, adminDenied } from "@/lib/auth/server";
import { getCronJob, updateCronJob, deleteCronJob } from "@/lib/cron/server";
import type { CronJobConfig } from "@/lib/types/cron";

export const dynamic = "force-dynamic";

/** 获取单个定时任务详情 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin(req))) return adminDenied();

  try {
    const { id } = await params;
    const jobId = parseInt(id, 10);
    if (isNaN(jobId)) {
      return NextResponse.json({ error: "无效的任务 ID" }, { status: 400 });
    }

    const job = await getCronJob(jobId);
    return NextResponse.json({ job });
  } catch (error) {
    console.error("获取定时任务详情失败：", error);
    return NextResponse.json(
      { error: "获取定时任务详情失败", detail: String(error) },
      { status: 500 },
    );
  }
}

/** 更新定时任务 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin(req))) return adminDenied();

  try {
    const { id } = await params;
    const jobId = parseInt(id, 10);
    if (isNaN(jobId)) {
      return NextResponse.json({ error: "无效的任务 ID" }, { status: 400 });
    }

    const body = (await req.json()) as { job: Partial<CronJobConfig> };
    await updateCronJob(jobId, body.job);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("更新定时任务失败：", error);
    return NextResponse.json(
      { error: "更新定时任务失败", detail: String(error) },
      { status: 500 },
    );
  }
}

/** 删除定时任务 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin(req))) return adminDenied();

  try {
    const { id } = await params;
    const jobId = parseInt(id, 10);
    if (isNaN(jobId)) {
      return NextResponse.json({ error: "无效的任务 ID" }, { status: 400 });
    }

    await deleteCronJob(jobId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除定时任务失败：", error);
    return NextResponse.json(
      { error: "删除定时任务失败", detail: String(error) },
      { status: 500 },
    );
  }
}
