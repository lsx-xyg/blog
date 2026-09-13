import type { StorageDriver, UploadResult } from "./types";
import type { StorageConfig } from "./config";

/** S3 兼容存储驱动（占位，后续实现）
 *
 * 支持阿里云 OSS、Cloudflare R2、AWS S3、MinIO 等 S3 兼容平台
 *
 * 非敏感配置可在后台动态配置：
 * - storage.s3.endpoint
 * - storage.s3.bucket
 * - storage.s3.region
 *
 * 敏感信息加密存储在 DB 中，环境变量优先级最高：
 * - S3_ACCESS_KEY / S3_SECRET_KEY（环境变量）
 * - storage.s3.access_key / storage.s3.secret_key（DB 加密存储）
 *
 * 当前为占位实现，调用时抛出错误。
 * 实现时建议使用 @aws-sdk/client-s3 或 minio 库。
 */
export class S3StorageDriver implements StorageDriver {
  name = "s3" as const;

  private config: StorageConfig["s3"];

  constructor(config?: StorageConfig["s3"]) {
    this.config = config || {
      endpoint: process.env.S3_ENDPOINT || "",
      bucket: process.env.S3_BUCKET || "",
      region: process.env.S3_REGION || "auto",
      accessKey: process.env.S3_ACCESS_KEY || "",
      secretKey: process.env.S3_SECRET_KEY || "",
    };
  }

  private get accessKey(): string {
    return this.config.accessKey;
  }

  private get secretKey(): string {
    return this.config.secretKey;
  }

  async upload(_file: Buffer, _filename: string, _mimeType: string): Promise<UploadResult> {
    throw new Error(
      "S3 存储驱动尚未实现。请设置 STORAGE_DRIVER=local 或 STORAGE_DRIVER=github，或实现 S3StorageDriver。"
    );
  }

  async delete(_key: string): Promise<void> {
    throw new Error(
      "S3 存储驱动尚未实现。请设置 STORAGE_DRIVER=local 或 STORAGE_DRIVER=github，或实现 S3StorageDriver。"
    );
  }

  getUrl(_key: string): string {
    throw new Error(
      "S3 存储驱动尚未实现。请设置 STORAGE_DRIVER=local 或 STORAGE_DRIVER=github，或实现 S3StorageDriver。"
    );
  }
}
