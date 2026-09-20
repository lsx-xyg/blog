/**
 * 定时备份触发接口（T13）
 *
 * GET - 由 cron-job.org 或 node-cron 定时调用，触发自动备份
 *
 * 鉴权方式：
 * - 请求头 x-cron-secret 或 query 参数 secret
 * - 未配置 CRON_SECRET 时拒绝所有请求
 * - 支持动态配置的 CRON_SECRET（环境变量 > DB 加密配置）
 */

import { NextResponse } from "next/server";
import { createBackup } from "@/lib/backup/server";
import { getCronSettings } from "@/lib/settings/server";
import { BackupTrigger } from "@/lib/types/backup";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // 获取 CRON_SECRET（动态配置：环境变量 > DB > 默认值）
    const cronSettings = await getCronSettings();
    const cronSecret = cronSettings.secret;

    // 未配置 CRON_SECRET 时拒绝所有请求
    if (!cronSecret) {
      console.warn("[cron/backup] CRON_SECRET 未配置，拒绝请求");
      return NextResponse.json({ error: "CRON_SECRET 未配置" }, { status: 403 });
    }

    // 验证请求密钥
    const url = new URL(request.url);
    const headerSecret = request.headers.get("x-cron-secret");
    const querySecret = url.searchParams.get("secret");
    const providedSecret = headerSecret || querySecret;

    if (!providedSecret || providedSecret !== cronSecret) {
      console.warn("[cron/backup] 密钥验证失败");
      return NextResponse.json({ error: "密钥验证失败" }, { status: 401 });
    }

    // 执行自动备份
    console.log("[cron/backup] 开始执行自动备份...");
    const { record } = await createBackup(BackupTrigger.AUTO);
    console.log(`[cron/backup] 自动备份完成: ${record.id}`);

    return NextResponse.json({
      success: true,
      backupId: record.id,
      fileKey: record.fileKey,
      size: record.size,
    });
  } catch (e) {
    console.error("[cron/backup] 自动备份失败:", e);
    return NextResponse.json({ error: "自动备份失败" }, { status: 500 });
  }
}
