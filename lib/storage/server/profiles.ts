/**
 * 存储档案池（storage_profiles 表）服务层。
 *
 * 档案 = 一份完整命名的存储配置（name 用平台名，如 github / r2 / webdav / local）。
 * 用途（通道）通过 settings 的 storage.binding.* 绑定到档案名（见 factory.ts）。
 *
 * - 敏感字段（token / accessKey / secretKey / password）写入前 AES-256-GCM 加密，读出后解密
 * - 首次访问时 ensureStorageProfilesSeeded() 会把旧版公开/私有配置播种成初始档案，
 *   保证升级后现有上传/备份功能零配置继续可用
 */
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { storageProfiles } from '@/db/schema';
import type { StorageDriverType } from '@/lib/types/storage';
import { STORAGE_DRIVER_VALUES } from '@/lib/types/storage';
import type { StorageSettings } from '@/lib/types/settings';
import { encryptIfAvailable, decryptIfAvailable } from '@/lib/crypto/server';
import { getStorageSettings, getPrivateStorageSettings } from '@/lib/settings/server';
import { setSetting } from '@/lib/settings/server/store';
import { StorageChannel, STORAGE_CHANNEL_META } from '@/lib/storage/shared/channels';

/** 各驱动在档案 config JSONB 里的字段布局（即 StorageSettings 对应驱动的子对象） */
export type ProfileConfig = Partial<
  StorageSettings['github'] &
    StorageSettings['s3'] &
    StorageSettings['local'] &
    StorageSettings['webdav']
>;

/** 各驱动的敏感字段（写入加密 / 读出解密 / GET 出裁剪为 configured 布尔） */
const SECRET_FIELDS: Record<string, string[]> = {
  GITHUB: ['token'],
  S3: ['accessKey', 'secretKey'],
  WEBDAV: ['password'],
  LOCAL: [],
};

/** 各驱动的必填字段（校验 + 测试连接前检查） */
const REQUIRED_FIELDS: Record<string, string[]> = {
  GITHUB: ['owner', 'repo', 'token'],
  S3: ['endpoint', 'bucket', 'accessKey', 'secretKey'],
  WEBDAV: ['url', 'username', 'password'],
  LOCAL: [],
};

/** 客户端视图：敏感字段只出 configured 布尔 */
export type StorageProfileView = {
  name: string;
  driver: StorageDriverType;
  config: Record<string, string | boolean>;
};

export function profileNameValid(name: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,39}$/.test(name);
}

/** DB 行 → 解密后的完整配置 */
function decryptConfig(driver: StorageDriverType, raw: Record<string, unknown>): ProfileConfig {
  const config: Record<string, unknown> = { ...raw };
  for (const field of SECRET_FIELDS[driver] ?? []) {
    const v = config[field];
    if (typeof v === 'string' && v) {
      config[field] = decryptIfAvailable(v) ?? v;
    }
  }
  return config as ProfileConfig;
}

/** 配置 → 加密后的 DB 存储形态 */
function encryptConfig(driver: StorageDriverType, config: ProfileConfig): Record<string, unknown> {
  const out: Record<string, unknown> = { ...config };
  for (const field of SECRET_FIELDS[driver] ?? []) {
    const v = out[field];
    if (typeof v === 'string' && v) {
      const encrypted = encryptIfAvailable(v);
      if (encrypted) out[field] = encrypted;
    }
  }
  return out;
}

/** 列出全部档案（解密后，供 factory / 测试接口使用） */
export async function listProfilesFull() {
  await ensureStorageProfilesSeeded();
  const rows = await db.select().from(storageProfiles).orderBy(storageProfiles.createdAt);
  return rows.map((r) => ({
    name: r.name,
    driver: r.driver,
    config: decryptConfig(r.driver, r.config),
  }));
}

/** 后台 GET 视图：敏感字段裁剪为 configured 布尔 */
export async function listProfileViews(): Promise<StorageProfileView[]> {
  const profiles = await listProfilesFull();
  return profiles.map(({ name, driver, config }) => {
    const view: Record<string, string | boolean> = {};
    for (const [k, v] of Object.entries(config)) {
      if ((SECRET_FIELDS[driver] ?? []).includes(k)) {
        view[k] = typeof v === 'string' && v.length > 0;
      } else {
        view[k] = String(v ?? '');
      }
    }
    return { name, driver, config: view };
  });
}

/** 创建/覆盖档案（upsert by name）
 *
 * secret 字段约定：传 string = 覆盖（加密存储）；传 boolean/undefined = 保持已存值不变。
 */
export async function upsertProfile(input: {
  name: string;
  driver: StorageDriverType;
  config: ProfileConfig;
}): Promise<void> {
  if (!profileNameValid(input.name)) {
    throw new Error('档案名只允许小写字母、数字和中划线（如 github / r2 / webdav）');
  }
  if (!(STORAGE_DRIVER_VALUES as string[]).includes(input.driver)) {
    throw new Error(`不支持的驱动类型：${input.driver}`);
  }

  // 合并 secret：调用方未传明文（boolean/undefined）时保留已存的加密值
  const existing = await db
    .select()
    .from(storageProfiles)
    .where(eq(storageProfiles.name, input.name))
    .limit(1);
  const oldConfig = existing[0] ? existing[0].config : {};
  const secrets = SECRET_FIELDS[input.driver] ?? [];
  const merged: Record<string, unknown> = { ...input.config };
  for (const field of secrets) {
    const incoming = merged[field];
    if (typeof incoming !== 'string') {
      // 未提供明文：保留旧值；若明确传了空串且旧值存在，视为移除该 secret
      if (incoming === '' && oldConfig[field] !== undefined) {
        delete merged[field];
      } else if (oldConfig[field] !== undefined) {
        merged[field] = oldConfig[field];
      }
    }
  }

  await db
    .insert(storageProfiles)
    .values({
      name: input.name,
      driver: input.driver,
      config: encryptConfig(input.driver, merged as ProfileConfig),
    })
    .onConflictDoUpdate({
      target: storageProfiles.name,
      set: {
        driver: input.driver,
        config: encryptConfig(input.driver, merged as ProfileConfig),
        updatedAt: new Date(),
      },
    });
}

/** 删除档案（被通道绑定时拒绝） */
export async function deleteProfile(name: string): Promise<void> {
  const bindings = await getChannelBindings();
  const bound = Object.entries(bindings).filter(([, v]) => v === name);
  if (bound.length > 0) {
    throw new Error(
      `档案「${name}」仍被通道绑定（${bound.map(([c]) => STORAGE_CHANNEL_META[c as StorageChannel].label).join('、')}），请先解除绑定`,
    );
  }
  await db.delete(storageProfiles).where(eq(storageProfiles.name, name));
}

/** 读取全部通道绑定（含 env 覆盖） */
export async function getChannelBindings(): Promise<Record<StorageChannel, string>> {
  const { getConfig } = await import('@/lib/settings/server/get-config');
  const result = {} as Record<StorageChannel, string>;
  for (const channel of Object.values(StorageChannel)) {
    const meta = STORAGE_CHANNEL_META[channel];
    const dbVal = await getConfig(meta.settingKey as never);
    // env 覆盖已在 getConfig 内处理；再做一次显式 env 检查以防 registry 未收录
    result[channel] = (process.env[meta.env] as string) || (dbVal as string) || '';
  }
  return result;
}

/** 保存通道绑定（只写非空值；清空绑定传 '' 会删除该 key 回退旧配置） */
export async function setChannelBinding(
  channel: StorageChannel,
  profileName: string,
): Promise<void> {
  const meta = STORAGE_CHANNEL_META[channel];
  if (!meta) throw new Error(`未知通道：${channel}`);
  await setSetting(meta.settingKey, profileName);
}

/* ---------------- 旧配置播种（升级兼容） ---------------- */

let seeded = false;

/** 首次使用时把旧版公开/私有存储配置播种为初始档案 + 通道绑定（幂等，进程内一次） */
export async function ensureStorageProfilesSeeded(): Promise<void> {
  if (seeded) return;

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(storageProfiles);

  if (count === 0) {
    const [pub, priv] = await Promise.all([getStorageSettings(), getPrivateStorageSettings()]);

    // 公开配置 → 平台名档案（github / s3 / local）
    const pubName = pub.driver.toLowerCase();
    await upsertProfile({
      name: pubName,
      driver: pub.driver,
      config: pickDriverConfig(pub.driver, pub),
    });

    // 私有配置 → 平台名-backup 档案（与公开配置相同时跳过，备份复用公开档案）
    const privName = `${priv.driver.toLowerCase()}-backup`;
    const privConfig = pickDriverConfig(priv.driver, priv);
    const pubConfig = pickDriverConfig(pub.driver, pub);
    let backupBinding = pubName;
    if (priv.driver !== pub.driver || JSON.stringify(privConfig) !== JSON.stringify(pubConfig)) {
      await upsertProfile({ name: privName, driver: priv.driver, config: privConfig });
      backupBinding = privName;
    }

    await setChannelBinding(StorageChannel.UPLOAD, pubName);
    await setChannelBinding(StorageChannel.GALLERY, pubName);
    await setChannelBinding(StorageChannel.BACKUP, backupBinding);

    console.log(`[storage] 已从旧配置播种档案：${pubName}（公开/相册）+ ${backupBinding}（备份）`);
  }

  seeded = true;
}

/** 从 StorageSettings 里挑出对应驱动的配置子对象 */
function pickDriverConfig(driver: StorageDriverType, settings: StorageSettings): ProfileConfig {
  switch (driver) {
    case 'GITHUB':
      return { ...settings.github };
    case 'S3':
      return { ...settings.s3 };
    case 'WEBDAV':
      return { ...settings.webdav };
    case 'LOCAL':
    default:
      return { ...settings.local };
  }
}

/** 校验档案必填字段是否齐备（返回缺失字段列表，空数组 = 就绪） */
export function profileMissingFields(driver: StorageDriverType, config: ProfileConfig): string[] {
  const record = config as Record<string, unknown>;
  return (REQUIRED_FIELDS[driver] ?? []).filter((f) => !record[f]);
}
