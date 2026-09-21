import { type StorageDriverInterface, StorageDriverType } from '@/lib/types/storage';
import { getStorageSettings, getPrivateStorageSettings } from '@/lib/settings/server';
import {
  LocalStorageDriver,
  GithubStorageDriver,
  S3StorageDriver,
  WebdavStorageDriver,
} from './drivers';
import { StorageChannel } from '@/lib/storage/shared/channels';
import {
  listProfilesFull,
  getChannelBindings,
  ensureStorageProfilesSeeded,
  type ProfileConfig,
} from './profiles';

/** 缓存驱动实例（按档案名/驱动类型缓存，配置变更后由 resetStorageDriver() 清空） */
const profileCached = new Map<string, StorageDriverInterface>();
const legacyPublicCached = new Map<StorageDriverType, StorageDriverInterface>();
const legacyPrivateCached = new Map<StorageDriverType, StorageDriverInterface>();

/** 按驱动类型 + 配置创建驱动实例 */
export function createDriverInstance(
  driverType: StorageDriverType,
  config: ProfileConfig | Record<string, never> = {},
): StorageDriverInterface {
  switch (driverType) {
    case StorageDriverType.GITHUB:
      return new GithubStorageDriver(config as never);
    case StorageDriverType.S3:
      return new S3StorageDriver(config as never);
    case StorageDriverType.WEBDAV:
      return new WebdavStorageDriver(config as never);
    case StorageDriverType.LOCAL:
    default:
      return new LocalStorageDriver(config as never);
  }
}

/**
 * 按通道（用途）获取存储驱动 —— 推荐入口。
 *
 * 解析顺序：通道绑定档案（storage.binding.*，env 可覆盖）→ 旧版公开/私有配置回退。
 * 档案实例按档案名缓存，后台改动配置后调用 resetStorageDriver() 生效。
 */
export async function getStorageDriver(channel: StorageChannel): Promise<StorageDriverInterface> {
  await ensureStorageProfilesSeeded();

  const bindings = await getChannelBindings();
  const bindingName = bindings[channel];
  if (bindingName) {
    const cached = profileCached.get(`profile:${bindingName}`);
    if (cached) return cached;

    const profiles = await listProfilesFull();
    const profile = profiles.find((p) => p.name === bindingName);
    if (profile) {
      const instance = createDriverInstance(profile.driver, profile.config);
      profileCached.set(`profile:${bindingName}`, instance);
      return instance;
    }
    console.warn(`[storage] 通道 ${channel} 绑定的档案「${bindingName}」不存在，回退到旧配置`);
  }

  // 未绑定（或绑定失效）：公开通道回退旧公开配置，私有通道回退旧私有配置
  if (channel === StorageChannel.BACKUP) {
    return legacyPrivateDriver();
  }
  return legacyPublicDriver();
}

/** 旧版公开存储驱动（升级兼容：未播种/未绑定时使用当前公开配置） */
async function legacyPublicDriver(): Promise<StorageDriverInterface> {
  const settings = await getStorageSettings();
  const cached = legacyPublicCached.get(settings.driver);
  if (cached) return cached;
  const instance = createDriverInstance(settings.driver, pickConfig(settings.driver, settings));
  legacyPublicCached.set(settings.driver, instance);
  return instance;
}

/** 旧版私有存储驱动（升级兼容） */
async function legacyPrivateDriver(): Promise<StorageDriverInterface> {
  const settings = await getPrivateStorageSettings();
  const cached = legacyPrivateCached.get(settings.driver);
  if (cached) return cached;
  const instance = createDriverInstance(settings.driver, pickConfig(settings.driver, settings));
  legacyPrivateCached.set(settings.driver, instance);
  return instance;
}

function pickConfig(
  driver: StorageDriverType,
  settings: Awaited<ReturnType<typeof getStorageSettings>>,
): ProfileConfig {
  switch (driver) {
    case StorageDriverType.GITHUB:
      return { ...settings.github };
    case StorageDriverType.S3:
      return { ...settings.s3 };
    case StorageDriverType.WEBDAV:
      return { ...settings.webdav };
    case StorageDriverType.LOCAL:
    default:
      return { ...settings.local };
  }
}

/** 兼容旧代码：公开存储（文章/相册图片上传）。等价于 getStorageDriver(UPLOAD) */
export async function getPublicStorageDriver(): Promise<StorageDriverInterface> {
  return getStorageDriver(StorageChannel.UPLOAD);
}

/** 兼容旧代码：私有存储（备份）。等价于 getStorageDriver(BACKUP) */
export async function getPrivateStorageDriver(): Promise<StorageDriverInterface> {
  return getStorageDriver(StorageChannel.BACKUP);
}

/**
 * 按存储驱动类型（平台）获取驱动实例 —— /m 路由与旧备份记录的解析入口。
 *
 * media.storageDriver / backup_records.storageDriver 记录了文件入库时的平台，
 * 据此在档案池里找**该平台**的档案：
 * - prefer = 'public'：优先绑定到公开通道（upload/gallery）的档案
 * - prefer = 'private'：优先绑定到备份通道的档案
 * 找不到时回退到旧版对应配置（旧数据且从未配置过档案的情况）。
 */
export async function getStorageDriverForPlatform(
  driverType: StorageDriverType,
  prefer: 'public' | 'private' = 'public',
): Promise<StorageDriverInterface | null> {
  await ensureStorageProfilesSeeded();

  const profiles = await listProfilesFull();
  const candidates = profiles.filter((p) => p.driver === driverType);
  if (candidates.length > 0) {
    const bindings = await getChannelBindings();
    const preferredBinding =
      prefer === 'private'
        ? [bindings[StorageChannel.BACKUP], bindings[StorageChannel.UPLOAD]]
        : [bindings[StorageChannel.UPLOAD], bindings[StorageChannel.GALLERY]];

    // 先按绑定优先级挑，否则取第一个该平台档案
    const chosen = candidates.find((p) => preferredBinding.includes(p.name)) ?? candidates[0];

    const cacheKey = `profile:${chosen.name}`;
    const cached = profileCached.get(cacheKey);
    if (cached) return cached;
    const instance = createDriverInstance(chosen.driver, chosen.config);
    profileCached.set(cacheKey, instance);
    return instance;
  }

  // 档案池里没有该平台：回退旧配置（驱动类型一致才可用）
  if (prefer === 'private') {
    const settings = await getPrivateStorageSettings();
    if (settings.driver === driverType) return legacyPrivateDriver();
  } else {
    const settings = await getStorageSettings();
    if (settings.driver === driverType) return legacyPublicDriver();
  }
  return null;
}

/** 兼容旧代码：按驱动类型获取私有存储驱动实例（操作旧备份用） */
export async function getPrivateStorageDriverByType(
  driverType: StorageDriverType,
): Promise<StorageDriverInterface | null> {
  const byPlatform = await getStorageDriverForPlatform(driverType, 'private');
  if (byPlatform) return byPlatform;

  // 旧配置也不可用时保持原语义：返回 null 让调用方回退
  console.warn(`[storage] 私有存储驱动 ${driverType} 配置不可用，将回退到当前配置的驱动`);
  return null;
}

/** 重置所有驱动缓存（档案/绑定/设置变更后调用，使新配置生效） */
export function resetStorageDriver(): void {
  profileCached.clear();
  legacyPublicCached.clear();
  legacyPrivateCached.clear();
}
