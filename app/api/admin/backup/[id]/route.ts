/**
 * 备份详情/下载/删除 API（T13）
 *
 * GET    - 下载备份文件
 * DELETE - 删除备份（同时删除存储文件和数据库记录）
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/server/auth";
import { isAdminUser } from "@/lib/shared/utils";
import { deleteBackup, downloadBackup, getBackup } from "@/lib/backup/server";

export const dynamic = "force-dynamic";

/** 下载备份文件 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || !isAdminUser(session.user)) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { id } = await params;
    const { buffer, filename, mimeType } = await downloadBackup(id);

    // Buffer 转换为 Uint8Array 以兼容 NextResponse
    const uint8Array = new Uint8Array(buffer);

    return new NextResponse(uint8Array, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (e) {
    console.error("下载备份失败:", e);
    return NextResponse.json({ error: "下载备份失败" }, { status: 500 });
  }
}

/** 删除备份 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || !isAdminUser(session.user)) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { id } = await params;
    await deleteBackup(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("删除备份失败:", e);
    return NextResponse.json({ error: "删除备份失败" }, { status: 500 });
  }
}
