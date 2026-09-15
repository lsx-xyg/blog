import  { type StorageDriverInterface, StorageDriverType } from "@/lib/types/storage";
import { getStorageSettings, getPrivateStorageSettings } from "@/lib/settings";
import { LocalStorageDriver, GithubStorageDriver, S3StorageDriver } from "@/lib/storage/drivers";

export * from "@/lib/types/storage";
export * from "@/lib/storage/drivers";
export * from "@/lib/storage/utils";

/** 缓存驱动实例（按 driver 类型缓存，避免重复创建） */
const publicCached = new Map<StorageDriverType, StorageDriverInterface>();
const privateCached = new Map<StorageDriverType, StorageDriverInterface>();

/**
 * 根据配置创建存储驱动实例
 */
function createDriverInstance(
  driverType: StorageDriverType,
  settings: { github: any; s3: any; local: any }
): StorageDriverInterface {
  switch (driverType) {
    case StorageDriverType.GITHUB:
      return new GithubStorageDriver(settings.github);
    case StorageDriverType.S3:
      return new S3StorageDriver(settings.s3);
    case StorageDriverType.LOCAL:
    default:
      return new LocalStorageDriver(settings.local);
  }
}

/**
 * 获取公开存储驱动实例（用于图片、视频等公开资源）
 *
 * 配置优先级：env > DB > default
 * - LOCAL：本地文件存储（开发默认），目录 public/uploads
 * - GITHUB：GitHub 公开仓库 + jsDelivr CDN（生产推荐），仓库名 public
 * - S3：S3 兼容公开 bucket
 *
 * @returns 公开存储驱动实例
 */
export async function getPublicStorageDriver(): Promise<StorageDriverInterface> {
  const settings = await getStorageSettings();
  const driverType = settings.driver;

  let instance = publicCached.get(driverType);
  if (instance) return instance;

  instance = createDriverInstance(driverType, settings);
  publicCached.set(driverType, instance);
  return instance;
}

/**
 * 获取私有存储驱动实例（用于数据库备份等敏感数据）
 *
 * 配置前缀：storagePrivate.*
 * - LOCAL：本地私有目录 private/storage（不暴露到 Web）
 * - GITHUB：GitHub 私有仓库 backups（只有用户自己能访问）
 * - S3：S3 兼容私有 bucket
 *
 * @returns 私有存储驱动实例
 */
export async function getPrivateStorageDriver(): Promise<StorageDriverInterface> {
  const settings = await getPrivateStorageSettings();
  const driverType = settings.driver;

  let instance = privateCached.get(driverType);
  if (instance) return instance;

  instance = createDriverInstance(driverType, settings);
  privateCached.set(driverType, instance);
  return instance;
}

/**
 * 兼容旧代码：获取当前配置的存储驱动（等同于公开存储）
 * @deprecated 请使用 getPublicStorageDriver() 或 getPrivateStorageDriver()
 */
export async function getStorageDriverInstance(): Promise<StorageDriverInterface> {
  return getPublicStorageDriver();
}

/** 重置所有驱动缓存（配置变更后调用，使新配置生效） */
export function resetStorageDriver(): void {
  publicCached.clear();
  privateCached.clear();
}
