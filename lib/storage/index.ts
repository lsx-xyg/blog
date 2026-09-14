import  { type StorageDriverInterface, StorageDriverType } from "@/lib/types/storage";
import { getStorageSettings } from "@/lib/settings";
import { LocalStorageDriver, GithubStorageDriver, S3StorageDriver } from "@/lib/storage/drivers";

export * from "@/lib/types/storage";
export * from "@/lib/storage/drivers";
export * from "@/lib/storage/utils";

/** 缓存驱动实例（按 driver 类型缓存，避免重复创建） */
const cached = new Map<StorageDriverType, StorageDriverInterface>();

/**
 * 获取当前配置的存储驱动（异步，从 DB 读取配置）
 *
 * 配置优先级：env > DB > default（由 getStorageSettings / getConfig 统一处理）
 * - LOCAL：本地文件存储（开发默认）
 * - GITHUB：GitHub 图床（生产推荐）
 * - S3：S3 兼容存储（占位）
 *
 * 注意：这是异步函数，因为需要查询数据库获取动态配置。
 * 调用时需要 await。
 * 
 * @returns 存储驱动实例
 */
export async function getStorageDriverInstance(): Promise<StorageDriverInterface> {
  const StorageSettings = await getStorageSettings();
  const driverType = StorageSettings.driver;

  // 检查缓存
  let instance = cached.get(driverType);
  if (instance) return instance;

  switch (driverType) {
    case StorageDriverType.GITHUB:
      instance = new GithubStorageDriver(StorageSettings.github);
      break;
    case StorageDriverType.S3:
      instance = new S3StorageDriver(StorageSettings.s3);
      break;
    case StorageDriverType.LOCAL:
    default:
      instance = new LocalStorageDriver(StorageSettings.local);
      break;
  }

  // 缓存实例
  cached.set(driverType, instance);
  return instance;
}

/** 重置驱动缓存（配置变更后调用，使新配置生效） */
export function resetStorageDriver(): void {
  cached.clear();
}