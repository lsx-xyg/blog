/**
 * 备份管理 API（T13）
 *
 * GET  - 获取备份列表
 * POST - 创建新备份（手动触发）
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/server/auth";
import { isAdminUser } from "@/lib/shared/utils";
import { createBackup, listBackups } from "@/lib/backup/server";
import { BackupTrigger } from "@/lib/types/backup";

export const dynamic = "force-dynamic";

/** 获取备份列表 */
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || !isAdminUser(session.user)) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const backups = await listBackups(50);
    return NextResponse.json({ backups });
  } catch (e) {
    console.error("获取备份列表失败:", e);
    return NextResponse.json({ error: "获取备份列表失败" }, { status: 500 });
  }
}

/** 创建新备份（手动触发） */
export async function POST() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || !isAdminUser(session.user)) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { record, downloadUrl } = await createBackup(BackupTrigger.MANUAL);
    return NextResponse.json({ backup: record, downloadUrl });
  } catch (e) {
    console.error("创建备份失败:", e);
    return NextResponse.json({ error: "创建备份失败" }, { status: 500 });
  }
}
