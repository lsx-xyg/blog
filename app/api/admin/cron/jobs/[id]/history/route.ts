/**
 * GET /api/admin/cron/jobs/[id]/history - 获取任务执行历史
 */
import { NextResponse } from "next/server";
import { requireAdmin, adminDenied } from "@/lib/auth/server/guard";
import { getJobHistory } from "@/lib/cron/server";

export const dynamic = "force-dynamic";

/** 获取任务执行历史 */
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

    const history = await getJobHistory(jobId);
    return NextResponse.json({ history });
  } catch (error) {
    console.error("获取任务执行历史失败：", error);
    return NextResponse.json(
      { error: "获取任务执行历史失败", detail: String(error) },
      { status: 500 },
    );
  }
}
