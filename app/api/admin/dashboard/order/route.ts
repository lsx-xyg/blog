/**
 * GET /api/admin/dashboard/order - 读取管理首页统计卡片顺序
 * PUT /api/admin/dashboard/order - 保存管理首页统计卡片顺序（跨设备持久化）
 */
import { NextResponse } from "next/server";
import { requireAdmin, adminDenied } from "@/lib/auth/auth-guard";
import { getSetting, setSetting } from "@/lib/settings/store";
import {
  DASHBOARD_ORDER_KEY,
  normalizeCardOrder,
} from "@/lib/admin/dashboard-order";

export const dynamic = "force-dynamic";

/** 读取卡片顺序（无自定义返回 null，由前端使用默认顺序） */
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return adminDenied();
  try {
    const order = await getSetting<string[]>(DASHBOARD_ORDER_KEY);
    return NextResponse.json({
      order: order ? normalizeCardOrder(order) : null,
    });
  } catch (error) {
    console.error("读取卡片顺序失败：", error);
    return NextResponse.json(
      { error: "读取卡片顺序失败", detail: String(error) },
      { status: 500 },
    );
  }
}

/** 保存卡片顺序 */
export async function PUT(req: Request) {
  if (!(await requireAdmin(req))) return adminDenied();
  try {
    const body = (await req.json()) as { order?: unknown };
    if (!Array.isArray(body.order) || body.order.length === 0) {
      return NextResponse.json(
        { error: "order 必须是卡片 key 数组" },
        { status: 400 },
      );
    }
    const order = normalizeCardOrder(body.order);
    await setSetting(DASHBOARD_ORDER_KEY, order);
    return NextResponse.json({ ok: true, order });
  } catch (error) {
    console.error("保存卡片顺序失败：", error);
    return NextResponse.json(
      { error: "保存卡片顺序失败", detail: String(error) },
      { status: 500 },
    );
  }
}
