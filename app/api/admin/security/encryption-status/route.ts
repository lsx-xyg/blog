/**
 * GET /api/admin/security/encryption-status - 加密密钥状态检测
 *
 * 返回：
 * - configured：ENCRYPTION_KEY 环境变量是否已配置
 * - valid：密钥是否有效（能解密库中已存的敏感配置密文）：
 *   - true  密钥有效
 *   - false 密钥无效/不匹配（库中有密文但解不开）
 *   - null  库中无敏感配置可验证（首次部署，尚未写入任何密钥）
 * - sampleKey：用于验证的配置键名
 *
 * 说明：ENCRYPTION_KEY 是自举信任根，只能在环境变量配置（不能存库自举），
 * 本接口仅做状态检测与有效性验证，不提供在线修改。
 */
import { NextResponse } from "next/server";
import { requireAdmin, adminDenied } from "@/lib/auth/auth-guard";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { decryptIfAvailable, isEncryptionAvailable } from "@/lib/shared/crypto";

export const dynamic = "force-dynamic";

/** 库中已知的敏感配置键（用于取密文样本验证密钥） */
const SECRET_SETTING_KEYS = [
  "cron.job_api_key",
  "cron.secret",
  "storage.github.token",
  "storage.s3.access_key",
  "storage.s3.secret_key",
];

/** 是否是加密密文格式（iv:data:authTag，三段 base64） */
function isCipherFormat(value: string): boolean {
  const parts = value.split(":");
  return parts.length === 3;
}

export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return adminDenied();

  const configured = isEncryptionAvailable();

  try {
    // 取库中任一敏感配置密文作为验证样本
    const rows = await db
      .select({ key: settings.key, value: settings.value })
      .from(settings)
      .where(inArray(settings.key, SECRET_SETTING_KEYS))
      .limit(1);

    const sample = rows[0];
    const rawValue = sample ? String(sample.value) : null;
    const sampleKey = sample?.key ?? null;

    let valid: boolean | null = null;
    if (!configured) {
      valid = false;
    } else if (rawValue && isCipherFormat(rawValue)) {
      // GCM 解密失败时返回原密文：解密后是否变化即为有效性判据
      const decrypted = decryptIfAvailable(rawValue);
      valid = decrypted !== rawValue;
    }
    // rawValue 非密文格式（明文存储的旧数据）时 valid 保持 null

    return NextResponse.json({
      configured,
      valid,
      sampleKey,
      hasSample: !!rawValue,
    });
  } catch (error) {
    console.error("检测加密状态失败：", error);
    return NextResponse.json(
      { error: "检测加密状态失败", detail: String(error) },
      { status: 500 },
    );
  }
}
