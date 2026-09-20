import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and, count } from "drizzle-orm";
import { auth } from "@/lib/auth/server/auth";
import { isAdminUser } from "@/lib/shared/utils";
import { db } from "@/db";
import { guiders, userEvents, users } from "@/db/schema";
import {
  evaluateTargetCondition,
  needsServerData,
  type GuideConditionContext,
} from "@/lib/guides/shared";
import { normalizeTargetCondition } from "@/lib/types/guides";

/**
 * 引导条件服务端精筛 API
 *
 * POST /api/admin/guides/evaluate - 判断引导是否满足触发条件
 * 请求体：{ guideKey, event, target, page }
 * 前端「点击后立即触发」时，若条件含 click_count / user_age_days 等
 * 服务端数据，先调本接口精筛再决定是否拉起引导。
 *
 * 返回：{ matched: boolean }（另带逐条件结果供调试）
 */

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  let body: {
    guideKey?: unknown;
    event?: unknown;
    target?: unknown;
    page?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const guideKey = body.guideKey;
  if (typeof guideKey !== "string" || !guideKey.trim()) {
    return NextResponse.json({ error: "guideKey 必填" }, { status: 400 });
  }

  const [guide] = await db
    .select()
    .from(guiders)
    .where(eq(guiders.guideKey, guideKey.trim()));
  if (!guide) {
    return NextResponse.json({ error: "引导不存在" }, { status: 404 });
  }

  const tc = normalizeTargetCondition(guide.targetCondition as never);
  const ctx: GuideConditionContext = {
    event: typeof body.event === "string" ? body.event : undefined,
    target: typeof body.target === "string" ? body.target : undefined,
    page: typeof body.page === "string" ? body.page : undefined,
  };

  // click_count.<target>：查 user_events 累计次数
  const clickFields = tc?.conditions
    .filter((c) => c.field.startsWith("click_count."))
    .map((c) => c.field.slice("click_count.".length))
    .filter(Boolean);
  if (clickFields && clickFields.length > 0) {
    const clickCounts: Record<string, number> = {};
    for (const anchor of clickFields) {
      const [row] = await db
        .select({ n: count() })
        .from(userEvents)
        .where(
          and(
            eq(userEvents.userId, session.user.id),
            eq(userEvents.event, "event_click"),
            eq(userEvents.target, anchor)
          )
        );
      clickCounts[anchor] = row?.n ?? 0;
    }
    ctx.clickCounts = clickCounts;
  }

  // user_age_days：按注册时间计算
  const [user] = await db
    .select({ createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, session.user.id));
  if (user?.createdAt) {
    ctx.userAgeDays = Math.floor(
      (Date.now() - new Date(user.createdAt).getTime()) / 86_400_000
    );
  }

  const matched = needsServerData(tc) ? evaluateTargetCondition(tc, ctx) : true;
  return NextResponse.json({ matched, needsServerData: needsServerData(tc) });
}
