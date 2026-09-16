import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { isAdminUser } from "@/lib/shared/utils";
import { db } from "@/db";
import { userEvents } from "@/db/schema";
import { GUIDE_TRIGGER_EVENT } from "@/lib/guide-events";

/**
 * 用户行为事件上报 API（user_events 表）
 *
 * POST /api/admin/guides/track - 记录一次埋点事件（click_count 条件的数据源）
 * 请求体：{ event: "event_click", target: "reveal-view" }
 * target 与 data-guide 锚点值 / event_click 条件 value 使用同一标识。
 */

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  let body: { event?: unknown; target?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const event = body.event;
  const target = body.target;
  if (typeof event !== "string" || !event.trim()) {
    return NextResponse.json({ error: "event 必填" }, { status: 400 });
  }
  if (typeof target !== "string" || !target.trim()) {
    return NextResponse.json({ error: "target 必填" }, { status: 400 });
  }

  // 仅接受已知事件类型，防止行为表被任意写入
  if (event !== GUIDE_TRIGGER_EVENT) {
    return NextResponse.json({ error: "不支持的事件类型" }, { status: 400 });
  }

  await db.insert(userEvents).values({
    userId: session.user.id,
    event,
    target: target.trim(),
  });

  return NextResponse.json({ ok: true });
}
