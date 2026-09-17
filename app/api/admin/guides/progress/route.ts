import { NextResponse } from "next/server";
import { requireAdmin, apiError } from "@/lib/shared/admin-api";
import {
  getProgress,
  guideExistsByKey,
  upsertProgress,
  deleteProgress,
  parseProgressInput,
} from "@/lib/guide/service";

/**
 * 用户引导进度 API（user_guide_progress 表）——C9 薄壳
 * GET    /api/admin/guides/progress         - 当前用户全部引导进度
 * POST   /api/admin/guides/progress         - 上报/upsert 进度 { guideKey, status?, currentStep? }
 * DELETE /api/admin/guides/progress?guideKey=xxx - 重置当前用户某引导的进度（重新触发）
 */

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const session = await getSessionUserId();
  if (!session) return apiError("未授权", 401);
  return NextResponse.json({ progress: await getProgress(session) });
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const session = await getSessionUserId();
  if (!session) return apiError("未授权", 401);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError("请求格式错误", 400);
  }

  const parsed = parseProgressInput(body);
  if (!parsed.ok) return apiError(parsed.error, 400);

  // guideKey 必须存在于 guiders 表（防止脏数据）
  if (!(await guideExistsByKey(parsed.data.guideKey))) {
    return apiError("引导不存在", 404);
  }

  const { created, row } = await upsertProgress(session, parsed.data.guideKey, {
    status: parsed.data.status,
    currentStep: parsed.data.currentStep,
  });
  return NextResponse.json({ progress: row }, { status: created ? 201 : 200 });
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const session = await getSessionUserId();
  if (!session) return apiError("未授权", 401);

  const { searchParams } = new URL(request.url);
  const guideKey = searchParams.get("guideKey");
  if (!guideKey || !guideKey.trim()) {
    return apiError("guideKey 必填", 400);
  }

  const deleted = await deleteProgress(session, guideKey.trim());
  return NextResponse.json({ reset: true, deleted });
}

/** 复用 requireAdmin 的会话（薄壳内取一次 userId） */
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
async function getSessionUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}
