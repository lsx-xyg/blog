/**
 * GET /api/admin/cron/jobs/[id]/history/[identifier] - 获取单次执行详情（含响应头、响应体）
 */
import { NextResponse } from "next/server";
import { requireAdmin, adminDenied } from "@/lib/auth/auth-guard";
import { getJobHistoryDetail } from "@/lib/cron";

export const dynamic = "force-dynamic";

/** 获取单次执行详情 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; identifier: string }> },
) {
  if (!(await requireAdmin(req))) return adminDenied();

  try {
    const { id, identifier } = await params;
    const jobId = parseInt(id, 10);
    // identifier 是 cron-job.org 的字符串标识符（如 8440447-16-8-204），不做数值转换
    if (isNaN(jobId) || !identifier) {
      return NextResponse.json(
        { error: "无效的任务 ID 或执行标识符" },
        { status: 400 },
      );
    }

    const detail = await getJobHistoryDetail(jobId, identifier);
    return NextResponse.json({ executionDetails: detail });
  } catch (error) {
    console.error("获取执行详情失败：", error);
    return NextResponse.json(
      { error: "获取执行详情失败", detail: String(error) },
      { status: 500 },
    );
  }
}
