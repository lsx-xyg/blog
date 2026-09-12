import type { StorageDriver, UploadResult } from "./types";

/** S3 兼容存储驱动（占位，后续实现）
 *
 * 支持阿里云 OSS、Cloudflare R2、AWS S3、MinIO 等 S3 兼容平台
 *
 * 环境变量（后续实现时需要）：
 * - S3_ENDPOINT：S3 端点（如 https://oss-cn-hangzhou.aliyuncs.com）
 * - S3_BUCKET：存储桶名称
 * - S3_ACCESS_KEY：访问密钥 ID
 * - S3_SECRET_KEY：秘密访问密钥
 * - S3_REGION：区域（如 us-east-1）
 * - S3_PUBLIC_URL：自定义公开访问 URL（可选，用于 CDN）
 *
 * 当前为占位实现，调用时抛出错误。
 * 实现时建议使用 @aws-sdk/client-s3 或 minio 库。
 */
export class S3StorageDriver implements StorageDriver {
  name = "s3" as const;

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
