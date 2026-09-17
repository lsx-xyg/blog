import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { isAdminUser } from "@/lib/shared/utils";
import { db } from "@/db";
import { guideStepEvents } from "@/db/schema";

/**
 * 引导步骤定位失败上报 API（guide_step_events 表，#29 失效监控）
 *
 * POST /api/admin/guides/report-miss
 * 请求体：{ guideKey, stepId, selector, source?, page? }
 * 运行时 pickStepSelector / waitForElement 未命中时上报，后台按 guideKey+stepId 聚合展示。
 * 前端已做节流（同步骤 5 分钟内不重复上报）。
 */

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  let body: {
    guideKey?: unknown;
    stepId?: unknown;
    selector?: unknown;
    source?: unknown;
    page?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const guideKey = body.guideKey;
  const stepId = body.stepId;
  const selector = body.selector;
  if (typeof guideKey !== "string" || !guideKey.trim()) {
    return NextResponse.json({ error: "guideKey 必填" }, { status: 400 });
  }
  if (typeof stepId !== "string" || !stepId.trim()) {
    return NextResponse.json({ error: "stepId 必填" }, { status: 400 });
  }
  if (typeof selector !== "string" || !selector.trim()) {
    return NextResponse.json({ error: "selector 必填" }, { status: 400 });
  }

  const source =
    typeof body.source === "string" && body.source.trim()
      ? body.source.trim()
      : "unknown";
  const page = typeof body.page === "string" ? body.page : "";

  await db.insert(guideStepEvents).values({
    guideKey: guideKey.trim(),
    stepId: stepId.trim(),
    selector: selector.trim(),
    selectorSource: source,
    page: page.trim(),
  });

  return NextResponse.json({ ok: true });
}
