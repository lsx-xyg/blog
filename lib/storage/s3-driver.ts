import type { StorageDriver, UploadResult } from "./types";
import type { StorageConfig } from "./config";
import { getStorageSecrets } from "./config";

/** S3 兼容存储驱动（占位，后续实现）
 *
 * 支持阿里云 OSS、Cloudflare R2、AWS S3、MinIO 等 S3 兼容平台
 *
 * 非敏感配置可在后台动态配置：
 * - storage.s3.endpoint
 * - storage.s3.bucket
 * - storage.s3.region
 *
 * 敏感信息只从环境变量读取：
 * - S3_ACCESS_KEY
 * - S3_SECRET_KEY
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
    };
  }

  private get secrets() {
    return getStorageSecrets();
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
