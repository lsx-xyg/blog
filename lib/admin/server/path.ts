/**
 * 后台路径解析（SPEC §8）：
 * - 异步版本 getAdminPathAsync()：env 优先 → DB settings 覆盖 → 兜底 admin
 *
 * 注意：兜底为 admin 时，/admin 由动态路由 [adminSlug] 处理：
 * - 用户表为空 → 显示引导页（创建第一个管理员）
 * - 用户表不为空 → 显示登录页或后台首页
 */
import { ENV_KEYS } from '@/lib/env/shared';
import { getEnv } from '@/lib/env/server';
import { getSetting } from '@/lib/settings/server';

/** 异步版本：env 优先 → DB settings.admin_path 覆盖 → 兜底 admin */
export async function getAdminPathAsync(): Promise<string> {
  const fromEnv = getEnv(ENV_KEYS.ADMIN_PATH);
  if (fromEnv) return fromEnv.replace(/^\/+|\/+$/g, '');

  try {
    const fromDb = await getSetting<string>('admin.path');
    if (fromDb) return fromDb.replace(/^\/+|\/+$/g, '');
  } catch {
    // DB 读取失败时静默降级到 env/兜底
  }

  return 'admin';
}
