export { cn } from "cn";

/** 判断用户是否为管理员（SPEC §6：isAdmin 字段） */
export function isAdminUser(user?: { isAdmin?: boolean | null } | null): boolean {
  return Boolean(user?.isAdmin);
}

/** 格式化日期为 YYYY-MM-DD */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}
