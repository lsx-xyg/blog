/**
 * 恢复备份 API（T13）
 *
 * POST - 从上传的 JSON 文件恢复数据
 *
 * 注意：这是危险操作，会清空所有业务表然后插入备份数据。
 * 调用前需要确认用户知道风险。
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/server/auth";
import { isAdminUser } from "@/lib/shared/utils";
import { importBackup, type BackupData } from "@/lib/backup/server";

export const dynamic = "force-dynamic";

/** 从上传的 JSON 文件恢复数据 */
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || !isAdminUser(session.user)) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 解析上传的文件
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "未上传备份文件" }, { status: 400 });
    }

    // 读取文件内容
    const content = await file.text();
    let backupData: BackupData;
    try {
      backupData = JSON.parse(content);
    } catch (e) {
      return NextResponse.json({ error: "备份文件格式错误，不是有效的 JSON" }, { status: 400 });
    }

    // 验证备份数据结构
    if (!backupData.version || !backupData.tables) {
      return NextResponse.json({ error: "备份文件结构错误，缺少 version 或 tables 字段" }, { status: 400 });
    }

    // 执行恢复
    await importBackup(backupData);

    return NextResponse.json({ success: true, message: "数据恢复成功" });
  } catch (e) {
    console.error("恢复备份失败:", e);
    return NextResponse.json({ error: "恢复备份失败" }, { status: 500 });
  }
}
