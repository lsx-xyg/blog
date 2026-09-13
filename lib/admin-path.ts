/**
 * 后台路径解析（SPEC §8）：
 * - 同步版本 getAdminPath()：仅从 env 读取（用于 client component props 初始化等）
 * - 异步版本 getAdminPathAsync()：env 优先 → DB settings 覆盖 → 兜底 admin
 *
 * 注意：兜底为 admin 时 /admin 静态引导页会占用该路径；引导完成后必须配置 ADMIN_PATH 才能进后台
 */
import { env } from "@/db/env";
import { getSetting } from "@/lib/settings";

/** 同步版本：仅从 env 读取（兜底 admin） */
export function getAdminPath(): string {
  const fromEnv = env("ADMIN_PATH");
  if (fromEnv) return fromEnv.replace(/^\/+|\/+$/g, "");
  return "admin";
}

/** 异步版本：env 优先 → DB settings.admin_path 覆盖 → 兜底 admin */
export async function getAdminPathAsync(): Promise<string> {
  const fromEnv = env("ADMIN_PATH");
  if (fromEnv) return fromEnv.replace(/^\/+|\/+$/g, "");

  try {
    const fromDb = await getSetting<string>("admin.path");
    if (fromDb) return fromDb.replace(/^\/+|\/+$/g, "");
  } catch {
    // DB 读取失败时静默降级到 env/兜底
  }

  return "admin";
}
