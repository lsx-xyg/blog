import type { StorageDriver } from "./types";
import { LocalStorageDriver } from "./local-driver";
import { GithubStorageDriver } from "./github-driver";
import { S3StorageDriver } from "./s3-driver";
import { getStorageConfig, type StorageDriverType } from "./config";

export type { StorageDriver, UploadResult } from "./types";
export { ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_SIZE } from "./types";
export { LocalStorageDriver } from "./local-driver";
export { GithubStorageDriver } from "./github-driver";
export { S3StorageDriver } from "./s3-driver";
export { generateKey, validateImage, getExtension, mimeToExt } from "./utils";
export { getStorageConfig, getStorageSecrets } from "./config";
export type { StorageConfig, StorageDriverType } from "./config";

/** 单例缓存（按 driver 类型缓存，避免重复创建） */
const driverCache = new Map<StorageDriverType, StorageDriver>();

/**
 * 获取当前配置的存储驱动（异步，从 DB 读取配置）
 *
 * 配置优先级：DB settings 表 > 环境变量 > 默认值
 * - LOCAL：本地文件存储（开发默认）
 * - GITHUB：GitHub 图床（生产推荐）
 * - S3：S3 兼容存储（占位）
 *
 * 注意：这是异步函数，因为需要查询数据库获取动态配置。
 * 调用时需要 await。
 */
export async function getStorageDriver(): Promise<StorageDriver> {
  const config = await getStorageConfig();
  const driverType = config.driver;

  // 检查缓存
  const cached = driverCache.get(driverType);
  if (cached) return cached;

  let driver: StorageDriver;

  switch (driverType) {
    case "GITHUB":
      driver = new GithubStorageDriver(config.github);
      break;
    case "S3":
      driver = new S3StorageDriver(config.s3);
      break;
    case "LOCAL":
    default:
      driver = new LocalStorageDriver(config.local);
      break;
  }

  // 缓存实例
  driverCache.set(driverType, driver);
  console.log(`[storage] 使用存储驱动：${driver.name}（${driverType}）`);
  return driver;
}

/**
 * 同步获取存储驱动（使用环境变量配置，不查 DB）
 *
 * 用于无法使用异步的场景（如模块初始化时）。
 * 注意：这个函数不会读取 DB 中的动态配置，只使用环境变量。
 */
export function getStorageDriverSync(): StorageDriver {
  const raw = (process.env.STORAGE_DRIVER || "LOCAL").toUpperCase();
  let driverType: StorageDriverType;

  if (raw === "LOCAL" || raw === "GITHUB" || raw === "S3") {
    driverType = raw;
  } else {
    console.warn(`[storage] 未知的 STORAGE_DRIVER 值：${raw}，回退到 LOCAL`);
    driverType = "LOCAL";
  }

  switch (driverType) {
    case "GITHUB":
      return new GithubStorageDriver();
    case "S3":
      return new S3StorageDriver();
    case "LOCAL":
    default:
      return new LocalStorageDriver();
  }
}

/** 重置驱动缓存（配置变更后调用，使新配置生效） */
export function resetStorageDriver(): void {
  driverCache.clear();
}
