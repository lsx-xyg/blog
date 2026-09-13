/**
 * 加密工具模块（AES-256-GCM）
 *
 * 用于加密存储敏感信息（GitHub Token、S3 Access Key/Secret Key 等）
 *
 * 加密密钥：ENCRYPTION_KEY 环境变量（32 字节随机字符串，Base64 编码）
 * 生成方式：node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *
 * 存储格式：{iv}:{encryptedData}:{authTag}（全部 Base64 编码）
 *
 * 安全说明：
 * - AES-256-GCM 是行业标准对称加密算法，自带认证（防篡改）
 * - 加密密钥通过环境变量提供，和密文分开存储（密钥在 Vercel，密文在 Neon）
 * - 即使数据库泄露，没有密钥也解不开密文
 * - 解密后的明文只在内存中使用，不返回给前端
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/** 算法：AES-256-GCM */
const ALGORITHM = "aes-256-gcm";

/** IV 长度：12 字节（GCM 推荐） */
const IV_LENGTH = 12;

/**
 * 获取加密密钥（从环境变量）
 * 密钥必须是 32 字节（256 位），Base64 编码
 */
function getEncryptionKey(): Buffer {
  const keyBase64 = process.env.ENCRYPTION_KEY;
  if (!keyBase64) {
    throw new Error(
      "ENCRYPTION_KEY 环境变量未设置。请生成：node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
    );
  }
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) {
    throw new Error(`ENCRYPTION_KEY 必须是 32 字节（当前 ${key.length} 字节），请重新生成`);
  }
  return key;
}

/**
 * 加密明文
 * @param plaintext 要加密的明文字符串
 * @returns 加密后的字符串，格式：{iv}:{encryptedData}:{authTag}
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // 格式：iv:encryptedData:authTag（全部 Base64）
  return `${iv.toString("base64")}:${encrypted.toString("base64")}:${authTag.toString("base64")}`;
}

/**
 * 解密密文
 * @param ciphertext 加密后的字符串，格式：{iv}:{encryptedData}:{authTag}
 * @returns 解密后的明文字符串
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();

  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("密文格式错误，应为 iv:encryptedData:authTag");
  }

  const iv = Buffer.from(parts[0], "base64");
  const encrypted = Buffer.from(parts[1], "base64");
  const authTag = Buffer.from(parts[2], "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * 检查是否已配置加密密钥
 */
export function isEncryptionAvailable(): boolean {
  return !!process.env.ENCRYPTION_KEY;
}

/**
 * 安全地加密值（如果值为空或未配置密钥，返回原值）
 */
export function encryptIfAvailable(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") {
    return value ?? null;
  }
  if (!isEncryptionAvailable()) {
    console.warn("[crypto] ENCRYPTION_KEY 未配置，敏感信息将明文存储！");
    return value;
  }
  return encrypt(value);
}

/**
 * 安全地解密值（如果值为空或不是加密格式，返回原值）
 */
export function decryptIfAvailable(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") {
    return value ?? null;
  }
  // 检查是否是加密格式（iv:encryptedData:authTag，三段 Base64）
  const parts = value.split(":");
  if (parts.length !== 3) {
    // 不是加密格式，可能是旧的明文数据，直接返回
    return value;
  }
  if (!isEncryptionAvailable()) {
    console.warn("[crypto] ENCRYPTION_KEY 未配置，无法解密敏感信息！");
    return value;
  }
  try {
    return decrypt(value);
  } catch {
    // 解密失败，可能是旧的明文数据，直接返回
    return value;
  }
}
