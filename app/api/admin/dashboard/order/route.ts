/**
 * GET /api/admin/dashboard/order - 读取排序（scope=cards 统计卡片 | quick 快捷入口）
 * PUT /api/admin/dashboard/order - 保存排序（跨设备持久化到 settings 表）
 */
import { NextResponse } from "next/server";
import { requireAdmin, adminDenied } from "@/lib/auth/server/guard";
import { getSetting, setSetting } from "@/lib/settings/store";
import {
  DASHBOARD_ORDER_KEY,
  QUICK_ORDER_KEY,
  normalizeCardOrder,
  normalizeQuickOrder,
} from "@/lib/admin/dashboard-order";

export const dynamic = "force-dynamic";

/** 解析 scope：cards（统计卡片，默认） | quick（快捷入口） */
function resolveScope(req: Request): "cards" | "quick" {
  const url = new URL(req.url);
  return url.searchParams.get("scope") === "quick" ? "quick" : "cards";
}

/** 读取排序（无自定义返回 null，由前端使用默认顺序） */
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return adminDenied();
  try {
    const scope = resolveScope(req);
    const key = scope === "quick" ? QUICK_ORDER_KEY : DASHBOARD_ORDER_KEY;
    const normalize =
      scope === "quick" ? normalizeQuickOrder : normalizeCardOrder;
    const order = await getSetting<string[]>(key);
    return NextResponse.json({
      scope,
      order: order ? normalize(order) : null,
    });
  } catch (error) {
    console.error("读取顺序失败：", error);
    return NextResponse.json(
      { error: "读取顺序失败", detail: String(error) },
      { status: 500 },
    );
  }
}

/** 保存排序 */
export async function PUT(req: Request) {
  if (!(await requireAdmin(req))) return adminDenied();
  try {
    const body = (await req.json()) as { order?: unknown; scope?: string };
    if (!Array.isArray(body.order) || body.order.length === 0) {
      return NextResponse.json(
        { error: "order 必须是 key 数组" },
        { status: 400 },
      );
    }
    const scope = body.scope === "quick" ? "quick" : "cards";
    const key = scope === "quick" ? QUICK_ORDER_KEY : DASHBOARD_ORDER_KEY;
    const normalize =
      scope === "quick" ? normalizeQuickOrder : normalizeCardOrder;
    const order = normalize(body.order);
    await setSetting(key, order);
    return NextResponse.json({ ok: true, scope, order });
  } catch (error) {
    console.error("保存顺序失败：", error);
    return NextResponse.json(
      { error: "保存顺序失败", detail: String(error) },
      { status: 500 },
    );
  }
}
