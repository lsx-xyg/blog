export { cn } from 'cn';

/** 判断用户是否为管理员（SPEC §6：isAdmin 字段） */
export function isAdminUser(user?: { isAdmin?: boolean | null } | null): boolean {
  return Boolean(user?.isAdmin);
}

/** 格式化日期为 YYYY-MM-DD */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

/**
 * 去掉字符串尾部所有斜杠（等价于 replace(/\/+$/, '')）。
 * 用字符串方法避免正则回溯告警（Sonar S8786）。
 */
export function trimTrailingSlashes(value: string): string {
  let result = value;
  while (result.endsWith('/')) result = result.slice(0, -1);
  return result;
}

/**
 * 去掉字符串首尾所有斜杠（等价于 replace(/^\/+|\/+$/g, '')）。
 * 用字符串方法避免正则回溯告警（Sonar S8786）。
 */
export function stripEdgeSlashes(value: string): string {
  let result = value;
  while (result.startsWith('/')) result = result.slice(1);
  while (result.endsWith('/')) result = result.slice(0, -1);
  return result;
}

/**
 * 键盘激活（Enter / 空格）handler 工厂。
 * 用于给非原生交互元素补齐键盘支持（Sonar S6848）。
 * 仅 type-only 引用 React，server-safe。
 */
export function keyActivate(handler: () => void) {
  return (e: { key: string; preventDefault: () => void }) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handler();
    }
  };
}
