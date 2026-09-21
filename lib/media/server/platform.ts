/**
 * 按 storageKey 反查入库时的存储平台（media.storageDriver）。
 *
 * 供 /m 路由、删除接口等使用：历史文件跟着入库时的平台走，
 * 不受后台后续切换通道绑定的影响。进程内短缓存（key 不可变，TTL 只为省查询）。
 */
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { media } from '@/db/schema';
import type { StorageDriverType } from '@/lib/types/storage';

const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map<string, { driver: StorageDriverType | null; at: number }>();

export async function resolveMediaPlatform(storageKey: string): Promise<StorageDriverType | null> {
  const hit = cache.get(storageKey);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.driver;

  try {
    const rows = await db
      .select({ storageDriver: media.storageDriver })
      .from(media)
      .where(eq(media.storageKey, storageKey))
      .limit(1);
    const driver = rows[0]?.storageDriver ?? null;
    cache.set(storageKey, { driver, at: Date.now() });
    return driver;
  } catch (error) {
    console.error('[media] 平台反查失败:', error);
    return null;
  }
}
