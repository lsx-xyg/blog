/** 日期格式化（mono 小字展示） */
export function formatDate(d: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 管理员判定（纯函数，client/server 通用）：
 * Better Auth 类型不含扩展列 isAdmin，统一在此收窄（additionalFields 已声明，运行时字段真实存在）
 */
export function isAdminUser(user: { isAdmin?: boolean | null } | null | undefined) {
  return Boolean(user?.isAdmin);
}
