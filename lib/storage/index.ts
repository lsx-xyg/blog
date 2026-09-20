import  { type StorageDriverInterface, StorageDriverType } from "@/lib/types/storage";
import { getStorageSettings, getPrivateStorageSettings } from "@/lib/settings/server";
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

/**
 * 根据驱动类型获取私有存储驱动实例（用于操作旧备份）
 *
 * 当备份记录中存储了 storage_driver 字段时，使用此函数获取对应驱动的实例。
 * 如果该驱动的配置不可用（比如没有配置 Token），返回 null。
 * 调用方应在返回 null 时回退到当前配置的私有存储驱动。
 *
 * @param driverType 驱动类型（GITHUB/S3/LOCAL）
 * @returns 驱动实例，或 null（配置不可用时）
 */
export async function getPrivateStorageDriverByType(
  driverType: StorageDriverType
): Promise<StorageDriverInterface | null> {
  // 先检查缓存
  const cached = privateCached.get(driverType);
  if (cached) return cached;

  // 获取私有存储配置
  const settings = await getPrivateStorageSettings();

  // 检查对应驱动的配置是否可用
  let configAvailable = false;
  switch (driverType) {
    case StorageDriverType.GITHUB:
      // GitHub 驱动需要 Token
      configAvailable = !!settings.github.token;
      break;
    case StorageDriverType.S3:
      // S3 驱动需要 endpoint 和 bucket
      configAvailable = !!settings.s3.endpoint && !!settings.s3.bucket;
      break;
    case StorageDriverType.LOCAL:
    default:
      // Local 驱动总是可用
      configAvailable = true;
      break;
  }

  if (!configAvailable) {
    console.warn(`[storage] 私有存储驱动 ${driverType} 配置不可用，将回退到当前配置的驱动`);
    return null;
  }

  // 创建驱动实例并缓存
  const instance = createDriverInstance(driverType, settings);
  privateCached.set(driverType, instance);
  return instance;
}

/** 重置所有驱动缓存（配置变更后调用，使新配置生效） */
export function resetStorageDriver(): void {
  publicCached.clear();
  privateCached.clear();
}
