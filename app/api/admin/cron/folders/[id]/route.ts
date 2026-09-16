/**
 * GET /api/admin/cron/folders/[id] - 获取文件夹详情
 * PATCH /api/admin/cron/folders/[id] - 更新文件夹（重命名/启用禁用）
 * DELETE /api/admin/cron/folders/[id] - 删除文件夹（任务移到根目录）
 */
import { NextResponse } from "next/server";
import { requireAdmin, adminDenied } from "@/lib/auth/auth-guard";
import { updateCronFolder, deleteCronFolder } from "@/lib/cron";

export const dynamic = "force-dynamic";

/** 更新文件夹 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin(req))) return adminDenied();

  try {
    const { id } = await params;
    const folderId = parseInt(id, 10);
    if (isNaN(folderId)) {
      return NextResponse.json({ error: "无效的文件夹 ID" }, { status: 400 });
    }

    const body = (await req.json()) as { name?: string; enabled?: boolean };
    if (body.name !== undefined && !body.name.trim()) {
      return NextResponse.json({ error: "文件夹名称不能为空" }, { status: 400 });
    }

    await updateCronFolder(folderId, {
      name: body.name !== undefined ? body.name.trim() : undefined,
      enabled: body.enabled,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("更新文件夹失败：", error);
    return NextResponse.json(
      { error: "更新文件夹失败", detail: String(error) },
      { status: 500 },
    );
  }
}

/** 删除文件夹 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin(req))) return adminDenied();

  try {
    const { id } = await params;
    const folderId = parseInt(id, 10);
    if (isNaN(folderId)) {
      return NextResponse.json({ error: "无效的文件夹 ID" }, { status: 400 });
    }

    await deleteCronFolder(folderId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除文件夹失败：", error);
    return NextResponse.json(
      { error: "删除文件夹失败", detail: String(error) },
      { status: 500 },
    );
  }
}
