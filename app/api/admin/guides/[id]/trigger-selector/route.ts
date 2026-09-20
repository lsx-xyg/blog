/**
 * PATCH /api/admin/guides/:id/trigger-selector - 就地保存触发条件（event_click）的元素选择器
 * 供拾取层选中元素后，直接把 selector 写入 targetCondition.conditions[i].value
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { guiders } from "@/db/schema";
import { requireAdmin, adminDenied } from "@/lib/auth/server/guard";
import type {
  GuideTargetCondition,
  GuideCondition,
} from "@/lib/types/guides";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  if (!(await requireAdmin(request))) return adminDenied();

  const { id } = await context.params;
  try {
    const body = (await request.json()) as {
      conditionIndex?: number;
      value?: string;
    };
    if (
      typeof body.conditionIndex !== "number" ||
      !Number.isInteger(body.conditionIndex) ||
      body.conditionIndex < 0
    ) {
      return NextResponse.json({ error: "conditionIndex 非法" }, { status: 400 });
    }
    if (!body.value || typeof body.value !== "string") {
      return NextResponse.json({ error: "value 是必填字符串" }, { status: 400 });
    }

    const [guide] = await db.select().from(guiders).where(eq(guiders.id, id));
    if (!guide) {
      return NextResponse.json({ error: "引导不存在" }, { status: 404 });
    }

    const tc = guide.targetCondition as GuideTargetCondition | null;
    if (!tc || !Array.isArray(tc.conditions)) {
      return NextResponse.json({ error: "引导没有触发条件" }, { status: 400 });
    }
    const conditions: GuideCondition[] = tc.conditions;
    let created = false;
    let cond = conditions[body.conditionIndex];
    if (!cond) {
      // 表单新建的条件尚未入库 → 追加到末尾（防索引脱节）
      cond = { field: "event_click", op: "eq" as const, value: body.value };
      conditions.push(cond);
      created = true;
    } else if (!cond.field.startsWith("event_click")) {
      return NextResponse.json(
        { error: "仅 event_click 触发条件支持拾取元素" },
        { status: 400 },
      );
    } else {
      cond = { ...cond, value: body.value };
      conditions[body.conditionIndex] = cond;
    }
    const nextTc: GuideTargetCondition = { ...tc, conditions };
    await db
      .update(guiders)
      .set({ targetCondition: nextTc, updatedAt: new Date() })
      .where(eq(guiders.id, id));

    return NextResponse.json({
      ok: true,
      created,
      condition: { index: body.conditionIndex, field: cond.field, value: body.value },
    });
  } catch (error) {
    console.error("保存触发条件选择器失败：", error);
    return NextResponse.json(
      { error: "保存触发条件选择器失败", detail: String(error) },
      { status: 500 },
    );
  }
}
