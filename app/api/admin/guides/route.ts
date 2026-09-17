import { NextResponse } from "next/server";
import { requireAdmin, apiError } from "@/lib/shared/admin-api";
import { listGuides, createGuide, parseGuideInput } from "@/lib/guide/service";
import { GuideStatus } from "@/lib/types/guides";

/**
 * 引导配置 API（guiders 表）——C9 薄壳
 * GET  /api/admin/guides?status=published - 引导列表
 * POST /api/admin/guides                 - 创建引导
 */

export async function GET(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const statusFilter =
    status && (Object.values(GuideStatus) as string[]).includes(status)
      ? (status as GuideStatus)
      : null;

  return NextResponse.json({ guides: await listGuides(statusFilter ?? undefined) });
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError("请求格式错误", 400);
  }

  const parsed = parseGuideInput(body);
  if (!parsed.ok) return apiError(parsed.error, 400);

  const result = await createGuide(parsed.data);
  if ("error" in result) return apiError(result.error, 409);

  return NextResponse.json({ guide: result.guide }, { status: 201 });
}
