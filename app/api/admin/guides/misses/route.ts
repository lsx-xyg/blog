import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/server";
import { isAdminUser } from "@/lib/shared";
import { db } from "@/db";
import { guideStepEvents } from "@/db/schema";
import { count, desc, max } from "drizzle-orm";

/**
 * 引导步骤失效汇总 API（#29 失效监控）
 *
 * GET  /api/admin/guides/misses  按 guideKey+stepId+selector 聚合，返回失效次数与最后失效时间
 * DELETE /api/admin/guides/misses 清空全部失效记录（处置后清理）
 */

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const rows = await db
    .select({
      guideKey: guideStepEvents.guideKey,
      stepId: guideStepEvents.stepId,
      selector: guideStepEvents.selector,
      selectorSource: guideStepEvents.selectorSource,
      page: guideStepEvents.page,
      count: count(),
      lastMissAt: max(guideStepEvents.createdAt),
    })
    .from(guideStepEvents)
    .groupBy(
      guideStepEvents.guideKey,
      guideStepEvents.stepId,
      guideStepEvents.selector,
      guideStepEvents.selectorSource,
      guideStepEvents.page
    )
    .orderBy(desc(max(guideStepEvents.createdAt)))
    .limit(100);

  return NextResponse.json({ misses: rows });
}

export async function DELETE() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  await db.delete(guideStepEvents);
  return NextResponse.json({ ok: true });
}

// 供 GET 结果类型引用
export type MissRow = {
  guideKey: string;
  stepId: string;
  selector: string;
  selectorSource: string;
  page: string;
  count: number;
  lastMissAt: Date | null;
};
