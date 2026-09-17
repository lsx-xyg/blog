import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { desc, eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { isAdminUser } from "@/lib/shared/utils";
import { db } from "@/db";
import { guiders } from "@/db/schema";
import { GuideStatus, isValidTargetCondition } from "@/lib/types/guides";
import type { GuideStep, GuideTargetCondition } from "@/lib/types/guides";

/**
 * 引导配置 API（guiders 表）
 *
 * GET  /api/admin/guides?status=published - 引导列表（管理界面全量；运行时按 status 过滤）
 * POST /api/admin/guides                 - 创建引导
 */

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const statusFilter =
    status && (Object.values(GuideStatus) as string[]).includes(status)
      ? (status as GuideStatus)
      : null;

  const rows = statusFilter
    ? await db
        .select()
        .from(guiders)
        .where(eq(guiders.status, statusFilter))
        .orderBy(desc(guiders.priority), desc(guiders.createdAt))
    : await db
        .select()
        .from(guiders)
        .orderBy(desc(guiders.priority), desc(guiders.createdAt));

  return NextResponse.json({ guides: rows });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

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

  // 基础校验
  const guideKey = body.guideKey;
  const title = body.title;
  const page = body.page;
  const steps = body.steps;
  if (typeof guideKey !== "string" || !guideKey.trim()) {
    return NextResponse.json({ error: "guideKey 必填" }, { status: 400 });
  }
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title 必填" }, { status: 400 });
  }
  if (typeof page !== "string" || !page.trim()) {
    return NextResponse.json({ error: "page 必填" }, { status: 400 });
  }
  if (!Array.isArray(steps)) {
    return NextResponse.json({ error: "steps 必须是数组" }, { status: 400 });
  }
  if (body.status === GuideStatus.PUBLISHED && steps.length === 0) {
    return NextResponse.json(
      { error: "发布（published）引导必须包含至少一个步骤" },
      { status: 400 },
    );
  }
  for (const step of steps as GuideStep[]) {
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

  const status = Object.values(GuideStatus).includes(body.status as GuideStatus)
    ? (body.status as GuideStatus)
    : GuideStatus.DRAFT;
  const priority =
    typeof body.priority === "number" && Number.isFinite(body.priority)
      ? Math.trunc(body.priority)
      : 0;
  const targetCondition =
    body.targetCondition !== undefined && body.targetCondition !== null
      ? body.targetCondition
      : null;
  if (targetCondition !== null && !isValidTargetCondition(targetCondition)) {
    return NextResponse.json(
      { error: "targetCondition 结构非法（需 {logic, conditions[]}）" },
      { status: 400 }
    );
  }

  // 唯一键冲突检查
  const existing = await db
    .select({ id: guiders.id })
    .from(guiders)
    .where(eq(guiders.guideKey, guideKey));
  if (existing.length > 0) {
    return NextResponse.json(
      { error: "guideKey 已存在（改版请使用新版本号，如 _v2）" },
      { status: 409 }
    );
  }

  const [created] = await db
    .insert(guiders)
    .values({
      guideKey: guideKey.trim(),
      title: title.trim(),
      page: page.trim(),
      steps: steps as GuideStep[],
      status,
      targetCondition: targetCondition as GuideTargetCondition | null,
      priority,
    })
    .returning();

  return NextResponse.json({ guide: created }, { status: 201 });
}
