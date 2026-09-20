/**
 * 环境变量名常量
 * 统一在这里定义，避免各处写死字符串
 */
export const ENV_KEYS = {
  DATABASE_URL: 'DATABASE_URL',
  DATABASE_URL_UNPOOLED: 'DATABASE_URL_UNPOOLED',
  ADMIN_PATH: 'ADMIN_PATH',
} as const;

// 推导出所有 key 的联合类型
export type EnvKey = (typeof ENV_KEYS)[keyof typeof ENV_KEYS];
