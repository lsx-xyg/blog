import { mkdir, writeFile, unlink } from "fs/promises";
import { join, dirname } from "path";
import type { StorageDriver, UploadResult } from "./types";
import { generateKey } from "./utils";

/** 本地文件存储驱动（开发环境用）
 *
 * 存储路径：public/uploads/YYYY/MM/uuid.ext
 * 访问 URL：/uploads/YYYY/MM/uuid.ext
 *
 * 优点：不消耗外部 API 额度，开发调试方便
 * 缺点：生产环境不适用（Vercel serverless 无持久化文件系统）
 */
export class LocalStorageDriver implements StorageDriver {
  name = "local" as const;

  /** 上传根目录（public/uploads） */
  private get uploadDir(): string {
    return join(process.cwd(), "public", "uploads");
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
