import { mkdir, writeFile, unlink, readFile } from "fs/promises";
import { join, dirname } from "path";
import type { StorageDriverInterface, UploadResult } from "@/lib/types/storage";
import { generateKey } from "../utils";
import type { StorageSettings } from "@/lib/types/settings";

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
export class LocalStorageDriver implements StorageDriverInterface {
  name = "local" as const;

  private uploadDirConfig: string;
  private directoryConfig: string;

  constructor(config?: StorageSettings["local"]) {
    this.uploadDirConfig = config?.uploadDir || "public/uploads";
    this.directoryConfig = config?.directory || "";
  }

  /** 上传根目录 */
  private get uploadDir(): string {
    return join(process.cwd(), this.uploadDirConfig);
  }

  /** 子目录 */
  private get directory(): string {
    return this.directoryConfig;
  }

  /** 构建完整路径（包含子目录） */
  private buildPath(key: string): string {
    return this.directory ? `${this.directory}/${key}` : key;
  }

  async upload(file: Buffer, filename: string, mimeType: string): Promise<UploadResult> {
    const key = generateKey(filename);
    const fullPath = this.buildPath(key);
    const filePath = join(this.uploadDir, fullPath);

    // 确保目录存在
    await mkdir(dirname(filePath), { recursive: true });

    // 写入文件
    await writeFile(filePath, file);

    return {
      url: `/uploads/${fullPath}`,
      key,
      size: file.length,
      mimeType,
    };
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.buildPath(key);
    const filePath = join(this.uploadDir, fullPath);
    try {
      await unlink(filePath);
    } catch {
      // 文件不存在时静默忽略
    }
  }

  getUrl(key: string): string {
    const fullPath = this.buildPath(key);
    return `/uploads/${fullPath}`;
  }

  async download(key: string): Promise<Buffer> {
    const fullPath = this.buildPath(key);
    const filePath = join(this.uploadDir, fullPath);
    return readFile(filePath);
  }
}
