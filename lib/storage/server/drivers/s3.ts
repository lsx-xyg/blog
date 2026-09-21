import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import type { StorageDriverInterface, UploadResult } from '@/lib/types/storage';
import { generateKey } from '../utils';
import type { StorageSettings } from '@/lib/types/settings';

/** S3 兼容对象存储驱动
 *
 * 支持 Cloudflare R2、阿里云 OSS、AWS S3、MinIO 等所有 S3 兼容平台。
 *
 * 关键配置：
 * - endpoint：平台 API 入口（R2: https://<account_id>.r2.cloudflarestorage.com）
 * - publicBase：公开访问域名（R2 绑定的自定义域名或 r2.dev 域名）。
 *   公开通道（文章/相册图片）的档案必须配置，否则文件没有公网 URL；
 *   私有通道（备份）不需要。
 * - forcePathStyle：R2/OSS/MinIO 都要求 path-style（endpoint/bucket/key），固定开启。
 *
 * 档案池模式下，本驱动的 config 来自 storage_profiles.config（JSONB，密钥已加密）。
 */
export class S3StorageDriver implements StorageDriverInterface {
  name = 's3' as const;

  private config: StorageSettings['s3'];
  private client: S3Client;

  constructor(config?: StorageSettings['s3']) {
    this.config = config || {
      endpoint: process.env.S3_ENDPOINT || '',
      bucket: process.env.S3_BUCKET || '',
      region: process.env.S3_REGION || 'auto',
      publicBase: process.env.S3_PUBLIC_BASE || '',
      directory: process.env.S3_DIRECTORY || '',
      accessKey: process.env.S3_ACCESS_KEY || '',
      secretKey: process.env.S3_SECRET_KEY || '',
    };

    this.client = new S3Client({
      endpoint: this.config.endpoint || undefined,
      region: this.config.region || 'auto',
      credentials:
        this.config.accessKey && this.config.secretKey
          ? { accessKeyId: this.config.accessKey, secretAccessKey: this.config.secretKey }
          : undefined,
      // R2/OSS/MinIO 均要求 path-style
      forcePathStyle: true,
    });
  }

  private get bucket(): string {
    return this.config.bucket;
  }

  private get directory(): string {
    return this.config.directory || '';
  }

  /** 构建完整路径（包含子目录） */
  private buildPath(key: string): string {
    return this.directory ? `${this.directory}/${key}` : key;
  }

  /** 公开访问 URL（publicBase 为公开域名或其反代前缀，末尾斜杠自动归一化） */
  getUrl(key: string): string {
    const url = this.publicUrlOrEmpty(key);
    if (!url) {
      throw new Error(
        'S3 档案未配置公开访问域名（publicBase）。公开通道的档案需要先在 R2/OSS 控制台绑定公开域名。',
      );
    }
    return url;
  }

  /**
   * 尽力构造公开 URL：未配置 publicBase（私有档案，如备份用的 bucket）时返回空串而不抛错。
   * upload() 用它——私有档案上传成功后不该因为「没有公开域名」被判失败并留下孤儿文件。
   */
  private publicUrlOrEmpty(key: string): string {
    const publicBase = (this.config.publicBase || '').replace(/\/+$/, '');
    return publicBase ? `${publicBase}/${this.buildPath(key)}` : '';
  }

  async upload(file: Buffer, filename: string, mimeType: string): Promise<UploadResult> {
    if (!this.bucket) {
      throw new Error('S3 档案未配置 bucket');
    }

    const key = generateKey(filename);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.buildPath(key),
        Body: file,
        ContentType: mimeType,
      }),
    );

    return {
      // 私有档案（未配 publicBase）返回空串，见 publicUrlOrEmpty 说明
      url: this.publicUrlOrEmpty(key),
      key,
      size: file.length,
      mimeType,
    };
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: this.buildPath(key) }),
      );
    } catch (error) {
      // 对象不存在时视为删除成功（S3 DeleteObject 对不存在的 key 本身也返回成功）
      console.error('[s3-driver] 删除失败:', error);
      throw error;
    }
  }

  /** 下载文件（私有 bucket 或未配置公开域名时使用） */
  async download(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: this.buildPath(key) }),
    );
    const bytes = await response.Body?.transformToByteArray();
    if (!bytes) {
      throw new Error(`S3 下载失败：对象为空 ${key}`);
    }
    return Buffer.from(bytes);
  }
}
