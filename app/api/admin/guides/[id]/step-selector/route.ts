/**
 * PATCH /api/admin/guides/:id/step-selector - 就地保存引导步骤的动态选择器（拾取回填）
 * 不触碰引导其他字段，供拾取层选中元素后直接写库
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { guiders } from "@/db/schema";
import { requireAdmin, adminDenied } from "@/lib/auth/auth-guard";
import type { GuideStep } from "@/lib/types/guides";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  if (!(await requireAdmin(request))) return adminDenied();

  const { id } = await context.params;
  try {
    const body = (await request.json()) as {
      stepId?: string;
      selector?: string;
      selectorMeta?: GuideStep["selectorMeta"];
    };
    if (!body.stepId) {
      return NextResponse.json({ error: "stepId 是必填项" }, { status: 400 });
    }
    if (!body.selector || typeof body.selector !== "string") {
      return NextResponse.json({ error: "selector 是必填字符串" }, { status: 400 });
    }

    const [guide] = await db.select().from(guiders).where(eq(guiders.id, id));
    if (!guide) {
      return NextResponse.json({ error: "引导不存在" }, { status: 404 });
    }

    const steps: GuideStep[] = guide.steps;
    const stepIndex = steps.findIndex((s) => s.id === body.stepId);
    if (stepIndex < 0) {
      // 步骤在草稿中尚未持久化 → 自动创建占位步骤（其余字段待用户在配置页补全）
      steps.push({
        id: body.stepId,
        target: "",
        title: "",
        content: "",
        placement: "bottom",
        selector: body.selector,
        selectorMeta: body.selectorMeta ?? {
          source: "class",
          generatedAt: new Date().toISOString(),
        },
      });
    } else {
      steps[stepIndex] = {
        ...steps[stepIndex],
        selector: body.selector,
        selectorMeta: body.selectorMeta ?? {
          source: "class",
          generatedAt: new Date().toISOString(),
        },
      };
    }

    await db
      .update(guiders)
      .set({ steps, updatedAt: new Date() })
      .where(eq(guiders.id, id));

    const saved = steps[steps.length - 1];
    return NextResponse.json({
      ok: true,
      created: stepIndex < 0,
      step: {
        id: saved.id,
        selector: saved.selector,
      },
    });
  } catch (error) {
    console.error("保存步骤选择器失败：", error);
    return NextResponse.json(
      { error: "保存步骤选择器失败", detail: String(error) },
      { status: 500 },
    );
  }
}
