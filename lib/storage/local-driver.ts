import { mkdir, writeFile, unlink } from "fs/promises";
import { join, dirname } from "path";
import type { StorageDriver, UploadResult } from "./types";
import { generateKey } from "./utils";
import type { StorageConfig } from "./config";

/** 本地文件存储驱动（开发环境用）
 *
 * 存储路径：{uploadDir}/YYYY/MM/uuid.ext
 * 访问 URL：/uploads/YYYY/MM/uuid.ext
 *
 * 可在后台动态配置 uploadDir（默认 public/uploads）
 *
 * 优点：不消耗外部 API 额度，开发调试方便
 * 缺点：生产环境不适用（Vercel serverless 无持久化文件系统）
 */
export class LocalStorageDriver implements StorageDriver {
  name = "local" as const;

  private uploadDirConfig: string;

  constructor(config?: StorageConfig["local"]) {
    this.uploadDirConfig = config?.uploadDir || "public/uploads";
  }

  /** 上传根目录 */
  private get uploadDir(): string {
    return join(process.cwd(), this.uploadDirConfig);
  }

  async upload(file: Buffer, filename: string, mimeType: string): Promise<UploadResult> {
    const key = generateKey(filename);
    const filePath = join(this.uploadDir, key);

    // 确保目录存在
    await mkdir(dirname(filePath), { recursive: true });

    // 写入文件
    await writeFile(filePath, file);

    return {
      url: `/uploads/${key}`,
      key,
      size: file.length,
      mimeType,
    };
  }

  async delete(key: string): Promise<void> {
    const filePath = join(this.uploadDir, key);
    try {
      await unlink(filePath);
    } catch {
      // 文件不存在时静默忽略
    }
  }

  getUrl(key: string): string {
    return `/uploads/${key}`;
  }
}
