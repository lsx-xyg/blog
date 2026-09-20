import { NextResponse } from "next/server";
import { requireAdmin, apiError } from "@/lib/shared/admin-api";
import { getSettingsBundle, applySettingsPatch } from "@/lib/settings/server";

/**
 * 站点设置 API（C9 薄壳：领域逻辑在 lib/settings/service.ts）
 * GET /api/admin/settings - 获取所有设置（敏感字段只出 configured 布尔）
 * PUT /api/admin/settings - 批量更新设置（字段分类 + 加密编排）
 */

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    return NextResponse.json(await getSettingsBundle());
  } catch (error) {
    console.error("获取设置失败：", error);
    return apiError("获取失败", 500);
  }
}

export async function PUT(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    await applySettingsPatch(body);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("更新设置失败：", error);
    return apiError("更新失败", 500);
  }
}
