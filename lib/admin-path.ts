/**
 * 后台路径解析（SPEC §8）：ADMIN_PATH（env 优先）→ DB settings 覆盖（T2 建表后接入）→ 兜底 admin
 * 注意：兜底为 admin 时 /admin 静态引导页会占用该路径；引导完成后必须配置 ADMIN_PATH 才能进后台
 */
import { env } from "@/db/env";

export function getAdminPath(): string {
  const fromEnv = env("ADMIN_PATH");
  if (fromEnv) return fromEnv.replace(/^\/+|\/+$/g, "");
  // TODO(T2)：settings 表建成后，env 无值时查 DB settings.admin_path 覆盖
  return "admin";
}
