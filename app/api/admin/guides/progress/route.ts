import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { isAdminUser } from "@/lib/shared/utils";
import { db } from "@/db";
import { userGuideProgress, guiders } from "@/db/schema";
import {
  GuideProgressStatus,
  GUIDE_PROGRESS_STATUS_VALUES,
} from "@/lib/types/guides";

/**
 * 用户引导进度 API（user_guide_progress 表）
 *
 * GET    /api/admin/guides/progress         - 当前用户全部引导进度
 * POST   /api/admin/guides/progress         - 上报/upsert 进度 { guideKey, status?, currentStep? }
 * DELETE /api/admin/guides/progress?guideKey=xxx - 重置当前用户某引导的进度（重新触发）
 */

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(userGuideProgress)
    .where(eq(userGuideProgress.userId, session.user.id));

  return NextResponse.json({ progress: rows });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  let body: { guideKey?: unknown; status?: unknown; currentStep?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const guideKey = body.guideKey;
  if (typeof guideKey !== "string" || !guideKey.trim()) {
    return NextResponse.json({ error: "guideKey 必填" }, { status: 400 });
  }

  // guideKey 必须存在于 guiders 表（防止脏数据）
  const guideExists = await db
    .select({ id: guiders.id })
    .from(guiders)
    .where(eq(guiders.guideKey, guideKey));
  if (guideExists.length === 0) {
    return NextResponse.json({ error: "引导不存在" }, { status: 404 });
  }

  const status =
    body.status !== undefined &&
    GUIDE_PROGRESS_STATUS_VALUES.includes(body.status as GuideProgressStatus)
      ? (body.status as GuideProgressStatus)
      : undefined;
  const currentStep =
    typeof body.currentStep === "number" && Number.isFinite(body.currentStep)
      ? Math.trunc(Math.max(0, body.currentStep))
      : undefined;

  if (!status && currentStep === undefined) {
    return NextResponse.json({ error: "status 或 currentStep 至少提供一个" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(userGuideProgress)
    .where(
      and(
        eq(userGuideProgress.userId, session.user.id),
        eq(userGuideProgress.guideKey, guideKey)
      )
    );

  const now = new Date();
  if (!existing) {
    const effectiveStatus = status ?? GuideProgressStatus.NOT_STARTED;
    const [created] = await db
      .insert(userGuideProgress)
      .values({
        userId: session.user.id,
        guideKey,
        status: effectiveStatus,
        currentStep: currentStep ?? 0,
        startedAt:
          effectiveStatus === GuideProgressStatus.IN_PROGRESS ? now : null,
        completedAt:
          effectiveStatus === GuideProgressStatus.COMPLETED ? now : null,
      })
      .returning();
    return NextResponse.json({ progress: created }, { status: 201 });
  }

  const patch: {
    status?: GuideProgressStatus;
    currentStep?: number;
    startedAt?: Date | null;
    completedAt?: Date | null;
    updatedAt: Date;
  } = { updatedAt: now };

  if (status !== undefined) {
    patch.status = status;
    if (status === GuideProgressStatus.IN_PROGRESS && !existing.startedAt) {
      patch.startedAt = now;
    }
    if (status === GuideProgressStatus.COMPLETED && !existing.completedAt) {
      patch.completedAt = now;
    }
  }
  if (currentStep !== undefined) {
    patch.currentStep = currentStep;
  }

  const [updated] = await db
    .update(userGuideProgress)
    .set(patch)
    .where(eq(userGuideProgress.id, existing.id))
    .returning();

  return NextResponse.json({ progress: updated });
}

/** 重置进度：删除当前用户指定引导的进度记录（跳过/完成状态清空后可重新触发） */
export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const guideKey = searchParams.get("guideKey");
  if (!guideKey || !guideKey.trim()) {
    return NextResponse.json({ error: "guideKey 必填" }, { status: 400 });
  }

  const deleted = await db
    .delete(userGuideProgress)
    .where(
      and(
        eq(userGuideProgress.userId, session.user.id),
        eq(userGuideProgress.guideKey, guideKey.trim())
      )
    )
    .returning({ id: userGuideProgress.id });

  return NextResponse.json({ reset: true, deleted: deleted.length });
}
