import { NextResponse } from "next/server";
import { requireAdmin, apiError } from "@/lib/shared/admin-api";
import { parseGuidePatch, updateGuide, deleteGuideById } from "@/lib/guides/server/service";

/**
 * 引导配置详情 API——C9 薄壳
 * PUT    /api/admin/guides/[id] - 更新引导（含状态切换 draft/published/archived）
 * DELETE /api/admin/guides/[id] - 删除引导（进度记录保留，仅删除配置）
 */

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError("请求格式错误", 400);
  }

  const parsed = parseGuidePatch(body);
  if (!parsed.ok) return apiError(parsed.error, 400);

  const result = await updateGuide(id, parsed.data);
  if ("error" in result) return apiError(result.error, 400);

  return NextResponse.json({ guide: result.guide });
}

export async function DELETE(request: Request, context: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await context.params;
  const result = await deleteGuideById(id);
  if ("error" in result) return apiError(result.error, 404);

  return NextResponse.json({ success: true });
}
