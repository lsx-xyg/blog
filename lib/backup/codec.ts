/**
 * 备份文件格式与加密编解码
 *
 * 职责：备份文件的序列化 / 加密 / 解密 / 版本与魔数约定。
 * 不涉及数据库与存储，纯字符串/Buffer 变换，可独立单测。
 */
import {
  decryptIfAvailable,
  encryptIfAvailable,
  isEncryptionAvailable,
} from "@/lib/shared/crypto";

/** 备份版本 */
export const BACKUP_VERSION = "1.0";

/** 加密备份文件的魔数标记（用于判断文件是否已加密） */
export const ENCRYPTED_MAGIC = "BACKUP_ENC_V1:";

/** 备份数据结构 */
export interface BackupData {
  version: string;
  createdAt: string;
  /** 敏感字段是否已加密（true=已加密，false=已脱敏/null） */
  sensitiveFieldsEncrypted: boolean;
  tables: Record<string, unknown[]>;
}

/**
 * 序列化并加密备份内容（未配置 ENCRYPTION_KEY 时明文 + 警告）
 *
 * 加密后的格式：ENCRYPTED_MAGIC + encrypt(jsonContent)
 * 即使私有仓库被访问，没有密钥也无法读取备份内容。
 */
export function encodeBackupContent(
  backupData: BackupData,
): { content: string; isEncrypted: boolean } {
  const jsonContent = JSON.stringify(backupData, null, 2);

  if (!isEncryptionAvailable()) {
    console.warn("[backup] ENCRYPTION_KEY 未配置，备份内容将明文存储（建议配置加密密钥）");
    return { content: jsonContent, isEncrypted: false };
  }

  try {
    const encrypted = encryptIfAvailable(jsonContent);
    if (encrypted && encrypted !== jsonContent) {
      console.log("[backup] 备份内容已加密（AES-256-GCM）");
      return { content: `${ENCRYPTED_MAGIC}${encrypted}`, isEncrypted: true };
    }
  } catch (e) {
    console.error("[backup] 备份加密失败，将使用明文存储：", e);
  }
  return { content: jsonContent, isEncrypted: false };
}

/**
 * 解码备份内容：检测魔数，是加密文件则解密
 *
 * @param buffer 存储中读出的原始内容
 * @returns 解密后的明文 Buffer（未加密则原样返回）
 * @throws 加密文件且解密失败时抛错
 */
export function decodeBackupContent(buffer: Buffer): Buffer {
  const contentStr = buffer.toString("utf-8");
  if (!contentStr.startsWith(ENCRYPTED_MAGIC)) {
    return buffer;
  }

  const encryptedContent = contentStr.slice(ENCRYPTED_MAGIC.length);
  try {
    const decrypted = decryptIfAvailable(encryptedContent);
    if (decrypted && decrypted !== encryptedContent) {
      console.log("[backup] 备份文件解密成功");
      return Buffer.from(decrypted, "utf-8");
    }
    console.error("[backup] 备份文件解密失败（可能是 ENCRYPTION_KEY 未配置或不正确）");
    throw new Error("备份文件解密失败，请检查 ENCRYPTION_KEY 配置");
  } catch (e) {
    console.error("[backup] 备份文件解密异常：", e);
    throw new Error(`备份文件解密失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}
