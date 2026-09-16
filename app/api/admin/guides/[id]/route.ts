import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { isAdminUser } from "@/lib/shared/utils";
import { db } from "@/db";
import { guiders } from "@/db/schema";
import { GuideStatus, isValidTargetCondition } from "@/lib/types/guides";
import type { GuideStep, GuideTargetCondition } from "@/lib/types/guides";

/**
 * 引导配置详情 API
 *
 * PUT    /api/admin/guides/[id] - 更新引导（含状态切换 draft/published/archived）
 * DELETE /api/admin/guides/[id] - 删除引导（进度记录保留，仅删除配置）
 */

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await context.params;
  let body: {
    guideKey?: unknown;
    title?: unknown;
    page?: unknown;
    steps?: unknown;
    status?: unknown;
    targetCondition?: unknown;
    priority?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const [existing] = await db
    .select({ id: guiders.id })
    .from(guiders)
    .where(eq(guiders.id, id));
  if (!existing) {
    return NextResponse.json({ error: "引导不存在" }, { status: 404 });
  }

  // 校验（仅校验传入的字段）
  const patch: {
    guideKey?: string;
    title?: string;
    page?: string;
    steps?: GuideStep[];
    status?: GuideStatus;
    targetCondition?: GuideTargetCondition | null;
    priority?: number;
    updatedAt?: Date;
  } = { updatedAt: new Date() };

  if (body.guideKey !== undefined) {
    if (typeof body.guideKey !== "string" || !body.guideKey.trim()) {
      return NextResponse.json({ error: "guideKey 必填" }, { status: 400 });
    }
    const dup = await db
      .select({ id: guiders.id })
      .from(guiders)
      .where(eq(guiders.guideKey, body.guideKey));
    if (dup.length > 0 && dup[0].id !== id) {
      return NextResponse.json(
        { error: "guideKey 已存在（改版请使用新版本号，如 _v2）" },
        { status: 409 }
      );
    }
    patch.guideKey = body.guideKey.trim();
  }
  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ error: "title 必填" }, { status: 400 });
    }
    patch.title = body.title.trim();
  }
  if (body.page !== undefined) {
    if (typeof body.page !== "string" || !body.page.trim()) {
      return NextResponse.json({ error: "page 必填" }, { status: 400 });
    }
    patch.page = body.page.trim();
  }
  if (body.steps !== undefined) {
    if (!Array.isArray(body.steps) || body.steps.length === 0) {
      return NextResponse.json({ error: "steps 必须是非空数组" }, { status: 400 });
    }
    for (const step of body.steps as GuideStep[]) {
      if (
        typeof step.id !== "string" ||
        typeof step.target !== "string" ||
        typeof step.title !== "string" ||
        typeof step.content !== "string"
      ) {
        return NextResponse.json(
          { error: "steps 每项需包含 id/target/title/content 字符串字段" },
          { status: 400 }
        );
      }
    }
    patch.steps = body.steps as GuideStep[];
  }
  if (body.status !== undefined) {
    if (!Object.values(GuideStatus).includes(body.status as GuideStatus)) {
      return NextResponse.json({ error: "status 非法" }, { status: 400 });
    }
    patch.status = body.status as GuideStatus;
  }
  if (body.priority !== undefined) {
    if (typeof body.priority !== "number" || !Number.isFinite(body.priority)) {
      return NextResponse.json({ error: "priority 非法" }, { status: 400 });
    }
    patch.priority = Math.trunc(body.priority);
  }
  if (body.targetCondition !== undefined) {
    const tc =
      body.targetCondition !== null ? body.targetCondition : null;
    if (tc !== null && !isValidTargetCondition(tc)) {
      return NextResponse.json(
        { error: "targetCondition 结构非法（需 {logic, conditions[]}）" },
        { status: 400 }
      );
    }
    patch.targetCondition = tc as GuideTargetCondition | null;
  }

  const [updated] = await db
    .update(guiders)
    .set(patch)
    .where(eq(guiders.id, id))
    .returning();

  return NextResponse.json({ guide: updated });
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await context.params;
  const [existing] = await db
    .select({ id: guiders.id })
    .from(guiders)
    .where(eq(guiders.id, id));
  if (!existing) {
    return NextResponse.json({ error: "引导不存在" }, { status: 404 });
  }

  await db.delete(guiders).where(eq(guiders.id, id));
  return NextResponse.json({ success: true });
}
