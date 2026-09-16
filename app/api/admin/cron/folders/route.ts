/**
 * GET /api/admin/cron/folders - 列出所有文件夹
 * POST /api/admin/cron/folders - 创建文件夹
 */
import { NextResponse } from "next/server";
import { requireAdmin, adminDenied } from "@/lib/auth/auth-guard";
import { listCronFolders, createCronFolder } from "@/lib/cron";

export const dynamic = "force-dynamic";

/** 列出所有文件夹 */
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return adminDenied();

  try {
    const folders = await listCronFolders();
    return NextResponse.json({ folders });
  } catch (error) {
    console.error("获取文件夹列表失败：", error);
    return NextResponse.json(
      { error: "获取文件夹列表失败", detail: String(error) },
      { status: 500 },
    );
  }
}

/** 创建文件夹 */
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return adminDenied();

  try {
    const body = (await req.json()) as { name?: string };
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "文件夹名称不能为空" }, { status: 400 });
    }

    const folderId = await createCronFolder(name);
    return NextResponse.json({ folderId });
  } catch (error) {
    console.error("创建文件夹失败：", error);
    return NextResponse.json(
      { error: "创建文件夹失败", detail: String(error) },
      { status: 500 },
    );
  }
}
