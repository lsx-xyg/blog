/**
 * 层 0：settings 表读写。
 *
 * 本文件不关心配置语义，只负责 settings 键值表的 CRUD。
 * 加解密、优先级合并、默认值一律不在这里处理。
 */
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { settings } from '@/db/schema';

/** 获取单个设置 */
export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  if (rows.length === 0) return null;
  return rows[0].value as T;
}

/** 设置单个配置（upsert：存在则更新，不存在则插入） */
export async function setSetting(key: string, value: unknown): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value: value as Record<string, unknown> })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: value as Record<string, unknown> },
    });
}

/** 删除单个配置（用于清空配置，回退到环境变量/默认值） */
export async function deleteSetting(key: string): Promise<void> {
  await db.delete(settings).where(eq(settings.key, key));
}

/** 批量设置配置 */
export async function setSettingsBatch(items: { key: string; value: unknown }[]): Promise<void> {
  for (const item of items) {
    await setSetting(item.key, item.value);
  }
}

/** 获取所有设置 */
export async function getAllSettings(): Promise<Record<string, unknown>> {
  const rows = await db.select().from(settings);
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}
